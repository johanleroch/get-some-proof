"use client";

import { useSyncExternalStore } from "react";

import { applyThemePreference, readThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Controls shared by the development pages (`/screens`, `/kit/onboarding`):
 * a remembered choice, the small segmented control of their headers, and
 * the theme hand-off to a same-origin preview frame.
 */

/**
 * A choice remembered in localStorage and shared across the page through a
 * custom event, so `useSyncExternalStore` can read it without effects.
 */
export function storedChoice<T extends string>(
  storageKey: string,
  values: readonly T[],
  fallback: T,
) {
  const changeEvent = `${storageKey}-change`;
  return {
    fallback,
    read(): T {
      try {
        const stored = localStorage.getItem(storageKey);
        return values.includes(stored as T) ? (stored as T) : fallback;
      } catch {
        return fallback;
      }
    },
    subscribe(onStoreChange: () => void) {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(changeEvent, onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(changeEvent, onStoreChange);
      };
    },
    write(next: T) {
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // Storage can be unavailable; the event still updates this visit.
      }
      window.dispatchEvent(new Event(changeEvent));
    },
  };
}

export function useStoredChoice<T extends string>(
  store: ReturnType<typeof storedChoice<T>>,
) {
  return useSyncExternalStore(
    store.subscribe,
    store.read,
    () => store.fallback,
  );
}

export function applyThemeToFrame(frame: HTMLIFrameElement) {
  try {
    const root = frame.contentDocument?.documentElement;
    if (!root) return;
    applyThemePreference(
      root,
      readThemePreference(),
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
    );
  } catch {
    // Cross-origin frames cannot be themed; every preview frame is same-origin.
  }
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: T) => void;
  options: Array<{ disabled?: boolean; label: string; value: T }>;
  value: T;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="bg-muted inline-flex items-center gap-0.5 rounded-md p-0.5"
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          aria-checked={option.value === value}
          className={cn(
            "focus-visible:ring-ring/50 h-7 rounded-[5px] px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40",
            option.value === value
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
          disabled={option.disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="radio"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
