export const themeStorageKey = "get-some-proof-theme";

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

export const themeInitializationScript = `(() => {
  try {
    const stored = localStorage.getItem("${themeStorageKey}");
    const preference = stored === "light" || stored === "dark" ? stored : "system";
    const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = preference;
  } catch {}
})();`;
