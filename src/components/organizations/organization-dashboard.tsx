"use client";

import { useState } from "react";
import {
  IconArrowRight,
  IconCopy,
  IconExternalLink,
  IconLink,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

/**
 * The same slot when the queue is empty. A large zero would be a figure
 * dressed up as news; the drawing and one sentence say the true thing, which
 * is that the work now is to share the link above.
 */
function EmptyQueue() {
  return (
    <div className="border-line bg-surface flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:gap-6">
      <EnvelopeStamp aria-hidden="true" className="text-ink h-16 shrink-0" />
      <div className="min-w-0">
        <p className="type-subheading">Nothing waiting for review</p>
        <p className="text-ink-2 type-small mt-1">
          New Submissions land in your Inbox, where you read them privately and
          decide what reaches your Wall.
        </p>
      </div>
    </div>
  );
}

export function BrandDashboardView({
  copyCollectionUrl,
  name,
  pendingCount,
  publicSlug,
  slug,
}: {
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

  const collectionForm = (
    <Card>
      <CardHeader>
        <CardDescription>Your Collection Form</CardDescription>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <CardTitle className="flex items-center gap-2">
            <IconLink aria-hidden="true" className="text-ink-2 size-4" />
            <span className="font-mono text-base font-medium tracking-normal">
              /c/{publicSlug}
            </span>
          </CardTitle>
          {/* The note belongs to the empty workspace, where sharing the link
              is the only job left to do. */}
          {waiting ? null : (
            <ArrowNote
              arrow="flat"
              className="hidden sm:inline-flex"
              direction="left"
            >
              share this to start collecting
            </ArrowNote>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href={collectionPath} target="_blank">
            Open Collection Form
            <IconExternalLink aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Button onClick={copyLink} type="button">
            <IconCopy aria-hidden="true" />
            Copy link
          </Button>
        }
        description="Collect customer proof, review it privately, and publish only what you choose."
        eyebrow="Workspace"
        title={name}
      />

      {/* The page reorders itself around the work that is actually waiting:
          Submissions to read come first, and an empty queue steps aside for
          the link that fills it. */}
      <section aria-label="Brand overview" className="space-y-4">
        {waiting ? (
          <>
            <ReviewQueue inboxPath={inboxPath} pendingCount={pendingCount} />
            {collectionForm}
          </>
        ) : (
          <>
            {collectionForm}
            <EmptyQueue />
          </>
        )}
      </section>
      {error ? <ErrorToast message={error} /> : null}
      {success ? <SuccessToast message={success} /> : null}
    </div>
  );
}

export function OrganizationDashboard({ slug }: { slug: string }) {
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

  return (
    <BrandDashboardView
      copyCollectionUrl={() =>
        navigator.clipboard.writeText(
          `${window.location.origin}/c/${organization.publicSlug}`,
        )
      }
      name={organization.name}
      pendingCount={pendingCount}
      publicSlug={organization.publicSlug}
      slug={slug}
    />
  );
}
