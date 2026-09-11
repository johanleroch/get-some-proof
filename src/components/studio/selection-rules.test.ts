import { describe, expect, it } from "vitest";
import { selectAllWithinLimit } from "./selection-rules";

describe("selectAllWithinLimit", () => {
  it("keeps choices outside a filter and fills only the available places", () => {
    const outside = Array.from(
      { length: 30 },
      (_, index) => `outside-${index}`,
    );
    const matching = Array.from(
      { length: 30 },
      (_, index) => `matching-${index}`,
    );

    const selected = selectAllWithinLimit(outside, matching);

    expect(selected).toHaveLength(50);
    expect(selected).toEqual(expect.arrayContaining(outside));
    expect(selected.filter((id) => id.startsWith("matching-"))).toHaveLength(
      20,
    );
  });

  it("selects at most the first 50 candidates", () => {
    const matching = Array.from(
      { length: 60 },
      (_, index) => `matching-${index}`,
    );

    expect(selectAllWithinLimit([], matching)).toEqual(matching.slice(0, 50));
  });

  it("preserves selections outside the filter while capacity remains", () => {
    expect(selectAllWithinLimit(["outside"], ["matching"])).toEqual([
      "outside",
      "matching",
    ]);
  });
});
