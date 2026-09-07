"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

// Toasts appear top right. The mascot toasts draw their own bubble
// (blob-toast.tsx); sonner keeps position, stacking, timing and swipe.
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
      mobileOffset={16}
      offset={20}
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
          // Custom (unstyled) toasts draw their own bubble; the float shadow
          // only belongs to the toasts sonner still styles itself.
          toast: "!font-sans data-[styled=true]:!shadow-float",
          warning: "[&_[data-icon]]:text-warning",
        },
      }}
      {...props}
    />
  );
}
