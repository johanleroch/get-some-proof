import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadAndValidateArtifact,
  listIssueComments,
  objectKeyFor,
  renderComment,
  validateTrustedConfig,
} from "./core.mjs";

const artifactRoot = path.resolve(
  process.env.VISUAL_EVIDENCE_DIR ?? "visual-evidence",
);
const trustedConfig = validateTrustedConfig(
  JSON.parse(
    await readFile(
      new URL("../../visual-evidence.config.json", import.meta.url),
    ),
  ),
);
const repositoryName = execFileSync(
  "gh",
  ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
  { encoding: "utf8" },
).trim();
const githubToken = execFileSync("gh", ["auth", "token"], {
  encoding: "utf8",
}).trim();
const manifest = await loadAndValidateArtifact(
  artifactRoot,
  repositoryName,
  trustedConfig.project,
);

if (manifest.target.kind !== "issue") {
  throw new Error("The local publisher only accepts issue manifests");
}
const currentHead = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (manifest.headSha !== currentHead) {
  throw new Error("Screenshots are not tied to the current commit");
}

const [owner, repository] = repositoryName.split("/");
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${githubToken}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "convex-admin-starter-visual-evidence",
};

async function github(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

const issue = await github(
  `/repos/${owner}/${repository}/issues/${manifest.target.number}`,
);
if (issue.pull_request) {
  throw new Error("The local issue publisher cannot target a pull request");
}

const publicBaseUrl = trustedConfig.publicBaseUrl.replace(/\/$/, "");
const published = [];
for (const screenshot of manifest.screenshots) {
  const key = objectKeyFor(manifest, screenshot);
  execFileSync(
    "npx",
    [
      "-y",
      "wrangler@4.127.1",
      "r2",
      "object",
      "put",
      `${trustedConfig.bucket}/${key}`,
      "--file",
      screenshot.absolutePath,
      "--content-type",
      "image/png",
      "--cache-control",
      "public, max-age=31536000, immutable",
      "--remote",
    ],
    { stdio: "inherit" },
  );

  const url = `${publicBaseUrl}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const remote = Buffer.from(await (await fetch(url)).arrayBuffer());
  const local = await readFile(screenshot.absolutePath);
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  if (digest(remote) !== digest(local)) {
    throw new Error(`Public R2 verification failed for ${screenshot.path}`);
  }
  published.push({ ...screenshot, url });
}

const body = renderComment(manifest, published);
const marker = `<!-- visual-evidence:${manifest.project} -->`;
const comments = await listIssueComments(
  github,
  owner,
  repository,
  manifest.target.number,
);
const existing = comments.find((comment) => comment.body?.includes(marker));

if (existing) {
  await github(`/repos/${owner}/${repository}/issues/comments/${existing.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
} else {
  await github(
    `/repos/${owner}/${repository}/issues/${manifest.target.number}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

console.log(
  `Published ${published.length} screenshots and synchronized issue #${manifest.target.number}.`,
);
