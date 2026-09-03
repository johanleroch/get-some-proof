import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  resolve(process.cwd(), "src/components/ui/dropdown-menu.tsx"),
  "utf8",
);
const globalStyles = readFileSync(
  resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);

describe("dropdown motion", () => {
  it("ships both state-aware menu classes and the Tailwind v4 animation engine", () => {
    expect(componentSource).toContain("data-[state=open]:animate-in");
    expect(componentSource).toContain("data-[state=closed]:animate-out");
    expect(globalStyles).toContain('@import "tw-animate-css"');
  });
});
