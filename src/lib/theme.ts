export const themeStorageKey = "get-some-proof-theme";
export const themeChangeEvent = "get-some-proof-theme-change";

export type ThemePreference = "light" | "dark" | "system";

export function resolvedTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
) {
  return preference === "system"
    ? systemPrefersDark
      ? "dark"
      : "light"
    : preference;
}

/**
 * Light unless a preference was stored. The product ships no theme control
 * for now (decided 2026-09-09); the dark theme stays in the tokens and the
 * development pages can still set it, so a stored "dark" or "system" is
 * honoured.
 */
export const defaultThemePreference: ThemePreference = "light";

export function readThemePreference(
  storage: Pick<Storage, "getItem"> = localStorage,
): ThemePreference {
  const stored = storage.getItem(themeStorageKey);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : defaultThemePreference;
}

export function applyThemePreference(
  root: HTMLElement,
  preference: ThemePreference,
  systemPrefersDark: boolean,
) {
  const theme = resolvedTheme(preference, systemPrefersDark);
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  root.dataset.theme = preference;
}

export const themeInitializationScript = `(() => {
  try {
    const stored = localStorage.getItem("${themeStorageKey}");
    const preference = stored === "light" || stored === "dark" || stored === "system" ? stored : "${defaultThemePreference}";
    const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = preference;
  } catch {}
})();`;
