"use client";

import { useState } from "react";
import {
  IconArrowRight,
  IconCopy,
  IconExternalLink,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { ArrowNote, EnvelopeStamp, WallFrames } from "@/components/doodles";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import { OverviewPageSkeleton } from "@/components/ui/page-skeletons";

/**
 * Submissions waiting for a decision. A count exists to be acted on, so this
 * is a link to the Inbox rather than a figure to look at, and it leads the
 * page whenever there is anything in it.
 */
function ReviewQueue({
  inboxPath,
  pendingCount,
}: {
  inboxPath: Route;
  pendingCount: number;
}) {
  return (
    <Link
      className="border-line bg-surface hover:bg-surface-2 focus-visible:ring-ring group flex items-center gap-5 rounded-lg border p-5 transition-colors duration-150 outline-none focus-visible:ring-[3px]"
      href={inboxPath}
    >
      <span className="type-kpi text-ink shrink-0 tabular-nums">
        {pendingCount}
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-subheading block">
          {pendingCount === 1
            ? "Testimonial waiting for review"
            : "Testimonials waiting for review"}
        </span>
        <span className="text-ink-2 type-small mt-0.5 block">
          Nothing reaches your Wall until you publish it.
        </span>
      </span>
      <span className="text-brand-text type-ui inline-flex shrink-0 items-center gap-1.5 font-semibold">
        Review
        <IconArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

export function BrandDashboardView({
  collectionUrl,
  account,
  billingHref,
  copyCollectionUrl,
  name,
  pendingCount,
  publicSlug,
  slug,
}: {
  /** The full address a Submitter opens, which is what Copy puts in hand. */
  collectionUrl: string;
  account?: {
    effectivePlan: "free" | "premium";
    usage: {
      freeTextUsed: number;
      freeVideoUsed: number;
      readyVideos: number;
      reservedVideos: number;
    };
  } | null;
  billingHref?: string;
  copyCollectionUrl: () => Promise<void>;
  name: string;
  pendingCount: number;
  publicSlug: string;
  slug: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const collectionPath = `/c/${publicSlug}` as Route;
  const inboxPath = `/org/${slug}/inbox` as Route;
  const waiting = pendingCount > 0;

  async function copyLink() {
    setError(null);
    setSuccess(null);
    try {
      await copyCollectionUrl();
      setSuccess("Collection link copied.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Copy failed.");
    }
  }

  return (
    <div className="space-y-8">
      {/* No action in the header: the only one worth having belongs beside the
          address it copies, three lines below. */}
      <PageHeader
        description="Collect customer proof, review it privately, and publish only what you choose."
        eyebrow="Project"
        title={name}
      />

      {account && billingHref ? (
        <section
          aria-label="Account plan and usage"
          className="flex flex-wrap items-center justify-between gap-4 border-y py-4"
        >
          <div className="space-y-1">
            <h2 className="font-semibold">
              {account.effectivePlan === "premium" ? "Pro plan" : "Free plan"}
            </h2>
            <p className="text-ink-2 text-sm">Shared across all projects</p>
          </div>
          <div className="text-sm tabular-nums">
            {account.effectivePlan === "premium" ? (
              <>
                <p>{account.usage.readyVideos} / 25 videos stored</p>
                <p className="text-ink-2">Unlimited text collection</p>
              </>
            ) : (
              <>
                <p>{account.usage.freeTextUsed} / 13 text credits used</p>
                <p>{account.usage.freeVideoUsed} / 2 video credits used</p>
              </>
            )}
            {account.usage.reservedVideos > 0 ? (
              <p className="text-ink-2">
                {account.usage.reservedVideos} video
                {account.usage.reservedVideos === 1 ? " slot" : " slots"}{" "}
                reserved
              </p>
            ) : null}
          </div>
          <Button asChild variant="outline">
            <Link href={billingHref as Route}>
              {account.effectivePlan === "premium"
                ? "Manage subscription"
                : "Upgrade to Pro"}
            </Link>
          </Button>
        </section>
      ) : null}
      {/* The page reorders itself around the work that is waiting. With an
          empty queue the link is the whole job, so it takes the hero. */}
      <section aria-label="Brand overview" className="space-y-4">
        {waiting ? (
          <ReviewQueue inboxPath={inboxPath} pendingCount={pendingCount} />
        ) : null}

        <div className="border-line bg-surface rounded-xl border p-6 sm:p-8">
          {/* The eyebrow belongs to the column, not above it: outside, its
              height sat on top of a centred row and the panel ended up with
              33px of padding above and 46 below. */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            {/* A container, so the note below can ask whether the buttons'
                row has room for it rather than guess from the viewport. */}
            <div className="@container min-w-0 flex-1">
              <p className="type-micro text-ink-2">Your Collection Form</p>
              {/* A label and its value are one pair: 8px, the smallest step
                  DESIGN.md section 5 allows inside a component. Mono, the
                  family DESIGN.md gives public slugs; it borrows the scale's
                  size through the tokens rather than a `type-*` utility,
                  because those carry the display family with them and would
                  quietly put Gelica here. */}
              <p className="mt-2 font-mono text-[length:var(--type-subheading-size)] leading-[var(--type-subheading-leading)] font-semibold [overflow-wrap:anywhere] sm:text-[length:var(--type-heading-size)] sm:leading-[var(--type-heading-leading)]">
                {collectionUrl}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={copyLink} type="button">
                  <IconCopy aria-hidden="true" />
                  Copy link
                </Button>
                <Button asChild variant="outline">
                  <Link href={collectionPath} target="_blank">
                    Open Collection Form
                    <IconExternalLink aria-hidden="true" />
                  </Link>
                </Button>
                {/* On the buttons' row, 24px to their right, its arrow
                    climbing back to the address. The stroke is out of flow,
                    so the note adds no height and opens no gap; shown in both
                    states so the panel keeps one geometry, and only once the
                    row is wide enough to hold it beside the buttons rather
                    than wrap it under them. */}
                <ArrowNote
                  arrow="rise"
                  className="ms-4 hidden @xl:inline-flex"
                  direction="left"
                >
                  share this to start collecting
                </ArrowNote>
              </div>
            </div>
            {/* Shorter than the column beside it, so the row's height comes
                from the words and the panel keeps equal padding; decoration
                also waits for the width to carry it. */}
            <EnvelopeStamp
              aria-hidden="true"
              className="text-ink hidden h-24 shrink-0 lg:block"
            />
          </div>
        </div>

        {/* An empty queue is a sentence, not a figure: a large zero would be a
            number dressed up as news. */}
        {waiting ? null : (
          <p className="text-ink-2 type-small px-1">
            Nothing waiting for review. New Submissions land in your{" "}
            <Link
              className="text-ink font-semibold underline underline-offset-4"
              href={inboxPath}
            >
              Inbox
            </Link>
            , where you read them privately and decide what reaches your Wall.
          </p>
        )}
      </section>
      {error ? <ErrorToast message={error} /> : null}
      {success ? <SuccessToast message={success} /> : null}
    </div>
  );
}

export function OrganizationDashboard({ slug }: { slug: string }) {
  const account = useQuery(api.accounts.getMine, {});
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const pendingCount = useQuery(
    api.submissions.pendingCount,
    organization ? { organizationId: organization.id } : "skip",
  );

  if (organization === undefined) return <OverviewPageSkeleton />;

  if (organization === null) {
    return (
      <section className="grid min-h-[50vh] place-items-center px-6">
        <EmptyState
          description="This Brand does not exist or you no longer have access to it."
          illustration={<WallFrames className="h-32" />}
          title="Brand unavailable"
        />
      </section>
    );
  }

  if (pendingCount === undefined) return <OverviewPageSkeleton />;

  // Only ever reached on the client: the server renders the skeleton while
  // the queries are undefined, so reading the origin here cannot mismatch.
  const collectionUrl = `${window.location.origin}/c/${organization.publicSlug}`;

  return (
    <BrandDashboardView
      account={account}
      billingHref={`/org/${slug}/billing`}
      collectionUrl={collectionUrl}
      copyCollectionUrl={() => navigator.clipboard.writeText(collectionUrl)}
      name={organization.name}
      pendingCount={pendingCount}
      publicSlug={organization.publicSlug}
      slug={slug}
    />
  );
}
