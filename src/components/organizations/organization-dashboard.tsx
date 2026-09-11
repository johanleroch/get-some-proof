"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  IconArrowRight,
  IconCode,
  IconCopy,
  IconExternalLink,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { UpgradeToProButton } from "@/components/account/upgrade-to-pro-button";
import { blobToast } from "@/components/brand/blob-toast";
import { ArrowNote, WallFrames } from "@/components/doodles";
import { PublicAddress } from "@/components/organizations/public-address";
import { PageHeader } from "@/components/page-header";
import { useProjectShell } from "@/components/organizations/project-shell-context";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import {
  AccountPlanSkeleton,
  OverviewPageSkeleton,
} from "@/components/ui/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearJustCreated,
  type CreatedNoun,
  readJustCreated,
  subscribeToNothing,
} from "@/lib/just-created";
import { cn } from "@/lib/utils";

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

type Account = NonNullable<BrandDashboardViewProps["account"]>;

/**
 * The Wall lives on the same origin as the Collection Form, one folder over.
 * Built from the origin when the address parses, and by swapping the folder
 * when it does not (tests hand in bare hosts), so a trailing slash or query
 * can never leave the Collection address standing in for the Wall's.
 */
function wallUrlFrom(collectionUrl: string, publicSlug: string) {
  try {
    return `${new URL(collectionUrl).origin}/w/${publicSlug}`;
  } catch {
    return collectionUrl.replace(
      /\/c\/[^/?#]+(?=[/?#]|$).*$/,
      `/w/${publicSlug}`,
    );
  }
}

/** The allowances the plans promise (docs/product-scope.md). */
const freeTextCredits = 13;
const freeVideoCredits = 2;
const proVideosStored = 25;

/**
 * One allowance: the fraction in figures beside its name and, under them,
 * how full the tank is. A meter, not a progress bar: nothing is loading.
 */
function UsageMeter({
  label,
  total,
  used,
}: {
  label: string;
  total: number;
  used: number;
}) {
  const ratio = Math.min(1, Math.max(0, used / total));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-small text-ink-2">{label}</span>
        <span className="font-mono text-[length:var(--type-small-size)] leading-[var(--type-small-leading)] font-semibold">
          {used} / {total}
        </span>
      </div>
      <div
        aria-label={label}
        aria-valuemax={total}
        aria-valuemin={0}
        aria-valuenow={used}
        className="bg-surface-2 mt-2 h-1.5 overflow-hidden rounded-full"
        role="meter"
      >
        <div
          className="bg-brand h-full rounded-full"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Account-wide, so it stands apart from this Project's proof in its own
 * column: the plan named, the allowances as meters, and the one button on
 * the page that sells. On Pro that place holds a door, not a sale, so it
 * stays an outline.
 */
function AccountPlanPanel({
  account,
  billingHref,
}: {
  account: Account;
  billingHref: Route;
}) {
  const pro = account.effectivePlan === "premium";
  const reserved = account.usage.reservedVideos;
  return (
    <section
      aria-label="Account plan and usage"
      className="border-line bg-surface rounded-lg border p-5 lg:sticky lg:top-6"
    >
      <p className="type-micro text-ink-2">Your plan</p>
      <h2 className="type-subheading mt-1">{pro ? "Pro plan" : "Free plan"}</h2>
      <p className="type-small text-ink-2 mt-1">
        {pro
          ? "Unlimited Projects, usage shared across them"
          : "1 of 1 active Project"}
      </p>
      <div className="mt-4 space-y-3">
        {pro ? (
          <UsageMeter
            label="Videos stored"
            total={proVideosStored}
            used={account.usage.readyVideos}
          />
        ) : (
          <>
            <UsageMeter
              label="Text credits"
              total={freeTextCredits}
              used={account.usage.freeTextUsed}
            />
            <UsageMeter
              label="Video credits"
              total={freeVideoCredits}
              used={account.usage.freeVideoUsed}
            />
          </>
        )}
        {reserved > 0 ? (
          <p className="type-small text-ink-2">
            {reserved} video {reserved === 1 ? "slot" : "slots"} reserved
          </p>
        ) : null}
      </div>
      {pro ? (
        <Button asChild className="mt-5 w-full" variant="outline">
          <Link href={billingHref}>Manage subscription</Link>
        </Button>
      ) : (
        <>
          <UpgradeToProButton className="mt-5 w-full" href={billingHref} />
          <p className="type-small text-ink-2 mt-3 text-center">
            Pro adds unlimited Projects and text, and 25 stored videos.
          </p>
        </>
      )}
    </section>
  );
}

export type BrandDashboardViewProps = {
  /** The full address a Submitter opens, which is what Copy puts in hand. */
  collectionUrl?: string;
  account?: {
    effectivePlan: "free" | "premium";
    usage: {
      freeTextUsed: number;
      freeVideoUsed: number;
      readyVideos: number;
      reservedVideos: number;
    };
  } | null;
  accountLoading?: boolean;
  billingHref?: string;
  copyCollectionUrl: () => Promise<void>;
  /** Set on the first arrival after creation: the mascot says it is ready. */
  justCreated?: CreatedNoun | null;
  name: string;
  pendingCount?: number;
  publicSlug: string;
  slug: string;
};

export function BrandDashboardView({
  collectionUrl,
  account,
  accountLoading = false,
  billingHref,
  copyCollectionUrl,
  justCreated = null,
  name,
  pendingCount,
  publicSlug,
  slug,
}: BrandDashboardViewProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const collectionPath = `/c/${publicSlug}` as Route;

  // The end of onboarding: one greeting, then the flag goes so a reload
  // never repeats it.
  useEffect(() => {
    if (!justCreated) return;
    blobToast.success(`Your ${justCreated} is ready.`, {
      description: "Share your Collection Form to start collecting.",
      id: "just-created",
    });
    clearJustCreated();
  }, [justCreated]);
  const inboxPath = `/org/${slug}/inbox` as Route;
  const wallPath = `/w/${publicSlug}` as Route;
  const embedPath = `/org/${slug}/settings#embed` as Route;
  const wallUrl = collectionUrl
    ? wallUrlFrom(collectionUrl, publicSlug)
    : undefined;
  const waiting = pendingCount !== undefined && pendingCount > 0;
  const plan = account && billingHref ? account : null;
  const planLoading = accountLoading;
  const addressesLoading = collectionUrl === undefined;

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
      {/* The shell already knows the Brand name. Keeping the sentence neutral
          lets the whole header paint before the queue has answered. */}
      <PageHeader
        description="Share your Collection Form, read what comes in, publish what you choose."
        eyebrow="Overview"
        title={name}
      />

      {/* DESIGN.md section 6, Brand overview: the work on the left, the
          Account on the right, 2:1, one column below 1024px and whenever
          there is no plan to show. */}
      <div
        className={cn(
          "grid gap-6",
          (plan || planLoading) &&
            "lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)] lg:items-start",
        )}
      >
        {/* The column reorders itself around the work that is waiting. With
            an empty queue the link is the whole job, so it comes first. */}
        <section aria-label="Brand overview" className="space-y-6">
          {waiting ? (
            <ReviewQueue inboxPath={inboxPath} pendingCount={pendingCount} />
          ) : null}

          {/* A container, so the note can ask whether the buttons' row has
              room for it rather than guess from the viewport. */}
          <div className="border-line bg-surface @container rounded-xl border p-6 sm:p-8">
            <p className="type-micro text-ink-2">Your Collection Form</p>
            {/* A label and its value are one pair: 8px, the smallest step
                DESIGN.md section 5 allows inside a component. Mono, the
                family DESIGN.md gives public slugs, at `subheading` size so
                it never competes with the title; it borrows the size through
                the tokens rather than a `type-*` utility, because those carry
                the display family with them and would quietly put Gelica
                here. */}
            {collectionUrl ? (
              <p className="mt-2 font-mono text-[length:var(--type-subheading-size)] leading-[var(--type-subheading-leading)] font-semibold">
                <PublicAddress url={collectionUrl} />
              </p>
            ) : (
              <Skeleton className="mt-2 h-7 w-[min(34rem,85%)]" />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                disabled={addressesLoading}
                onClick={copyLink}
                type="button"
              >
                <IconCopy aria-hidden="true" />
                Copy link
              </Button>
              {addressesLoading ? (
                <Button disabled type="button" variant="outline">
                  Open Collection Form
                  <IconExternalLink aria-hidden="true" />
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href={collectionPath} target="_blank">
                    Open Collection Form
                    <IconExternalLink aria-hidden="true" />
                  </Link>
                </Button>
              )}
              {/* On the buttons' row, 24px to their right, its arrow climbing
                  back to the address. The stroke is out of flow, so the note
                  adds no height and opens no gap; shown in both states so the
                  panel keeps one geometry, and only once the row is wide
                  enough to hold it beside the buttons rather than wrap it
                  under them. */}
              <ArrowNote
                arrow="rise"
                className="ms-4 hidden @xl:inline-flex"
                direction="left"
              >
                share this to start collecting
              </ArrowNote>
            </div>
          </div>

          {/* Where the proof ends up, and the two ways out to it. The drawing
              is the region's illustration; the arrow note above is its one
              caption, the pair DESIGN.md section 4 allows a state like this. */}
          <section
            aria-label="Public Wall"
            className="border-line bg-surface grid gap-6 rounded-lg border p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-8"
          >
            <WallFrames
              aria-hidden="true"
              className="text-ink mx-auto h-28 lg:h-32"
            />
            <div className="min-w-0">
              <p className="type-micro text-ink-2">Your Public Wall</p>
              <h2 className="type-heading mt-1">
                Only what you publish reaches it
              </h2>
              {wallUrl ? (
                <p className="mt-2 font-mono text-[length:var(--type-ui-size)] leading-[var(--type-ui-leading)] font-semibold">
                  <PublicAddress url={wallUrl} />
                </p>
              ) : (
                <Skeleton className="mt-2 h-6 w-[min(30rem,80%)]" />
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {addressesLoading ? (
                  <>
                    <Button disabled type="button" variant="outline">
                      Open Wall
                      <IconExternalLink aria-hidden="true" />
                    </Button>
                    <Button disabled type="button" variant="ghost">
                      Embed on your site
                      <IconCode aria-hidden="true" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <Link href={wallPath} target="_blank">
                        Open Wall
                        <IconExternalLink aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href={embedPath}>
                        Embed on your site
                        <IconCode aria-hidden="true" />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>
        </section>

        {planLoading ? (
          <AccountPlanSkeleton />
        ) : plan ? (
          <AccountPlanPanel account={plan} billingHref={billingHref as Route} />
        ) : null}
      </div>
      {error ? <ErrorToast message={error} /> : null}
      {success ? <SuccessToast message={success} /> : null}
    </div>
  );
}

export function OrganizationDashboard({ slug }: { slug: string }) {
  const projectShell = useProjectShell();
  const shellProject = projectShell?.slug === slug ? projectShell : null;
  const justCreated = useSyncExternalStore(
    subscribeToNothing,
    readJustCreated,
    () => null,
  );
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => null,
  );
  const account = useQuery(api.accounts.getMine, {});
  const queriedOrganization = useQuery(
    api.organizations.getBySlug,
    shellProject ? "skip" : { slug },
  );
  const organization = shellProject
    ? {
        id: shellProject.organizationId,
        name: shellProject.brandName,
        publicSlug: shellProject.publicSlug,
        slug: shellProject.slug,
      }
    : queriedOrganization;
  const queriedPendingCount = useQuery(
    api.submissions.pendingCount,
    organization && shellProject?.pendingCount === undefined
      ? { organizationId: organization.id }
      : "skip",
  );
  const pendingCount = shellProject?.pendingCount ?? queriedPendingCount;

  if (organization === undefined) {
    return <OverviewPageSkeleton name={shellProject?.brandName} />;
  }

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

  const collectionUrl = origin
    ? `${origin}/c/${organization.publicSlug}`
    : undefined;

  return (
    <BrandDashboardView
      account={account}
      accountLoading={account === undefined}
      billingHref="/account/billing"
      collectionUrl={collectionUrl}
      copyCollectionUrl={() =>
        collectionUrl
          ? navigator.clipboard.writeText(collectionUrl)
          : Promise.reject(new Error("Collection link is still loading."))
      }
      justCreated={justCreated}
      name={organization.name}
      pendingCount={pendingCount}
      publicSlug={organization.publicSlug}
      slug={slug}
    />
  );
}
