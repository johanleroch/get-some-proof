"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";

import { Blob, type BlobExpressionName } from "@/components/brand/blob";
import { Button } from "@/components/ui/button";

const BILLING_HREF = "/account/billing" as Route;

/** The blob's two faces on the card, and how long each one stays, in ms. */
const faces: Array<{ expression: BlobExpressionName; hold: number }> = [
  { expression: "starstruck", hold: 4200 },
  { expression: "happy", hold: 1800 },
];

/**
 * The card's blob is not still: every few seconds it blinks from starstruck
 * to happy and back, the way a `Blob` changes any face, so the corner of the
 * eye catches it. It keeps one face under reduced motion.
 */
function useCyclingFace() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    // Not every environment has matchMedia (jsdom does not): treat it as no
    // preference, the cycle then runs.
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % faces.length),
      faces[index].hold,
    );
    return () => window.clearTimeout(timer);
  }, [index]);
  return faces[index].expression;
}

/**
 * The sidebar's one sale, above the user row on a Free Account only: a small
 * poster on `--brand-soft`: the promise at `subheading` ("Collect without
 * limits"), the three things Pro changes, the amber button, and the blob
 * peeking over the bottom right corner, big, cropped by the panel and tilted
 * as on `/templates`. It never says "Free plan": the sale says it. A Pro
 * Account shows nothing here, the founder's call: a paying customer is not
 * sold to from the sidebar, and the subscription lives on the billing page.
 * Two things move, on the founder's request (2026-09-09): the blob's eyes
 * change every few seconds, and a soft light sweeps the button
 * (`.cta-shine`). Chosen from six drafts (DESIGN.md section 6).
 */
export function SidebarPlanCard() {
  const expression = useCyclingFace();
  return (
    <div
      className="bg-brand-soft relative overflow-hidden rounded-lg p-3.5"
      data-slot="sidebar-plan-card"
    >
      <p className="type-subheading">Collect without limits</p>
      <p className="type-small text-ink-2 mt-1 max-w-[9rem]">
        Unlimited projects, 25 videos, no promo card.
      </p>
      <Button asChild className="cta-shine mt-3 overflow-hidden" size="sm">
        <Link href={BILLING_HREF}>Upgrade to Pro</Link>
      </Button>
      <Blob
        className="absolute -right-5 -bottom-6 -rotate-[8deg]"
        expression={expression}
        size={128}
      />
    </div>
  );
}
