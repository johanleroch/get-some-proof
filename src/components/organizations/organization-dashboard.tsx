"use client";

import type { Route } from "next";
import Link from "next/link";
import { Archive, FolderKanban, Mail, Users } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { Bar } from "@/components/charts/bar";
import BarChart from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";

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
    <div className="bg-card rounded-2xl border p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <Icon aria-hidden="true" className="text-primary size-4" />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">
        {value === undefined ? "—" : (value ?? "Restricted")}
      </p>
    </div>
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
    <section className="bg-card rounded-2xl border p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {hasData ? (
        <div
          aria-label={`${title}: ${data.map((item) => `${item.label} ${item[dataKey]}`).join(", ")}`}
          className="mt-5"
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
        <div className="bg-muted/45 mt-5 grid min-h-48 place-items-center rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground max-w-xs text-sm">
            {emptyMessage}
          </p>
        </div>
      )}
    </section>
  );
}

export function OrganizationDashboard({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const overview = useQuery(
    api.dashboard.overview,
    organization ? { organizationId: organization.id } : "skip",
  );

  if (organization === undefined || (organization && overview === undefined)) {
    return (
      <main className="bg-muted/35 grid min-h-screen place-items-center">
        <p className="text-muted-foreground text-sm" role="status">
          Loading Organization overview…
        </p>
      </main>
    );
  }

  if (organization === null) {
    return (
      <main className="bg-muted/35 grid min-h-screen place-items-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Organization unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            This Organization does not exist or your Membership is no longer
            active.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AppShell
      organizationId={organization.id}
      organizationName={organization.name}
      organizationSlug={organization.slug}
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-primary text-sm font-medium">Overview</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {organization.name}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
              Live, Tenant-scoped activity from Projects and Memberships.
            </p>
          </div>
          <Link
            className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
            href={`/org/${organization.slug}/projects` as Route}
          >
            View Projects
          </Link>
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

        <div className="grid gap-5 xl:grid-cols-2">
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
    </AppShell>
  );
}
