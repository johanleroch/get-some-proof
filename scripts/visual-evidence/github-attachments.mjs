import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { listIssueComments, renderComment } from "./core.mjs";

// Only accept image attachments returned by gh-image, never arbitrary URLs.
export function attachmentUrl(markdown) {
  const match = markdown
    .trim()
    .match(
      /^!\[[^\]\r\n]*\]\((https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+)\)$/i,
    );
  if (!match)
    throw new Error("gh-image did not return one GitHub image attachment");
  return match[1];
}

export async function uploadAttachment(
  repository,
  screenshot,
  run = execFileSync,
) {
  const markdown = run(
    "gh",
    ["image", "--repo", repository, screenshot.absolutePath],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const url = attachmentUrl(markdown);
  // Authenticated download works before the attachment is referenced in a comment,
  // including private repositories. A plain public fetch cannot prove this.
  const downloaded = run("gh", ["image", "download", url, "--output", "-"], {
    maxBuffer: 11 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const local = await readFile(screenshot.absolutePath);
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  if (digest(downloaded) !== digest(local)) {
    throw new Error(
      `GitHub attachment verification failed for ${screenshot.path}`,
    );
  }
  return { ...screenshot, url };
}

/**
 * The attachment transport: gh-image and a browser session, one image at a
 * time. Kept for a contributor who prefers GitHub attachments; it cannot run
 * on Actions, whose token the attachment endpoint refuses.
 */
export async function uploadAttachments(
  manifest,
  _github,
  upload = uploadAttachment,
) {
  const published = [];
  for (const screenshot of manifest.screenshots) {
    published.push(await upload(manifest.repository, screenshot));
  }
  return { published };
}

/**
 * Checks the target still points at the captured commit, hands the images to
 * the transport (which must verify every byte before returning URLs), checks
 * again, then creates or replaces the one marked comment. A transport that
 * throws leaves the previous comment intact.
 */
export async function publishEvidence(
  manifest,
  github,
  transport = uploadAttachments,
) {
  const [owner, repository] = manifest.repository.split("/");
  const targetPath = `/repos/${owner}/${repository}/${manifest.target.kind === "pull" ? "pulls" : "issues"}/${manifest.target.number}`;
  const isCurrent = async () => {
    const target = await github(targetPath);
    if (manifest.target.kind === "pull")
      return target.head.sha === manifest.headSha;
    if (target.pull_request)
      throw new Error("An issue manifest cannot target a pull request");
    return true;
  };
  if (!(await isCurrent())) return { stale: true, count: 0 };
  const { published, ...hosting } = await transport(manifest, github);
  const comments = await listIssueComments(
    github,
    owner,
    repository,
    manifest.target.number,
  );
  // Publishing all screens can take minutes; check again immediately before writing.
  if (!(await isCurrent())) return { stale: true, count: 0 };
  const body = renderComment(manifest, published, hosting);
  const marker = `<!-- visual-evidence:${manifest.project} -->`;
  const existing = comments.find((comment) => comment.body?.includes(marker));
  await github(
    existing
      ? `/repos/${owner}/${repository}/issues/comments/${existing.id}`
      : `/repos/${owner}/${repository}/issues/${manifest.target.number}/comments`,
    {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  return { stale: false, count: published.length, ...hosting };
}
