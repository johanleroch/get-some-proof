"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

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
      richColors
      theme={theme}
      {...props}
    />
  );
}
