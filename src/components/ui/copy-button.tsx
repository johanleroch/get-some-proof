"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { blobToast } from "@/components/brand/blob-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  children,
  variant = "default",
}: {
  value: string;
  children: string;
  variant?: "default" | "outline";
}) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    setPending(true);
    try {
      await navigator.clipboard.writeText(value);
      clearTimeout(timer.current);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 2000);
      blobToast.success("Copied to clipboard.", { id: "clipboard" });
    } catch {
      clearTimeout(timer.current);
      setCopied(false);
      blobToast.error("Could not copy. Select and copy the text manually.", {
        id: "clipboard",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      onClick={() => void copy()}
      data-copy-state={copied ? "copied" : "idle"}
    >
      <span className="relative size-4 shrink-0" aria-hidden="true">
        <IconCopy
          className={cn(
            "absolute inset-0 size-4 transition-all duration-200 motion-reduce:transition-none",
            copied ? "scale-75 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <IconCheck
          className={cn(
            "absolute inset-0 size-4 transition-all duration-200 motion-reduce:transition-none",
            copied ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        />
      </span>
      {children}
    </Button>
  );
}
