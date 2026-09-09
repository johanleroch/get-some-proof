import type { Route } from "next";
import Link from "next/link";

import { Sparkle } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one button in the dashboard that sells. DESIGN.md section 7 gives it
 * the primary amber fill so it is never mistaken for a door, and the sparkle
 * that lights every illustration sits on it in ink, the same hand as the
 * drawings around it. On hover the sparkle turns a touch and grows, transform
 * only, and stays still under reduced motion. Shown on a Free Account; a Pro
 * Account gets an outline "Manage subscription" instead, because that is a
 * door, not a sale.
 */
export function UpgradeToProButton({
  className,
  href,
  size = "default",
}: {
  className?: string;
  href: Route;
  size?: "default" | "lg" | "sm";
}) {
  return (
    <Button asChild className={cn("group/upgrade", className)} size={size}>
      <Link href={href}>
        <Sparkle
          aria-hidden="true"
          className="size-4 transition-transform duration-[var(--motion-base)] ease-[var(--ease-settle)] group-hover/upgrade:scale-125 group-hover/upgrade:-rotate-12 motion-reduce:transition-none"
        />
        Upgrade to Pro
      </Link>
    </Button>
  );
}
