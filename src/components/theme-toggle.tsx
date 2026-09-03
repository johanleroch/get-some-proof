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
  resolvedTheme,
  themeStorageKey,
  type ThemePreference,
} from "@/lib/theme";

const themeChangeEvent = "get-some-proof-theme-change";

function storedTheme(): ThemePreference {
  const stored = localStorage.getItem(themeStorageKey);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

function applyTheme(preference: ThemePreference) {
  const dark = resolvedTheme(
    preference,
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );
  document.documentElement.classList.toggle("dark", dark === "dark");
  document.documentElement.style.colorScheme = dark;
  document.documentElement.dataset.theme = preference;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia?.("(prefers-color-scheme: dark)");
      const updateSystemTheme = () => {
        if (storedTheme() === "system") applyTheme("system");
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
    storedTheme,
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
