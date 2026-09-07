"use client";

import { useState } from "react";
import {
  IconCopy,
  IconExternalLink,
  IconInbox,
  IconLink,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { ArrowNote, WallFrames } from "@/components/doodles";
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

export function BrandDashboardView({
  copyCollectionUrl,
  name,
  pendingCount,
  publicSlug,
}: {
  copyCollectionUrl: () => Promise<void>;
  name: string;
  pendingCount: number;
  publicSlug: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const collectionPath = `/c/${publicSlug}` as Route;

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

      <section
        aria-label="Brand overview"
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
      >
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div className="space-y-2">
              <CardDescription>Pending Testimonials</CardDescription>
              <CardTitle className="type-kpi">{pendingCount}</CardTitle>
            </div>
            <span className="bg-brand-soft text-brand-text grid size-10 shrink-0 place-items-center rounded-md">
              <IconInbox aria-hidden="true" className="size-5" />
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-ink-2 type-small">
              New Submissions will arrive here for review before publication.
            </p>
          </CardContent>
        </Card>

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
              <ArrowNote
                arrow="flat"
                className="hidden sm:inline-flex"
                direction="left"
              >
                share this to start collecting
              </ArrowNote>
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
    />
  );
}
