import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolvedTheme,
  themeInitializationScript,
  themeStorageKey,
} from "./theme";

describe("resolvedTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    delete document.documentElement.dataset.theme;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it("resolves explicit and system preferences", () => {
    expect(resolvedTheme("light", true)).toBe("light");
    expect(resolvedTheme("dark", false)).toBe("dark");
    expect(resolvedTheme("system", true)).toBe("dark");
    expect(resolvedTheme("system", false)).toBe("light");
  });

  it("applies the persisted preference synchronously before hydration", () => {
    localStorage.setItem(themeStorageKey, "dark");

    Function(themeInitializationScript)();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
