import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  readThemePreference,
  resolvedTheme,
  themeInitializationScript,
  themeStorageKey,
} from "./theme";

describe("resolvedTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
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

  it("ships light without a stored preference, whatever the system says", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    expect(readThemePreference()).toBe("light");
    Function(themeInitializationScript)();

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("still honours a stored system preference", () => {
    localStorage.setItem(themeStorageKey, "system");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    expect(readThemePreference()).toBe("system");
    Function(themeInitializationScript)();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("system");
  });
});
