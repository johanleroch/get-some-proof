import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  isKnownScreenSlug,
  isScreenStatus,
  screenSections,
  type ScreenStatus,
  type ScreenStatuses,
} from "@/lib/screens-catalog";

/**
 * Review statuses for the development-only `/screens` gallery live in a small
 * JSON file at the repository root so they are shared through git rather than
 * kept in one browser.
 */
export const screenStatusFileName = "screens-status.json";

export function screenStatusFilePath(directory = process.cwd()) {
  return path.join(directory, screenStatusFileName);
}

export function parseScreenStatuses(raw: string): ScreenStatuses {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const statuses: ScreenStatuses = {};
  for (const [slug, status] of Object.entries(parsed)) {
    if (isScreenStatus(status) && isKnownScreenSlug(slug, screenSections)) {
      statuses[slug] = status;
    }
  }
  return statuses;
}

export async function readScreenStatuses(
  filePath = screenStatusFilePath(),
): Promise<ScreenStatuses> {
  try {
    return parseScreenStatuses(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

export async function writeScreenStatus(
  slug: string,
  status: ScreenStatus | null,
  filePath = screenStatusFilePath(),
): Promise<ScreenStatuses> {
  const statuses = await readScreenStatuses(filePath);
  if (status === null) {
    delete statuses[slug];
  } else {
    statuses[slug] = status;
  }
  const sorted = Object.fromEntries(
    Object.entries(statuses).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  await writeFile(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  return sorted;
}
