"use client";

import { useSyncExternalStore } from "react";
import { MoonStar } from "lucide-react";

import {
  resolvedTheme,
  themeStorageKey,
  type ThemePreference,
} from "@/lib/theme";

const themeChangeEvent = "convex-admin-theme-change";

function storedTheme(): ThemePreference {
  const stored = localStorage.getItem(themeStorageKey);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

function applyTheme(preference: ThemePreference) {
  const dark = resolvedTheme(
    preference,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  document.documentElement.classList.toggle("dark", dark === "dark");
  document.documentElement.style.colorScheme = dark;
  document.documentElement.dataset.theme = preference;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const updateSystemTheme = () => {
        if (storedTheme() === "system") applyTheme("system");
        onStoreChange();
      };
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(themeChangeEvent, onStoreChange);
      media.addEventListener("change", updateSystemTheme);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(themeChangeEvent, onStoreChange);
        media.removeEventListener("change", updateSystemTheme);
      };
    },
    storedTheme,
    () => "system",
  );

  function updateTheme(nextTheme: ThemePreference) {
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return (
    <label className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
      <MoonStar aria-hidden="true" className="size-4" />
      <span className="sr-only sm:not-sr-only">Theme</span>
      <select
        aria-label="Theme"
        className="border-border bg-background text-foreground focus-visible:ring-ring h-9 rounded-lg border px-2 text-xs outline-none focus-visible:ring-2"
        onChange={(event) => updateTheme(event.target.value as ThemePreference)}
        value={theme}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
