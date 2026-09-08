import Image from "next/image";

import { productName } from "@/lib/brand";
import { cn } from "@/lib/utils";

const lockupRatio = 687 / 111;

/**
 * The official lockup (blob mark and wordmark) from `public/brand/logo.svg`,
 * with the paper-filled wordmark on dark surfaces. The mark is about the
 * height of the wordmark, so it sits quietly next to it; that also makes it
 * smaller than the mark-only lockup at the same height. Keep `height` at 26px
 * or more so the blob's eyes stay readable, and reach for `BrandMark` rather
 * than shrinking the lockup (docs/design/app-icons/DESIGN.md 10.1).
 */
export function BrandLogo({
  className,
  height = 28,
}: {
  className?: string;
  height?: number;
}) {
  const width = Math.round(height * lockupRatio);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      style={{ height }}
    >
      <Image
        alt={productName}
        className="block h-full w-auto dark:hidden"
        height={height}
        src="/brand/logo.svg"
        unoptimized
        width={width}
      />
      <Image
        alt={productName}
        className="hidden h-full w-auto dark:block"
        height={height}
        src="/brand/logo-on-dark.svg"
        unoptimized
        width={width}
      />
    </span>
  );
}
