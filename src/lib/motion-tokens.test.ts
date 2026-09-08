import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  durationTokens,
  easeCss,
  easeOvershoot,
  easePath,
  easeTokens,
} from "@/lib/motion-tokens";

const root = process.cwd();
const globalStyles = readFileSync(resolve(root, "src/app/globals.css"), "utf8");

/**
 * The mascot is where the hand comes from: its curves are tuned frame by
 * frame and live with the animation they belong to. The charts are a vendored
 * area with their own easing. Everything else uses the tokens.
 */
const rawEasingAllowed = [
  "src/app/globals.css",
  "src/components/brand/blob.tsx",
  "src/components/charts",
  "src/lib/blob-animations.ts",
  "src/lib/motion-tokens.ts",
  "src/lib/motion-tokens.test.ts",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(entry) ? [full] : [];
  });
}

describe("motion vocabulary", () => {
  it("declares every catalogued curve and duration in globals.css", () => {
    for (const token of easeTokens) {
      expect(globalStyles).toContain(`${token.variable}: ${easeCss(token)};`);
    }
    for (const token of durationTokens) {
      expect(globalStyles).toContain(`${token.variable}: ${token.value};`);
    }
  });

  it("overshoots enough to read as alive, and only where it should", () => {
    const overshoot = (variable: string) =>
      easeOvershoot(easeTokens.find((token) => token.variable === variable)!);

    // Below 3 percent the eye reads the move as linear, which is the whole
    // thing this vocabulary exists to avoid.
    expect(overshoot("--ease-settle")).toBeGreaterThanOrEqual(8);
    expect(overshoot("--ease-settle-soft")).toBeGreaterThanOrEqual(3);
    // Mass: the heavier curve always settles closer to its mark.
    expect(overshoot("--ease-settle")).toBeGreaterThan(
      overshoot("--ease-settle-soft"),
    );
    // Nothing that only fades, and nothing leaving, ever overshoots.
    expect(overshoot("--ease-out-soft")).toBe(0);
    expect(overshoot("--ease-exit")).toBe(0);
    expect(overshoot("--ease-sine")).toBe(0);
  });

  it("plots the overshoot outside the guide box", () => {
    const settle = easeTokens.find(
      (token) => token.variable === "--ease-settle",
    )!;
    const flat = easeTokens.find(
      (token) => token.variable === "--ease-out-soft",
    )!;
    expect(easePath(settle)).toMatch(/-\d/);
    expect(easePath(flat)).not.toMatch(/-\d/);
  });

  it("keeps raw cubic-beziers out of the interface", () => {
    const offenders = sourceFiles(resolve(root, "src"))
      .map((file) => relative(root, file))
      .filter(
        (file) =>
          !rawEasingAllowed.some((allowed) => file.startsWith(allowed)) &&
          readFileSync(resolve(root, file), "utf8").includes("cubic-bezier"),
      );
    expect(offenders).toEqual([]);
  });

  it("gives arriving surfaces a settle curve and leaving ones the exit curve", () => {
    const overlays = [
      "src/components/ui/dropdown-menu.tsx",
      "src/components/ui/popover.tsx",
      "src/components/ui/select.tsx",
      "src/components/ui/tooltip.tsx",
      "src/components/ui/dialog.tsx",
      "src/components/ui/alert-dialog.tsx",
      "src/components/ui/sheet.tsx",
    ];
    for (const file of overlays) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source).toMatch(
        /data-\[state=open\]:ease-\[var\(--ease-settle(-soft)?\)\]/,
      );
      expect(source).toContain("data-[state=closed]:ease-[var(--ease-exit)]");
    }
  });

  it("moves the toast in two beats without fighting sonner's gestures", () => {
    expect(globalStyles).toContain("@keyframes toast-bubble-in");
    expect(globalStyles).toContain("@keyframes toast-mascot-in");
    // Sonner keeps its own instant transition while a toast is being swiped.
    expect(globalStyles).toContain('[data-swiping="true"]');
    // Volume is preserved: the two scale values of a squash never match.
    const squashes = [
      ...globalStyles.matchAll(/scale\((0\.\d+|1\.\d+), (0\.\d+|1\.\d+)\)/g),
    ];
    expect(squashes.length).toBeGreaterThan(0);
    for (const [, x, y] of squashes) {
      expect(x).not.toBe(y);
    }
  });
});
