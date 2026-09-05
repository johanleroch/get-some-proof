import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

import { loadAndValidateArtifact, validateTrustedConfig } from "./core.mjs";
import { publishEvidence } from "./github-attachments.mjs";

const ci = process.env.GITHUB_ACTIONS === "true";
const requiredEnvironment = ci
  ? [
      "GITHUB_REPOSITORY",
      "GH_TOKEN",
      "VISUAL_EVIDENCE_EXPECTED_RUN_ID",
      "VISUAL_EVIDENCE_EXPECTED_HEAD_SHA",
      "VISUAL_EVIDENCE_EXPECTED_TARGET_NUMBER",
    ]
  : [];
for (const name of requiredEnvironment) {
  if (!process.env[name])
    throw new Error(`Missing required environment: ${name}`);
}
const repository =
  process.env.GITHUB_REPOSITORY ||
  execFileSync(
    "gh",
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    { encoding: "utf8" },
  ).trim();
const token =
  process.env.GH_TOKEN ||
  execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
const trustedConfig = validateTrustedConfig(
  JSON.parse(
    await readFile(
      new URL("../../visual-evidence.config.json", import.meta.url),
      "utf8",
    ),
  ),
);
const manifest = await loadAndValidateArtifact(
  path.resolve(process.env.VISUAL_EVIDENCE_DIR ?? "visual-evidence"),
  repository,
  trustedConfig.project,
);
if (ci) {
  if (
    String(manifest.runId) !== process.env.VISUAL_EVIDENCE_EXPECTED_RUN_ID ||
    manifest.headSha !== process.env.VISUAL_EVIDENCE_EXPECTED_HEAD_SHA ||
    String(manifest.target.number) !==
      process.env.VISUAL_EVIDENCE_EXPECTED_TARGET_NUMBER ||
    manifest.target.kind !== "pull"
  )
    throw new Error(
      "Artifact identity does not match the triggering workflow run",
    );
} else {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (manifest.headSha !== head)
    throw new Error("Screenshots are not tied to the current commit");
  const dirty = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=normal"],
    { encoding: "utf8" },
  ).trim();
  if (dirty)
    throw new Error(
      "Commit reviewed changes before publishing visual evidence",
    );
}
async function github(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "get-some-proof-visual-evidence",
      ...options.headers,
    },
  });
  if (!response.ok)
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
const result = await publishEvidence(manifest, github);
if (result.stale) {
  console.log(
    "The PR advanced after capture; stale screenshots will not publish.",
  );
} else {
  const message = `Published and byte-verified ${result.count} GitHub attachments for ${manifest.headSha}.`;
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Visual evidence\n\n${message}\n`,
    );
  }
}
