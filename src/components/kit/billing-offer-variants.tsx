"use client";

import { type ReactNode, useState } from "react";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import Link from "next/link";

import { ProOffer, ProOfferHeader } from "@/components/billing/pro-offer";
import { ArrowNote, CircleAround, Sparkle } from "@/components/doodles";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

/**
 * Development review of the Pro offer on the billing page (DESIGN.md sections
 * 5 to 7): four ways to replace the wide amber band that today holds the plan
 * name, the price and three unmarked fragments. Every variant sits inside the
 * real "Upgrade to Pro" card, with the real copy and the real controls; only
 * the offer block changes. Pick one here, then port it into
 * `src/components/billing/organization-billing.tsx`.
 */

type SampleOffer = {
  amount: number;
  currency: string;
  description: string;
  features: string[];
  interval: "month" | "year";
  name: string;
};

/** The offers exactly as Stripe hands them to the billing page today. */
const offers: Record<"month" | "year", SampleOffer> = {
  month: {
    amount: 2_900,
    currency: "eur",
    description: "Unlimited text and video proof for growing brands.",
    features: [
      "Unlimited text collection",
      "25 stored Ready videos",
      "No Get Some Proof promo card",
    ],
    interval: "month",
    name: "Get Some Proof Pro",
  },
  year: {
    amount: 29_000,
    currency: "eur",
    description: "Unlimited text and video proof for growing brands.",
    features: [
      "Unlimited text collection",
      "25 stored Ready videos",
      "No Get Some Proof promo card",
    ],
    interval: "year",
    name: "Get Some Proof Pro",
  },
};

/** What a Free Account gets, from the billing page's own copy. */
const freeFeatures = [
  "1 active project",
  "13 lifetime text credits",
  "2 lifetime video credits",
  "One Get Some Proof promo card",
];

/** The same three promises, said as what changes rather than as a quota. */
const proAgainstFree = [
  "Unlimited projects",
  "Unlimited text collection",
  "25 stored Ready videos",
];

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(amount / 100);
}

/** What a year on the annual plan keeps, in cents. Positive is a saving. */
function annualSaving() {
  return offers.month.amount * 12 - offers.year.amount;
}

function useInterval() {
  const [interval, setInterval] = useState<"month" | "year">("month");
  return {
    annual: interval === "year",
    interval,
    offer: offers[interval],
    setInterval,
  };
}

function IntervalControl({
  onChange,
  value,
}: {
  onChange: (value: "month" | "year") => void;
  value: "month" | "year";
}) {
  return (
    <Segmented
      label="Billing interval"
      onChange={onChange}
      options={[
        { key: "month", label: "Monthly" },
        { key: "year", label: "Annual" },
      ]}
      value={value}
    />
  );
}

/** The saving as a tag rather than a sentence trailing off the price. */
function SavingBadge() {
  return <Badge variant="brand">2 months free</Badge>;
}

/**
 * The price as the one number on the block: Gelica at `kpi`, tabular, with
 * the interval as a quiet suffix. `circled` draws the ring around the figure,
 * which is what `CircleAround` exists for (DESIGN.md section 4).
 */
function Price({
  amount,
  circled = false,
  className,
  currency,
  interval,
}: {
  amount: number;
  circled?: boolean;
  className?: string;
  currency: string;
  interval: "month" | "year";
}) {
  return (
    <p className={cn("flex items-baseline gap-1.5", className)}>
      <span className={cn("type-kpi", circled && "relative inline-block")}>
        {formatAmount(amount, currency)}
        {circled ? (
          <CircleAround className="absolute -inset-x-3 -inset-y-1 h-[calc(100%+0.5rem)] w-[calc(100%+1.5rem)]" />
        ) : null}
      </span>
      <span className="type-small text-ink-2">
        / {interval === "month" ? "month" : "year"}
      </span>
    </p>
  );
}

/** The per-month equivalent, shown only where the price is a yearly one. */
function AnnualNote() {
  return (
    <p className="type-small text-ink-2">
      {formatAmount(offers.year.amount / 12, offers.year.currency)} a month,
      billed annually.
    </p>
  );
}

