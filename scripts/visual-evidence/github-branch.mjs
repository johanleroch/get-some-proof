import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Where a target's current captures live: one commit under a ref of its own,
 * outside refs/heads, so clones never fetch the images and no branch rule
 * applies to them. The ref is force-updated on every publication, so a
 * target only ever holds its latest head's images, while the URLs pin the
 * commit, so a replaced comment keeps showing exactly what it showed.
 */
export function evidenceRef(manifest) {
  return `refs/visual-evidence/${manifest.target.kind}-${manifest.target.number}`;
}

export function rawUrl(repository, commitSha, filePath) {
  return `https://raw.githubusercontent.com/${repository}/${commitSha}/${filePath}`;
}

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (body, method) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * Publishes the captures through the Git Data API, which the job's own token
 * may use, unlike GitHub's attachment endpoint: one blob per image, one tree
 * (with the manifest for provenance), one parentless commit, one ref. Every
 * blob is then read back through the API and compared byte for byte with
 * the local file before any URL reaches a comment: that is what the commit
 * holds, whatever the raw host is doing at that moment. `probe`, when given,
 * is told the first image's raw URL so the caller can report whether the
 * raw host already serves the commit; it never decides the publication.
 */
export async function uploadToRef(manifest, github, { probe } = {}) {
  const { repository } = manifest;
  const git = `/repos/${repository}/git`;
  const entries = [];
  for (const screenshot of manifest.screenshots) {
    const bytes = await readFile(screenshot.absolutePath);
    const blob = await github(
      `${git}/blobs`,
      json({ content: bytes.toString("base64"), encoding: "base64" }, "POST"),
    );
    entries.push({ screenshot, digest: digest(bytes), sha: blob.sha });
  }
  const provenance = {
    ...manifest,
    screenshots: manifest.screenshots.map((screenshot) => {
      const copy = { ...screenshot };
      delete copy.absolutePath;
      return copy;
    }),
  };
  const manifestBlob = await github(
    `${git}/blobs`,
    json(
      {
        content: Buffer.from(
          `${JSON.stringify(provenance, null, 2)}\n`,
        ).toString("base64"),
        encoding: "base64",
      },
      "POST",
    ),
  );
  const tree = await github(
    `${git}/trees`,
    json(
      {
        tree: [
          ...entries.map(({ screenshot, sha }) => ({
            path: screenshot.path,
            mode: "100644",
            type: "blob",
            sha,
          })),
          {
            path: "manifest.json",
            mode: "100644",
            type: "blob",
            sha: manifestBlob.sha,
          },
        ],
      },
      "POST",
    ),
  );
  const commit = await github(
    `${git}/commits`,
    json(
      {
        message: `Visual evidence for ${repository}#${manifest.target.number} at ${manifest.headSha}`,
        tree: tree.sha,
        parents: [],
      },
      "POST",
    ),
  );
  const ref = evidenceRef(manifest);
  await pointRef(github, git, ref, commit.sha);

  const published = [];
  for (const { screenshot, digest: expected, sha } of entries) {
    const stored = await github(`${git}/blobs/${sha}`);
    const bytes = Buffer.from(
      stored.content ?? "",
      stored.encoding ?? "base64",
    );
    if (digest(bytes) !== expected) {
      throw new Error(
        `Visual evidence verification failed for ${screenshot.path}`,
      );
    }
    published.push({
      ...screenshot,
      url: rawUrl(repository, commit.sha, screenshot.path),
    });
  }
  if (probe && published.length > 0) await probe(published[0].url);
  return { published, ref, commit: commit.sha };
}

async function pointRef(github, git, ref, sha) {
  const name = ref.replace(/^refs\//, "");
  try {
    await github(`${git}/refs/${name}`, json({ sha, force: true }, "PATCH"));
  } catch (error) {
    // A ref that does not exist yet answers 422; anything else is real.
    if (!/\b422\b/.test(String(error?.message))) throw error;
    await github(`${git}/refs`, json({ ref, sha }, "POST"));
  }
}

/**
 * Fetches a raw URL, waiting out the moments a fresh commit can take to
 * appear on raw.githubusercontent.com or a busy backend answers 5xx. The
 * token lets private repositories answer; a public one ignores it.
 */
export async function downloadRaw(
  url,
  token,
  {
    attempts = 6,
    fetcher = fetch,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetcher(url, {
      headers: token ? { Authorization: `token ${token}` } : {},
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    failure = new Error(`Raw download ${response.status} for ${url}`);
    const transient = response.status === 404 || response.status >= 500;
    if (!transient || attempt === attempts) break;
    await wait(attempt * 2000);
  }
  throw failure;
}
