import { describe, expect, it } from "vitest";

import { safeInternalRoute } from "@/lib/safe-route";

describe("post-authentication destination", () => {
  it("keeps a valid internal route", () => {
    expect(safeInternalRoute("/org/acme-k7p2/projects", "/dashboard")).toBe(
      "/org/acme-k7p2/projects",
    );
  });

  it.each(["https://attacker.example", "//attacker.example", null])(
    "rejects an unsafe destination: %s",
    (candidate) => {
      expect(safeInternalRoute(candidate, "/dashboard")).toBe("/dashboard");
    },
  );
});
