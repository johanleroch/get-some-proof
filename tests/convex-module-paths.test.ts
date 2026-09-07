// @vitest-environment node
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

// Convex validates every deployed module, including helpers with no functions.
// Mirror the filename exclusions in the pinned CLI's bundler entryPoints().
// Server rule: get-convex/convex-backend, crates/sync_types/src/path.rs.
it("keeps Convex module paths valid for deployment", () => {
  const root = fileURLToPath(new URL("../convex/", import.meta.url));
  const invalid = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(root, path.join(entry.parentPath, entry.name)),
    )
    .filter((file) => {
      const name = path.basename(file);
      return (
        /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(name) &&
        !file.startsWith(`_generated${path.sep}`) &&
        !name.startsWith(".") &&
        !name.startsWith("#") &&
        name !== "schema.ts" &&
        name !== "schema.js" &&
        (name.match(/\./g) ?? []).length === 1
      );
    })
    .filter((file) =>
      file.split(path.sep).some((part) => !/^[a-zA-Z0-9_.]+$/.test(part)),
    );
  expect(
    invalid,
    "Convex module paths cannot contain hyphens or other special characters",
  ).toEqual([]);
});
