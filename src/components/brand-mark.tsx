import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
      height={32}
      src="/icon.svg"
      unoptimized
      width={32}
    />
  );
}
