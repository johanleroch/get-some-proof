import { afterEach, describe, expect, it, vi } from "vitest";

import { getMetadataBase } from "./seo";

afterEach(() => vi.unstubAllEnvs());

describe("metadata origin", () => {
  it.each(["", "not a URL", "javascript:alert(1)"])(
    "does not break the setup screen for invalid configuration %s",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
      expect(getMetadataBase().href).toBe("https://www.getsomeproof.com/");
    },
  );
  it("uses only the configured public origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com/path?query=1");
    expect(getMetadataBase().href).toBe("https://example.com/");
  });
});
