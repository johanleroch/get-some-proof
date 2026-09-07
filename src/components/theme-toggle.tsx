"use client";

import { useSyncExternalStore } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

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
    () => "system",
  );

  function updateTheme(nextTheme: ThemePreference) {
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Laptop;

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
            <Sun aria-hidden="true" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Laptop aria-hidden="true" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
