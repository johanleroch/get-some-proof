"use client";

import type { Route } from "next";
import Link from "next/link";
import { Archive, FolderKanban, Mail, Users } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { Bar } from "@/components/charts/bar";
import BarChart from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OverviewPageSkeleton } from "@/components/ui/page-skeletons";

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number | null | undefined;
}) {
  return (
    <Card className="gap-4 py-5 shadow-xs">
      <CardHeader className="grid grid-cols-[1fr_auto] items-center px-5">
        <CardDescription className="font-medium">{label}</CardDescription>
        <Icon aria-hidden="true" className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent className="px-5">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {value === undefined ? "—" : (value ?? "Restricted")}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Current Organization
        </p>
      </CardContent>
    </Card>
  );
}

function MetricChart({
  data,
  dataKey,
  emptyMessage,
  title,
}: {
  data: Record<string, string | number>[];
  dataKey: "members" | "projects";
  emptyMessage: string;
  title: string;
}) {
  const hasData = data.some((item) => Number(item[dataKey]) > 0);

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Live Organization data</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div
            aria-label={`${title}: ${data.map((item) => `${item.label} ${item[dataKey]}`).join(", ")}`}
            className="min-h-56"
            role="img"
          >
            <BarChart
              animationDuration={700}
              aspectRatio="16 / 8"
              data={data}
              margin={{ top: 12, right: 16, bottom: 42, left: 16 }}
              xDataKey="label"
            >
              <Grid horizontal hideHorizontalEdgeLines />
              <Bar
                dataKey={dataKey}
                fill="var(--chart-line-primary)"
                lineCap={8}
              />
              <BarXAxis showAllLabels />
              <ChartTooltip showCrosshair={false} />
            </BarChart>
          </div>
        ) : (
          <div className="bg-muted/30 grid min-h-56 place-items-center rounded-lg border border-dashed p-6 text-center">
            <p className="text-muted-foreground max-w-xs text-sm">
              {emptyMessage}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OrganizationDashboard({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const overview = useQuery(
    api.dashboard.overview,
    organization ? { organizationId: organization.id } : "skip",
  );

  if (organization === undefined || (organization && overview === undefined)) {
    return <OverviewPageSkeleton />;
  }

  if (organization === null) {
    return (
      <section className="grid min-h-[50vh] place-items-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Organization unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            This Organization does not exist or your Membership is no longer
            active.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Live, Tenant-scoped activity from Projects and Memberships.
          </p>
        </div>
        <Button asChild>
          <Link href={`/org/${organization.slug}/projects` as Route}>
            View Projects
          </Link>
        </Button>
      </div>

      <section
        aria-label="Organization metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          icon={FolderKanban}
          label="Total Projects"
          value={overview?.totalProjects}
        />
        <MetricCard
          icon={Archive}
          label="Archived Projects"
          value={overview?.archivedProjects}
        />
        <MetricCard
          icon={Users}
          label="Active Members"
          value={overview?.activeMembers}
        />
        <MetricCard
          icon={Mail}
          label="Pending Invitations"
          value={overview?.pendingInvitations}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <MetricChart
          data={overview?.projectStatus ?? []}
          dataKey="projects"
          emptyMessage="Create the first Project to populate this chart with real Organization data."
          title="Projects by status"
        />
        <MetricChart
          data={overview?.memberRoles ?? []}
          dataKey="members"
          emptyMessage="Membership roles will appear after the first Member joins."
          title="Members by role"
        />
      </div>
    </div>
  );
}
