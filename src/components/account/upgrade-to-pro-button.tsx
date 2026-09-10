import type { Route } from "next";
import Link from "next/link";

import { Sparkle } from "@/components/doodles";
import { Button } from "@/components/ui/button";

/**
 * The one button in the dashboard that sells (DESIGN.md section 6): the
 * primary amber fill so it is never mistaken for a door, and the sparkle
 * that lights every illustration drawn on it in ink as its icon, the same
 * hand as the drawings around it. It does not move on hover: DESIGN.md
 * section 8 keeps hover to colour, and the press is the button's own.
 * Shown on a Free Account; a Pro Account gets an outline "Manage
 * subscription" instead, because that is a door, not a sale.
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
    <Button asChild className={className} size={size}>
      <Link href={href}>
        <Sparkle aria-hidden="true" className="size-4" />
        Upgrade to Pro
      </Link>
    </Button>
  );
}
