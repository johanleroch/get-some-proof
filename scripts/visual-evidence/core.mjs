import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const SAFE_TITLE = /^[A-Za-z0-9][A-Za-z0-9 .:()/_-]{0,119}$/;
const SHA = /^[0-9a-f]{40}$/;
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

export function assertSafeSegment(value, label) {
  if (typeof value !== "string" || !SAFE_SEGMENT.test(value)) {
    throw new Error(`${label} is not a safe path segment`);
  }
  return value;
}

export function validateTrustedConfig(config) {
  assertSafeSegment(config.project, "project");
  assertSafeSegment(config.bucket, "bucket");
  for (const [label, value] of [
    ["endpoint", config.endpoint],
    ["publicBaseUrl", config.publicBaseUrl],
  ]) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error(`${label} must be a credential-free HTTPS URL`);
    }
  }
  if (!Array.isArray(config.screens) || config.screens.length === 0) {
    throw new Error("The visual evidence config must define screens");
  }
  for (const screen of config.screens) {
    if (!SAFE_TITLE.test(screen.title ?? "")) {
      throw new Error(`Invalid screenshot title: ${screen.slug ?? "unknown"}`);
    }
  }
  return config;
}

export function validateManifest(
  manifest,
  expectedRepository,
  expectedProject,
) {
  if (manifest?.schemaVersion !== 1) {
    throw new Error("Unsupported visual evidence manifest");
  }
  if (manifest.repository !== expectedRepository) {
    throw new Error("Manifest repository does not match this workflow");
  }

  assertSafeSegment(manifest.project, "project");
  if (expectedProject && manifest.project !== expectedProject) {
    throw new Error(
      "Manifest project does not match the trusted configuration",
    );
  }
  if (!SHA.test(manifest.headSha ?? "")) {
    throw new Error("Manifest head SHA is invalid");
  }
  if (
    !Number.isSafeInteger(manifest.target?.number) ||
    manifest.target.number < 1
  ) {
    throw new Error("Manifest target number is invalid");
  }
  if (!["pull", "issue"].includes(manifest.target?.kind)) {
    throw new Error("Manifest target kind is invalid");
  }
  if (
    !Array.isArray(manifest.screenshots) ||
    manifest.screenshots.length === 0
  ) {
    throw new Error("Manifest contains no screenshots");
  }

  const paths = new Set();
  for (const screenshot of manifest.screenshots) {
    const parts = screenshot.path?.split("/") ?? [];
    if (
      parts.length !== 2 ||
      !parts.every((part) => SAFE_SEGMENT.test(part)) ||
      !screenshot.path.endsWith(".png")
    ) {
      throw new Error(`Unsafe screenshot path: ${screenshot.path}`);
    }
    if (paths.has(screenshot.path)) {
      throw new Error(`Duplicate screenshot path: ${screenshot.path}`);
    }
    paths.add(screenshot.path);
    if (!SAFE_TITLE.test(screenshot.title ?? "")) {
      throw new Error(`Invalid screenshot title: ${screenshot.path}`);
    }
    if (screenshot.viewport !== parts[0]) {
      throw new Error(
        `Screenshot viewport does not match its path: ${screenshot.path}`,
      );
    }
  }

  return manifest;
}

export async function loadAndValidateArtifact(
  root,
  expectedRepository,
  expectedProject,
) {
  const resolvedRoot = await realpath(root);
  const manifestPath = path.join(resolvedRoot, "manifest.json");
  const manifest = validateManifest(
    JSON.parse(await readFile(manifestPath, "utf8")),
    expectedRepository,
    expectedProject,
  );

  for (const screenshot of manifest.screenshots) {
    const candidate = path.join(resolvedRoot, screenshot.path);
    const resolvedCandidate = await realpath(candidate);
    if (!resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error(
        `Screenshot escaped the artifact root: ${screenshot.path}`,
      );
    }
    const stat = await lstat(resolvedCandidate);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Screenshot is not a regular file: ${screenshot.path}`);
    }
    if (stat.size < 1 || stat.size > MAX_SCREENSHOT_BYTES) {
      throw new Error(`Screenshot has an invalid size: ${screenshot.path}`);
    }
    screenshot.absolutePath = resolvedCandidate;
  }

  return manifest;
}

export async function listPngFiles(root, prefix = "") {
  const directory = path.join(root, prefix);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listPngFiles(root, relative)));
    } else if (entry.isFile() && entry.name.endsWith(".png")) {
      files.push(relative);
    }
  }
  return files.sort();
}

export function objectKeyFor(manifest, screenshot) {
  return [
    manifest.project,
    `${manifest.target.kind}s`,
    String(manifest.target.number),
    manifest.headSha,
    screenshot.path,
  ].join("/");
}

export async function listIssueComments(
  github,
  owner,
  repository,
  targetNumber,
) {
  const comments = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await github(
      `/repos/${owner}/${repository}/issues/${targetNumber}/comments?per_page=100&page=${page}`,
    );
    comments.push(...batch);
    if (batch.length < 100) return comments;
  }
  throw new Error("Too many comments to synchronize safely");
}

export function renderComment(manifest, publishedScreenshots) {
  const marker = `<!-- visual-evidence:${manifest.project} -->`;
  const shortSha = manifest.headSha.slice(0, 7);
  const images = publishedScreenshots
    .map(
      ({ title, viewport, url }) =>
        `### ${title} · ${viewport}\n\n[![${title} on ${viewport}](${url})](${url})`,
    )
    .join("\n\n");

  const targetLabel = manifest.target.kind === "pull" ? "la PR" : "l’issue";
  return `${marker}\n## Visual evidence\n\nCaptures automatiques du commit \`${shortSha}\`. Elles remplacent les captures précédentes de ${targetLabel}.\n\n${images}`;
}
