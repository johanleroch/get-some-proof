import { expect, it } from "vitest";
import { assistantConnectionCommands } from "./assistant-import-instructions";

it("copies the canonical production MCP URL even with the legacy apex origin", () => {
  expect(assistantConnectionCommands("codex", "https://getsomeproof.com")).toBe(
    "codex mcp add get-some-proof --url https://www.getsomeproof.com/mcp\ncodex mcp login get-some-proof --scopes testimonials:import:assistant,offline_access",
  );
});

it("preserves development and custom origins", () => {
  for (const origin of ["http://localhost:3912", "https://proof.example"]) {
    expect(assistantConnectionCommands("codex", origin)).toContain(
      `${origin}/mcp`,
    );
  }
});
