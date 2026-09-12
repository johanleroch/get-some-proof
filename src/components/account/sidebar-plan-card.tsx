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

/**
 * A count the backend may only have bounded, and which is never allowed to
 * fall back to zero while it is unknown: an account that has collected
 * nothing and an account whose usage has not loaded must not read alike.
 */
function count(value?: number, lowerBound?: boolean) {
  return value === undefined ? "—" : `${value}${lowerBound ? "+" : ""}`;
}

/** Stored videos plus the slots held while an upload finishes processing. */
function storedVideos(usage?: SidebarPlanUsage) {
  return usage === undefined
    ? undefined
    : usage.readyVideos + usage.reservedVideos;
}

function remainingVideos(usage?: SidebarPlanUsage) {
  const stored = storedVideos(usage);
  return usage?.videoLimit === undefined || stored === undefined
    ? undefined
    : Math.max(0, usage.videoLimit - stored);
}

/** What the figures cannot say: what is left, and what is holding a slot. */
function storageNote(usage?: SidebarPlanUsage) {
  const remaining = remainingVideos(usage);
  if (remaining === undefined) return "Reading your usage…";
  if (remaining === 0) return "Storage full — delete a video to free a slot";
  const slots = `${remaining} slot${remaining === 1 ? "" : "s"} left`;
  return usage && usage.reservedVideos > 0
    ? `${slots} · ${usage.reservedVideos} processing`
    : slots;
}

/**
 * The video allowance as a bar: an amber fill on a track one step darker
 * than the paper, and a real `meter` for anyone listening rather than
 * looking. An unknown allowance shows the empty track, never a zero fill.
 */
function VideoQuotaBar({ usage }: { usage?: SidebarPlanUsage }) {
  const stored = storedVideos(usage);
  if (usage?.videoLimit === undefined || stored === undefined) {
    return (
      <div
        aria-hidden="true"
        className="bg-surface-2 mt-1.5 h-1 rounded-full"
      />
    );
  }
  const filled = Math.min(usage.videoLimit, stored);
  return (
    <>
      <meter
        aria-label="Video storage used"
        className="sr-only"
        max={usage.videoLimit}
        min={0}
        value={filled}
      />
      <div
        aria-hidden="true"
        className="bg-surface-2 mt-1.5 h-1 overflow-hidden rounded-full"
      >
        <div
          className="bg-brand h-full rounded-full"
          style={{
            width: `${Math.max(2, (filled / usage.videoLimit) * 100)}%`,
          }}
        />
      </div>
    </>
  );
}

/**
 * On a Pro Account the footer sells nothing, so it is not a card: the usage
 * sits on the sidebar's own paper as the last line before the user row, at
 * the navigation's own inset. Three labelled rows share one right-hand
 * column of tabular figures — Videos, capped, carries the bar that measures
 * it; Text Testimonials and Projects are uncapped and simply counted. The
 * row label is what gives the limit its unit (25 videos, not 25 of
 * something), and one `--ink-3` line under the bar carries what a figure
 * cannot: the slots left and the ones held while a video processes. It
 * opens on no title at all — the rows are labelled, so a caption above them
 * only announced that a block existed, and the plan is named on the
 * dashboard's own plan panel. No blob, no sale, no billing link (founder,
 * 2026-09-12); shape chosen by the founder on 2026-09-13 from four drafts
 * (rows, one number, tinted strip, footnote), then four ways of grouping the
 * rows, then four ways of opening them.
 */
export function SidebarProPlanCard({ usage }: { usage?: SidebarPlanUsage }) {
  const stored = storedVideos(usage);
  return (
    <div className="px-3 py-2" data-slot="sidebar-pro-plan-card">
      <div className="type-ui flex items-baseline justify-between gap-2">
        <span>Videos</span>
        <span className="font-mono tabular-nums">
          {count(usage?.videoLimit === undefined ? undefined : stored)}
          <span className="text-ink-3">/{count(usage?.videoLimit)}</span>
        </span>
      </div>
      <VideoQuotaBar usage={usage} />
      <p className="type-small text-ink-3 mt-1.5">{storageNote(usage)}</p>
      <dl className="type-ui mt-2 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-2 font-normal">Text Testimonials</dt>
          <dd className="font-mono tabular-nums">
            {count(
              usage?.textTestimonials,
              usage?.textTestimonialsIsLowerBound,
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-ink-2 font-normal">Projects</dt>
          <dd className="font-mono tabular-nums">
            {count(usage?.organizations, usage?.organizationsIsLowerBound)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
