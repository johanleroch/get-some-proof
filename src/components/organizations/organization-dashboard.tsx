"use client";

import { useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconInbox,
  IconLink,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
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
  const [copied, setCopied] = useState(false);
  const collectionPath = `/c/${publicSlug}` as Route;

  async function copyLink() {
    await copyCollectionUrl();
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm font-medium">Workspace</p>
        <h1 className="dashboard-page-title mt-1">{name}</h1>
        <p className="dashboard-page-description mt-1 max-w-2xl">
          Collect customer proof, review it privately, and publish only what you
          choose.
        </p>
      </div>

      <section
        aria-label="Brand overview"
        className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]"
      >
        <Card className="shadow-xs">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardDescription>Pending Testimonials</CardDescription>
              <CardTitle className="mt-2 text-3xl tabular-nums">
                {pendingCount}
              </CardTitle>
            </div>
            <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
              <IconInbox aria-hidden="true" className="size-5" />
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              New Submissions will arrive here for review before publication.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader>
            <CardDescription>Your Collection Form</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconLink aria-hidden="true" className="size-4" />
              <span>/c/{publicSlug}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={copyLink} type="button">
              {copied ? (
                <IconCheck aria-hidden="true" />
              ) : (
                <IconCopy aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button asChild variant="outline">
              <Link href={collectionPath} target="_blank">
                Open Collection Form
                <IconExternalLink aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function OrganizationDashboard({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });

  if (organization === undefined) return <OverviewPageSkeleton />;

  if (organization === null) {
    return (
      <section className="grid min-h-[50vh] place-items-center px-6">
        <div className="max-w-md text-center">
          <h1 className="dashboard-page-title">Brand unavailable</h1>
          <p className="dashboard-page-description mt-2">
            This Brand does not exist or you no longer have access to it.
          </p>
        </div>
      </section>
    );
  }

  return (
    <BrandDashboardView
      copyCollectionUrl={() =>
        navigator.clipboard.writeText(
          `${window.location.origin}/c/${organization.publicSlug}`,
        )
      }
      name={organization.name}
      pendingCount={0}
      publicSlug={organization.publicSlug}
    />
  );
}
