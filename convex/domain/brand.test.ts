import { describe, expect, it } from "vitest";

import {
  defaultCollectionFormTitle,
  normalizeCollectionFormTitle,
} from "./brand";

describe("Brand settings", () => {
  it("keeps the proposed Collection Form title valid for the longest Brand name", () => {
    const name = "A".repeat(80);
    const title = defaultCollectionFormTitle(name);

    expect(title).toHaveLength(100);
    expect(normalizeCollectionFormTitle(undefined, name)).toBe(title);
  });
});