function FeatureList({
  className,
  features,
  tone = "brand",
}: {
  className?: string;
  features: string[];
  tone?: "brand" | "quiet";
}) {
  return (
    <ul className={cn("grid gap-2", className)}>
      {features.map((feature) => (
        <li className="flex items-start gap-2" key={feature}>
          <IconCheck
            aria-hidden="true"
            className={cn(
              "mt-0.5 size-4 shrink-0",
              tone === "brand" ? "text-brand-text" : "text-ink-3",
            )}
            stroke={1.75}
          />
          <span
            className={cn(
              "type-body",
              tone === "brand" ? "text-ink" : "text-ink-2",
            )}
          >
            {feature}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The plan's own name, demoted to what it is: a label, not the promise. */
function PlanEyebrow({ name }: { name: string }) {
  return <p className="type-micro text-ink-2">{name}</p>;
}

/**
 * The real card around every variant: the same title, the same description,
 * the same Stripe footer. `cta` moves the button into the offer block, which
 * is what variant B and C do.
 */
function UpgradeCard({
  children,
  cta = true,
}: {
  children: ReactNode;
  cta?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upgrade to Pro</CardTitle>
        <CardDescription>
          Unlimited projects with monthly or annual billing, and no extra cost
          per project. Text and video allowances are shared across all projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {children}
        <div
          className={cn(
            "flex flex-col gap-3 border-t pt-5",
            cta && "sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div>
            <p className="type-ui">Payment finishes securely on Stripe</p>
            <p className="type-small text-ink-2 mt-1">
              Your plan changes only after Stripe confirms the subscription.
            </p>
          </div>
          {cta ? (
            <Button className="sm:w-auto" type="button">
              Continue to Stripe
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* A. The receipt                                                      */
/* ------------------------------------------------------------------ */

/**
 * No tint at all. A hairline panel, split in two by a rule: the words on the
 * left, the number on the right, so the width that today reads as a void
 * becomes the gap a receipt has between a line and its amount.
 */
function VariantReceipt() {
  const { annual, interval, offer, setInterval } = useInterval();
  return (
    <UpgradeCard>
      <IntervalControl onChange={setInterval} value={interval} />
      <div className="border-line rounded-lg border">
        <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8">
          <div className="space-y-4">
            <div className="space-y-1">
              <PlanEyebrow name={offer.name} />
              <p className="type-subheading max-w-[32ch]">
                {offer.description}
              </p>
            </div>
            <FeatureList features={offer.features} />
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end sm:border-l sm:pl-8 sm:text-right">
            <div className="space-y-1">
              <Price
                amount={offer.amount}
                circled
                className="sm:justify-end"
                currency={offer.currency}
                interval={offer.interval}
              />
              {annual ? <AnnualNote /> : null}
            </div>
            {annual ? <SavingBadge /> : null}
          </div>
        </div>
      </div>
    </UpgradeCard>
  );
}

/* ------------------------------------------------------------------ */
/* B. The poster                                                       */
/* ------------------------------------------------------------------ */

/**
 * The founder's choice, 2026-09-10. No longer a draft: it renders the shipped
 * `ProOffer`, so this page and the product cannot drift apart.
 */
function VariantPoster() {
  const { interval, offer, setInterval } = useInterval();
  return (
    <UpgradeCard cta={false}>
      <ProOfferHeader
        interval={interval}
        onIntervalChange={setInterval}
        twoMonthsFree
      />
      <ProOffer
        checkoutButton={
          <Button type="button">
            <Sparkle aria-hidden="true" className="size-4" />
            Continue to Stripe
          </Button>
        }
        offer={offer}
      />
    </UpgradeCard>
  );
}

/* ------------------------------------------------------------------ */
/* C. The comparison                                                   */
/* ------------------------------------------------------------------ */

/**
 * A billing page answers one question: what changes if I pay. Two columns
 * answer it row by row. Free stays quiet on `--surface-2` and carries the
 * "Your plan" tag; Pro sits on paper with an amber hairline and the amber
 * checks, and holds the button.
 */
function VariantComparison() {
  const { annual, interval, offer, setInterval } = useInterval();
  return (
    <UpgradeCard cta={false}>
      <IntervalControl onChange={setInterval} value={interval} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-surface-2 space-y-4 rounded-lg p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <PlanEyebrow name="Get Some Proof Free" />
              <p className="type-subheading text-ink-2">Enough to start</p>
            </div>
            <Badge variant="neutral">Your plan</Badge>
          </div>
          <p className="type-kpi text-ink-2">Free</p>
          <FeatureList features={freeFeatures} tone="quiet" />
        </div>
        <div className="border-brand space-y-4 rounded-lg border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <PlanEyebrow name={offer.name} />
              <p className="type-subheading max-w-[22ch]">
                {offer.description}
              </p>
            </div>
            <ArrowNote
              arrow="rise"
              className="hidden shrink-0 lg:inline-flex"
              direction="left"
              size="sm"
            >
              unlimited, really
            </ArrowNote>
          </div>
          <div className="space-y-1">
            <Price
              amount={offer.amount}
              currency={offer.currency}
              interval={offer.interval}
            />
            {annual ? <AnnualNote /> : null}
          </div>
          {annual ? <SavingBadge /> : null}
          <FeatureList features={proAgainstFree} />
          <Button className="w-full" type="button">
            Continue to Stripe
          </Button>
        </div>
      </div>
    </UpgradeCard>
  );
}

/* ------------------------------------------------------------------ */
/* D. The lines                                                        */
/* ------------------------------------------------------------------ */

/**
 * No box inside the box. DESIGN.md replaces cards with rows and dividers in
 * a list, and this is a list: the promise and the price share one baseline
 * row, then one rule per promise, each saying what Free gives on the same
 * line. The only amber left is the marker behind one word and the checks.
 */
function VariantLines() {
  const { annual, interval, offer, setInterval } = useInterval();
  const rows = [
    { free: "1 active project", pro: "Unlimited projects" },
    { free: "13 lifetime credits", pro: "Unlimited text collection" },
    { free: "2 lifetime credits", pro: "25 stored Ready videos" },
    { free: "One promo card", pro: "No Get Some Proof promo card" },
  ];
  return (
    <UpgradeCard>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <PlanEyebrow name={offer.name} />
          <p className="type-subheading max-w-[28ch]">
            Collect <mark>without limits</mark>, on every project.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <IntervalControl onChange={setInterval} value={interval} />
          <div>
            <Price
              amount={offer.amount}
              currency={offer.currency}
              interval={offer.interval}
            />
            {annual ? <AnnualNote /> : null}
          </div>
        </div>
      </div>
      {annual ? <SavingBadge /> : null}
      <ul className="divide-line divide-y border-t">
        {rows.map((row) => (
          <li
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
            key={row.pro}
          >
            <span className="flex items-baseline gap-2">
              <IconCheck
                aria-hidden="true"
                className="text-brand-text size-4 shrink-0 translate-y-0.5"
                stroke={1.75}
              />
              <span className="type-body">{row.pro}</span>
            </span>
            <span className="type-small text-ink-3">Free: {row.free}</span>
          </li>
        ))}
      </ul>
    </UpgradeCard>
  );
}

/* ------------------------------------------------------------------ */
/* Today, for comparison                                               */
/* ------------------------------------------------------------------ */

/** The block as it ships today, reproduced so the four can be judged. */
function VariantToday() {
  const { annual, interval, offer, setInterval } = useInterval();
  return (
    <UpgradeCard>
      <div
        aria-label="Billing interval"
        className="flex flex-wrap items-center gap-2"
        role="group"
      >
        <Button
          aria-pressed={interval === "month"}
          onClick={() => setInterval("month")}
          variant={interval === "month" ? "default" : "outline"}
        >
          Monthly
        </Button>
        <Button
          aria-pressed={interval === "year"}
          onClick={() => setInterval("year")}
          variant={interval === "year" ? "default" : "outline"}
        >
          Annual · 2 months free
        </Button>
      </div>
      <div className="border-brand bg-brand-soft rounded-lg border p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-sm font-medium">{offer.name}</span>
          <span className="text-2xl font-semibold">
            {formatAmount(offer.amount, offer.currency)}
            <span className="text-muted-foreground ml-1 text-xs font-normal">
              / {offer.interval}
            </span>
          </span>
        </div>
        {annual ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {formatAmount(offer.amount / 12, offer.currency)} / month, billed
            annually. Save {formatAmount(annualSaving(), offer.currency)} a
            year.
          </p>
        ) : null}
        <p className="text-muted-foreground mt-3 text-sm">
          {offer.description}
        </p>
        <ul className="text-muted-foreground mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {offer.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
    </UpgradeCard>
  );
}

/* ------------------------------------------------------------------ */
/* The gallery                                                         */
/* ------------------------------------------------------------------ */

const widths = {
  desktop: "max-w-[880px]",
  phone: "max-w-[380px]",
  tablet: "max-w-[620px]",
} as const;

type Width = keyof typeof widths;

const variants: Array<{
  body: ReactNode;
  key: string;
  note: string;
  title: string;
}> = [
  {
    body: <VariantReceipt />,
    key: "a",
    note: "The tint goes. A hairline panel split by a rule: the words left, the number right, so the empty middle becomes the gap between a line and its amount. The plan name drops to an eyebrow and the sentence Stripe already sends becomes the promise, at subheading in Gelica. Its hand-drawn element is the ring around the price, which is exactly what CircleAround is for. Quietest of the four, and the closest to the rest of the dashboard.",
    title: "A. The receipt",
  },
  {
    body: <VariantPoster />,
    key: "b",
    note: "Chosen on 2026-09-10 and now shipping: this block is the real ProOffer component. The sidebar's plan card told in full, the starstruck blob at 400px closing the empty amber to its right, every check centred on its line, and the two free months written by hand beside whichever side of the deal is open.",
    title: "B. The poster \u00b7 chosen",
  },
  {
    body: <VariantComparison />,
    key: "c",
    note: 'Two columns answer the only question a billing page gets: what changes if I pay. Free stays quiet on the muted fill with the "Your plan" tag and grey checks; Pro sits on paper with an amber hairline, amber checks, and the button. Needs the Free copy the page already writes in prose.',
    title: "C. The comparison",
  },
  {
    body: <VariantLines />,
    key: "d",
    note: "No box inside the box: DESIGN.md replaces cards with rows in a list, and this is a list. Promise and price share one baseline, then one rule per promise, each naming what Free gives on the same line. Amber survives only in the marker behind two words and in the checks.",
    title: "D. The lines",
  },
];

export function BillingOfferVariants() {
  const [width, setWidth] = useState<Width>("desktop");
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">Pro offer on the billing page</h1>
            <p className="type-small text-ink-2">
              Four ways to replace the amber band. Development only.
            </p>
          </div>
          <Segmented
            label="Preview width"
            onChange={setWidth}
            options={[
              { key: "desktop", label: "Desktop" },
              { key: "tablet", label: "Tablet" },
              { key: "phone", label: "Phone" },
            ]}
            value={width}
          />
          <ThemeToggle />
          <Button asChild size="sm" variant="outline">
            <Link href="/kit">
              <IconArrowLeft aria-hidden="true" />
              Kit
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-12 px-6 py-8">
        <section className="max-w-prose space-y-2">
          <h2 className="type-heading">What is wrong today</h2>
          <p className="type-body text-ink-2">
            The block is a full-width amber fill on a card that is already a
            surface, so the tint carries the separation a hairline should carry.
            The plan name sits at 14px beside a 24px price, which inverts the
            hierarchy: the name is the label and the price is the fact. The
            three promises have no marker, so they read as orphan fragments in
            two columns. And the row is wider than anything in it, which leaves
            the void down the middle.
          </p>
          <p className="type-body text-ink-2">
            All four variants fix the same four things: the price becomes the
            one number, in Gelica at <code className="font-mono">kpi</code> with
            tabular figures; the plan name drops to a{" "}
            <code className="font-mono">micro</code> eyebrow and Stripe&rsquo;s
            own sentence becomes the promise at{" "}
            <code className="font-mono">subheading</code>; the promises get a
            Tabler check in <code className="font-mono">--brand-text</code>; and
            Monthly / Annual becomes the{" "}
            <code className="font-mono">Segmented</code> primitive instead of
            two buttons, one of which was amber and pressed at the same time.
            Each variant carries exactly one hand-drawn element, and a different
            one, so the four can be compared on that too.
          </p>
        </section>

        {variants.map((variant) => (
          <section className="space-y-3" key={variant.key}>
            <div className="max-w-prose space-y-1">
              <h2 className="type-heading">{variant.title}</h2>
              <p className="type-body text-ink-2">{variant.note}</p>
            </div>
            <div className={cn("w-full", widths[width])}>{variant.body}</div>
          </section>
        ))}

        <section className="space-y-3">
          <div className="max-w-prose space-y-1">
            <h2 className="type-heading">Today, for comparison</h2>
            <p className="type-body text-ink-2">
              The block as it ships, reproduced from
              <code className="font-mono">
                {" "}
                src/components/billing/organization-billing.tsx
              </code>
              .
            </p>
          </div>
          <div className={cn("w-full", widths[width])}>
            <VariantToday />
          </div>
        </section>
      </main>
    </div>
  );
}
