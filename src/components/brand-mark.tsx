import { GalleryVerticalEnd } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg",
        className,
      )}
    >
      <GalleryVerticalEnd className="size-4" />
    </span>
  );
}
