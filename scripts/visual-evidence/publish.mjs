import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import {
  loadAndValidateArtifact,
  listIssueComments,
  objectKeyFor,
  renderComment,
  validateTrustedConfig,
} from "./core.mjs";

const requiredEnvironment = [
  "GITHUB_REPOSITORY",
  "GITHUB_TOKEN",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "VISUAL_EVIDENCE_EXPECTED_RUN_ID",
  "VISUAL_EVIDENCE_EXPECTED_HEAD_SHA",
  "VISUAL_EVIDENCE_EXPECTED_TARGET_NUMBER",
];
for (const name of requiredEnvironment) {
  if (!process.env[name])
    throw new Error(`Missing required environment: ${name}`);
}

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
const manifest = await loadAndValidateArtifact(
  artifactRoot,
  process.env.GITHUB_REPOSITORY,
  trustedConfig.project,
);
if (
  String(manifest.runId) !== process.env.VISUAL_EVIDENCE_EXPECTED_RUN_ID ||
  manifest.headSha !== process.env.VISUAL_EVIDENCE_EXPECTED_HEAD_SHA ||
  String(manifest.target.number) !==
    process.env.VISUAL_EVIDENCE_EXPECTED_TARGET_NUMBER ||
  manifest.target.kind !== "pull"
) {
  throw new Error(
    "Artifact identity does not match the triggering workflow run",
  );
}
const [owner, repository] = process.env.GITHUB_REPOSITORY.split("/");
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
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

if (manifest.target.kind === "pull") {
  const pull = await github(
    `/repos/${owner}/${repository}/pulls/${manifest.target.number}`,
  );
  if (pull.head.sha !== manifest.headSha) {
    console.log(
      "The PR advanced after capture; stale screenshots will not publish.",
    );
    process.exit(0);
  }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: trustedConfig.endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const publicBaseUrl = trustedConfig.publicBaseUrl.replace(/\/$/, "");
const published = [];

for (const screenshot of manifest.screenshots) {
  const key = objectKeyFor(manifest, screenshot);
  await s3.send(
    new PutObjectCommand({
      Bucket: trustedConfig.bucket,
      Key: key,
      Body: await readFile(screenshot.absolutePath),
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  published.push({
    ...screenshot,
    url: `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`,
  });
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

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## Visual evidence\n\nPublished ${published.length} screenshots for ${manifest.headSha}.\n`,
  );
}
console.log(
  `Published ${published.length} screenshots and synchronized the comment.`,
);
