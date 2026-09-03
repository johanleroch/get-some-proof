import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

type Version = {
  major: number;
  minor: number;
};

const minimumNodeByPnpmMajor: Record<number, Version> = {
  11: { major: 22, minor: 13 },
};

function parseMajorMinor(version: string): Version {
  const match = version.match(/^(?:>=)?(\d+)(?:\.(\d+))?/);

  if (!match) {
    throw new Error(`Unsupported version declaration: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
  };
}

function isAtLeast(actual: Version, minimum: Version) {
  return (
    actual.major > minimum.major ||
    (actual.major === minimum.major && actual.minor >= minimum.minor)
  );
}

describe("repository toolchain", () => {
  it("keeps the local Node runtime compatible with the pinned pnpm release", () => {
    const packageJson = JSON.parse(
      readFileSync(join(repositoryRoot, "package.json"), "utf8"),
    ) as {
      packageManager: string;
      engines: { node: string };
    };
    const nodeVersion = readFileSync(
      join(repositoryRoot, ".nvmrc"),
      "utf8",
    ).trim();
    const ciWorkflow = readFileSync(
      join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    );

    const pnpmMatch = packageJson.packageManager.match(
      /^pnpm@(\d+)\.\d+\.\d+$/,
    );
    expect(pnpmMatch).not.toBeNull();

    const pnpmMajor = Number(pnpmMatch?.[1]);
    const minimumNode = minimumNodeByPnpmMajor[pnpmMajor];
    expect(
      minimumNode,
      `Record the supported Node range before adopting pnpm ${pnpmMajor}`,
    ).toBeDefined();

    const localNode = parseMajorMinor(nodeVersion);
    const declaredNode = parseMajorMinor(packageJson.engines.node);

    expect(isAtLeast(localNode, minimumNode)).toBe(true);
    expect(isAtLeast(declaredNode, minimumNode)).toBe(true);
    expect(localNode.major).toBe(declaredNode.major);
    expect(ciWorkflow).toContain("node-version-file: .nvmrc");

    const pinnedPnpmVersion = packageJson.packageManager.slice("pnpm@".length);
    expect(ciWorkflow).not.toContain(`version: ${pinnedPnpmVersion}`);
  });
});
