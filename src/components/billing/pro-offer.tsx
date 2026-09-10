"use client";

import type { ReactNode } from "react";
import { IconCheck } from "@tabler/icons-react";

import { Blob } from "@/components/brand/blob";
import { ArrowNote } from "@/components/doodles";
import { Segmented } from "@/components/ui/segmented";

/**
 * The Pro offer on the billing page (DESIGN.md section 6): the sidebar's
 * plan card told in full. The same amber poster, the same starstruck blob
 * cropped by the bottom right corner at 400px, so the block is wide because
 * someone lives in it, not because it stretched. Chosen by the founder on 2026-09-10
 * among four drafts (receipt, poster, comparison, rows).
 *
 * The plan's own name is an eyebrow, not the promise: what Stripe sends as
 * the description carries the `heading`, and the price is the one number,
 * in Gelica at `kpi` with tabular figures. The two months an annual plan
 * gives are said by hand rather than by a tag, beside the Annual tab it
 * belongs to: an invitation while Monthly is chosen, a receipt once Annual
 * is. A tag would have been one more pill; this is the hand that writes
 * every other note in the product.
 */

export type ProOfferView = {
  amount: number;
  currency: string;
  description: string | null;
  features: string[];
  interval: "month" | "year";
  name: string;
};

/**
 * The one way this page prints money. `organization-billing.tsx` wraps it for
 * the shapes it already holds rather than keeping a second copy: two
 * formatters on one page drift, and the locale they resolve is a live
 * question (the server and a French browser disagree today).
 */
export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(amount / 100);
}

/**
 * The interval as a real segmented control, so the chosen side is the one
 * lifted onto paper. Two Buttons could not say it: the pressed one wore the
 * amber fill and the pressed tint at once.
 */
export function ProOfferHeader({
  disabled = false,
  interval,
  onIntervalChange,
  twoMonthsFree = false,
}: {
  disabled?: boolean;
  interval: "month" | "year";
  onIntervalChange: (interval: "month" | "year") => void;
  twoMonthsFree?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Segmented
        disabled={disabled}
        label="Billing interval"
        onChange={onIntervalChange}
        options={[
          { key: "month", label: "Monthly" },
          { key: "year", label: "Annual" },
        ]}
        value={interval}
      />
      {/* The two free months, in the hand that writes every other note. */}
      {twoMonthsFree ? (
        <ArrowNote arrow="flat" className="shrink-0" direction="left">
          two months on us
        </ArrowNote>
      ) : null}
    </div>
  );
}

/**
 * A promise and its mark. The check sits in a box as tall as the line it
 * belongs to, so it centres on the words instead of riding above them.
 */
function OfferPromise({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex h-(--type-body-leading) shrink-0 items-center">
        <IconCheck
          aria-hidden="true"
          className="text-brand-text size-4"
          stroke={2}
        />
      </span>
      <span className="type-body">{children}</span>
    </li>
  );
}

export function ProOffer({
  checkoutButton,
  offer,
}: {
  /** The button, or the sentence that replaces it when an Owner is needed. */
  checkoutButton: ReactNode;
  offer: ProOfferView;
}) {
  const annual = offer.interval === "year";
  return (
    <>
      {/* The poster is its own query container: how much room the mascot
          has is the poster's width, never the window's. The billing card is
          a column beside a sidebar on one screen and the whole page on
          another, and a window-wide breakpoint shrank the blob while the
          poster still had all the room it needed. */}
      <div className="bg-brand-soft @container/offer relative overflow-hidden rounded-lg">
        <div className="p-6 @md/offer:pr-[13rem] @xl/offer:pr-[17rem] @3xl/offer:pr-[22rem]">
          <div className="max-w-[34ch] space-y-5">
            <div className="space-y-1.5">
              <p className="type-micro text-ink-2">{offer.name}</p>
              {offer.description ? (
                <p className="type-heading">{offer.description}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <p className="flex items-baseline gap-1.5">
                <span className="type-kpi">
                  {formatAmount(offer.amount, offer.currency)}
                </span>
                <span className="type-small text-ink-2">
                  / {annual ? "year" : "month"}
                </span>
              </p>
              {annual ? (
                <p className="type-small text-ink-2">
                  {formatAmount(offer.amount / 12, offer.currency)} a month,
                  billed annually.
                </p>
              ) : null}
            </div>

            {offer.features.length > 0 ? (
              <ul className="grid gap-2">
                {offer.features.map((feature) => (
                  <OfferPromise key={feature}>{feature}</OfferPromise>
                ))}
              </ul>
            ) : null}

            <div className="pt-1">{checkoutButton}</div>
          </div>
        </div>

        {/* The mascot fills the right of the poster rather than peeking from
            it: the founder's call on 2026-09-10, and the reason the block may
            be as wide as its card. One instance that scales, never a second
            at another size, and the poster's overflow does the cropping.

            The two transforms are on two elements on purpose. A `translate`
            in percent is read against the element's own unscaled box, so
            putting it next to the `scale` kept pushing a 400px blob 80px
            down whatever its size on screen: the smaller it got, the more of
            it was cut, until a 220px one was a dome with two stars in it.
            The scale sits outside and takes the offset down with it, which
            is what holds the crop at a tenth of the width and a fifth of the
            height at every size. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 hidden origin-bottom-right @md/offer:block @md/offer:scale-[0.55] @xl/offer:scale-[0.7] @3xl/offer:scale-100"
        >
          <span className="block translate-x-[10%] translate-y-[20%] -rotate-[8deg]">
            <Blob expression="starstruck" size={400} />
          </span>
        </span>
      </div>
    </>
  );
}
