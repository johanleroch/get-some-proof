"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

// Toasts sit on --surface with the warm float shadow and use the semantic
// status tokens for their icons, instead of sonner's built-in rich colors.
export function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<ToasterProps["theme"]>("system");

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () =>
      setTheme(root.classList.contains("dark") ? "dark" : "light");

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributeFilter: ["class"], attributes: true });
    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      closeButton
      position="top-right"
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-border": "var(--line)",
          "--normal-text": "var(--ink)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      theme={theme}
      toastOptions={{
        classNames: {
          description: "!text-ink-2",
          error: "[&_[data-icon]]:text-danger",
          info: "[&_[data-icon]]:text-info",
          success: "[&_[data-icon]]:text-success",
          title: "!font-semibold !tracking-[-0.008em]",
          toast: "!shadow-float !font-sans",
          warning: "[&_[data-icon]]:text-warning",
        },
      }}
      {...props}
    />
  );
}
