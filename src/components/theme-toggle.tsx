"use client";

import { useSyncExternalStore } from "react";
import { IconDeviceLaptop, IconMoon, IconSun } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  applyThemePreference,
  defaultThemePreference,
  readThemePreference,
  themeChangeEvent,
  themeStorageKey,
  type ThemePreference,
} from "@/lib/theme";

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyTheme(preference: ThemePreference) {
  applyThemePreference(
    document.documentElement,
    preference,
    systemPrefersDark(),
  );
}

/**
 * Light, Dark or System. Out of the product for now (DESIGN.md section 6:
 * the app ships light, the dark theme waits in the tokens); the development
 * pages keep it so both themes stay reviewed.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia?.("(prefers-color-scheme: dark)");
      const updateSystemTheme = () => {
        if (readThemePreference() === "system") applyTheme("system");
        onStoreChange();
      };
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(themeChangeEvent, onStoreChange);
      media?.addEventListener("change", updateSystemTheme);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(themeChangeEvent, onStoreChange);
        media?.removeEventListener("change", updateSystemTheme);
      };
    },
    readThemePreference,
    () => defaultThemePreference,
  );

  function updateTheme(nextTheme: ThemePreference) {
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  const Icon =
    theme === "light"
      ? IconSun
      : theme === "dark"
        ? IconMoon
        : IconDeviceLaptop;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Theme" size="icon-sm" variant="ghost">
          <Icon aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          onValueChange={(value) => updateTheme(value as ThemePreference)}
          value={theme}
        >
          <DropdownMenuRadioItem value="light">
            <IconSun aria-hidden="true" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <IconMoon aria-hidden="true" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <IconDeviceLaptop aria-hidden="true" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
