import Image from "next/image";

import { cn } from "@/lib/utils";

/** The blob mark alone (`public/brand/logo-mark.svg`), for tight spots. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
      height={32}
      src="/brand/logo-mark.svg"
      unoptimized
      width={32}
    />
  );
}
