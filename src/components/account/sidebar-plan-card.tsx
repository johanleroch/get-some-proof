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
 * Account gets a matching poster with shared usage instead.
 * Two things move, on the founder's request (2026-09-09): the blob's eyes
 * change every few seconds, and a soft light sweeps the button
 * (`.cta-shine`). Chosen from six drafts (DESIGN.md section 6).
 */
export function SidebarPlanCard() {
  const expression = useCyclingFace();
  return (
    <div
      className="bg-brand-soft relative overflow-hidden rounded-lg p-3"
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
        className="pointer-events-none absolute -right-5 -bottom-6 -rotate-[8deg]"
        expression={expression}
        size={128}
      />
    </div>
  );
}

export type SidebarPlanUsage = {
  readyVideos: number;
  reservedVideos: number;
  videoLimit?: number;
  textTestimonials?: number;
  textTestimonialsIsLowerBound?: boolean;
  organizations?: number;
  organizationsIsLowerBound?: boolean;
};

function count(value?: number, lowerBound?: boolean) {
  return value === undefined ? "—" : `${value}${lowerBound ? "+" : ""}`;
}

export function SidebarProPlanCard({ usage }: { usage?: SidebarPlanUsage }) {
  const expression = useCyclingFace();
  const remaining =
    usage?.videoLimit === undefined
      ? undefined
      : Math.max(
          0,
          usage.videoLimit - usage.readyVideos - usage.reservedVideos,
        );
  return (
    <div
      className="bg-brand-soft relative overflow-hidden rounded-lg p-3"
      data-slot="sidebar-pro-plan-card"
    >
      <div className="relative min-h-20 pr-20">
        <p className="type-subheading">You&apos;re Pro!</p>
        <p className="type-small text-ink-2 mt-1">Across all your projects</p>
      </div>
      <Blob
        className="pointer-events-none absolute -top-2 -right-3 -rotate-[8deg]"
        expression={expression}
        size={104}
      />
      <div className="mt-2">
        <div className="type-ui flex items-baseline justify-between gap-2">
          <span>Videos</span>
          <span className="tabular-nums">
            {count(usage?.readyVideos)}{" "}
            <span className="text-ink-2">/ {count(usage?.videoLimit)}</span>
          </span>
        </div>
        {usage?.videoLimit !== undefined ? (
          <>
            <meter
              className="sr-only"
              aria-label="Video slots used"
              min={0}
              max={usage.videoLimit}
              value={Math.min(
                usage.videoLimit,
                usage.readyVideos + usage.reservedVideos,
              )}
            />
            <div
              className="bg-surface mt-2 h-1.5 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <div
                className="bg-brand h-full rounded-full"
                style={{
                  width: `${Math.min(100, ((usage.readyVideos + usage.reservedVideos) / usage.videoLimit) * 100)}%`,
                }}
              />
            </div>
          </>
        ) : null}
        <p className="type-small text-ink-2 mt-1.5">
          {remaining === undefined
            ? "Loading usage…"
            : `${remaining} video ${remaining === 1 ? "slot" : "slots"} left`}
        </p>
        {usage && usage.reservedVideos > 0 ? (
          <p className="type-small text-ink-2">
            {usage.reservedVideos} reserved
          </p>
        ) : null}
      </div>
      <dl className="type-small mt-3 space-y-2">
        <div className="flex justify-between gap-2">
          <dt>Text testimonials</dt>
          <dd className="font-semibold tabular-nums">
            {count(
              usage?.textTestimonials,
              usage?.textTestimonialsIsLowerBound,
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Projects</dt>
          <dd className="font-semibold tabular-nums">
            {count(usage?.organizations, usage?.organizationsIsLowerBound)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
