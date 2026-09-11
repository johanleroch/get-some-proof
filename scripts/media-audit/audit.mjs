import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

export function referenceQuery(table, cursor, needles) {
  return `
const result = await ctx.db.query(${JSON.stringify(table)}).paginate({cursor: ${JSON.stringify(cursor)}, numItems: 25});
const needles = ${JSON.stringify(needles)};
const found = new Set();
function visit(value) {
  if (typeof value === "string") {
    for (const needle of needles) if (value.includes(needle)) found.add(needle);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) visit(child);
  }
}
for (const row of result.page) visit(row);
return {matches: [...found], isDone: result.isDone, continueCursor: result.continueCursor};`;
}

export function classify(asset, references, cutoff) {
  if (asset.tokens.some((token) => references.has(token))) return "referenced";
  if (!Number.isFinite(asset.createdAt) || asset.createdAt > cutoff)
    return "recent_or_unknown_age";
  return asset.provider === "mux"
    ? "unreferenced_scope_unverified"
    : "orphan_candidate";
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      deployment: { type: "string" },
      output: { type: "string", default: "output/media-audit.json" },
      "min-age-hours": { type: "string", default: "24" },
      "skip-mux": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(
      "pnpm media:audit --deployment <name> [--min-age-hours 24] [--output output/media-audit.json] [--skip-mux]\nRead-only. Mux requires MUX_TOKEN_ID and MUX_TOKEN_SECRET in the process environment. No deletion or deployment.",
    );
    return;
  }
  if (!values.deployment || !/^[a-z0-9-]+$/.test(values.deployment))
    throw new Error("An explicit deployment name is required.");
  const hours = Number(values["min-age-hours"]);
  if (!Number.isFinite(hours) || hours < 2)
    throw new Error("Minimum age must be at least 2 hours.");
  if (
    !values["skip-mux"] &&
    (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET)
  )
    throw new Error(
      "Set MUX_TOKEN_ID and MUX_TOKEN_SECRET, or explicitly use --skip-mux for Convex-only coverage.",
    );
  const startedAt = Date.now();
  console.error(`Read-only media audit: ${values.deployment}`);
  function cli(args) {
    try {
      return execFileSync(
        "pnpm",
        ["exec", "convex", ...args, "--deployment-name", values.deployment],
        {
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
          timeout: 120_000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ).trim();
    } catch {
      throw new Error(
        "Convex read failed. Check CLI authentication and the selected deployment. No complete report was written.",
      );
    }
  }
  const query = (source) => JSON.parse(cli(["run", "--inline-query", source]));
  const tables = cli(["data"]).split("\n").filter(Boolean);
  if (tables.some((table) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(table)))
    throw new Error("Could not establish the application table inventory.");
  const assets = [];
  async function pages(getPage, consume) {
    let cursor = null;
    const seen = new Set();
    do {
      const result = await getPage(cursor);
      consume(result);
      if (result.isDone) return;
      if (!result.continueCursor || seen.has(result.continueCursor))
        throw new Error("Invalid or repeated inventory cursor.");
      cursor = result.continueCursor;
      seen.add(cursor);
    } while (true);
  }
  await pages(
    (cursor) =>
      query(
        `return await ctx.db.system.query("_storage").paginate({cursor:${JSON.stringify(cursor)},numItems:100});`,
      ),
    ({ page }) => {
      for (const file of page)
        assets.push({
          provider: "convex",
          id: file._id,
          createdAt: file._creationTime,
          bytes: file.size,
          tokens: [file._id],
        });
    },
  );
  if (!values["skip-mux"]) {
    const authorization = `Basic ${Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64")}`;
    await pages(
      async (cursor) => {
        const url = new URL("https://api.mux.com/video/v1/assets?limit=100");
        if (cursor) url.searchParams.set("cursor", cursor);
        const response = await fetch(url, {
          headers: { Authorization: authorization },
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok)
          throw new Error(`Mux inventory failed (${response.status}).`);
        const body = await response.json();
        if (!Array.isArray(body.data))
          throw new Error("Invalid Mux inventory.");
        return {
          page: body.data,
          isDone: !body.next_cursor,
          continueCursor: body.next_cursor,
        };
      },
      ({ page }) => {
        for (const asset of page) {
          if (typeof asset.id !== "string" || !asset.id)
            throw new Error("Invalid Mux asset ID.");
          assets.push({
            provider: "mux",
            id: asset.id,
            createdAt: asset.created_at
              ? Number(asset.created_at) * 1000
              : null,
            durationSeconds: asset.duration ?? null,
            tokens: [
              asset.id,
              asset.upload_id,
              asset.passthrough,
              asset.meta?.external_id,
              ...(asset.playback_ids ?? []).map((p) => p.id),
            ].filter((token) => typeof token === "string" && token.length > 0),
          });
        }
      },
    );
  }
  const references = new Set();
  const tokens = [...new Set(assets.flatMap((asset) => asset.tokens))];
  for (let offset = 0; offset < tokens.length; offset += 200) {
    const batch = tokens.slice(offset, offset + 200);
    for (const table of tables) {
      console.error(
        `Scanning ${table} (media batch ${Math.floor(offset / 200) + 1})`,
      );
      await pages(
        (cursor) => query(referenceQuery(table, cursor, batch)),
        ({ matches }) => {
          for (const match of matches) references.add(match);
        },
      );
    }
  }
  const rows = assets.map(({ tokens: assetTokens, ...asset }) => ({
    ...asset,
    status: classify(
      { ...asset, tokens: assetTokens },
      references,
      startedAt - hours * 3_600_000,
    ),
  }));
  const report = {
    deployment: values.deployment,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    readOnly: true,
    minimumAgeHours: hours,
    coverage: {
      tables,
      convexStorage: true,
      mux: !values["skip-mux"],
      components: false,
    },
    limitations: [
      "Paginated reads are not a single snapshot. Recheck candidates before any deletion.",
      "Mux credentials identify an environment independently of Convex. Unreferenced Mux assets require ownership verification.",
      "Any stored reference protects a file, including expired jobs and historical records. External references and component storage are not audited.",
    ],
    summary: rows.reduce(
      (counts, row) => ({
        ...counts,
        [row.status]: (counts[row.status] ?? 0) + 1,
      }),
      {},
    ),
    assets: rows,
  };
  await mkdir(dirname(values.output), { recursive: true });
  await writeFile(values.output, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({ report: values.output, summary: report.summary }, null, 2),
  );
}
