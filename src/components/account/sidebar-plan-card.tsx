import type { Route } from "next";
import Link from "next/link";

import { Blob } from "@/components/brand/blob";
import { Button } from "@/components/ui/button";

const BILLING_HREF = "/account/billing" as Route;

/**
 * The sidebar's one sale, above the user row on a Free Account only: a small
 * poster on `--brand-soft`: the promise at `subheading` ("Collect without
 * limits"), the three things Pro changes, the amber button, and the blob
 * peeking over the bottom right
 * corner, big, starstruck, cropped by the panel and tilted as on
 * `/templates`. It never says "Free plan": the sale says it. A Pro Account
 * shows nothing here, the founder's call: a paying customer is not sold to
 * from the sidebar, and the subscription lives on the billing page. Chosen on
 * 2026-09-09 from six drafts (DESIGN.md section 6).
 */
export function SidebarPlanCard() {
  return (
    <div
      className="bg-brand-soft relative overflow-hidden rounded-lg p-3.5"
      data-slot="sidebar-plan-card"
    >
      <p className="type-subheading">Collect without limits</p>
      <p className="type-small text-ink-2 mt-1 max-w-[9rem]">
        Unlimited projects, 25 videos, no promo card.
      </p>
      <Button asChild className="mt-3" size="sm">
        <Link href={BILLING_HREF}>Upgrade to Pro</Link>
      </Button>
      <Blob
        className="absolute -right-5 -bottom-6 -rotate-[8deg]"
        expression="starstruck"
        size={128}
      />
    </div>
  );
}
