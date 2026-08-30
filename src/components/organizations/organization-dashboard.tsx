"use client";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { AppShell } from "@/components/app-shell";

export function OrganizationDashboard({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });

  if (organization === undefined) {
    return (
      <main className="bg-muted/35 grid min-h-screen place-items-center">
        <p className="text-muted-foreground text-sm">Loading Organization…</p>
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
      organizationName={organization.name}
      organizationSlug={organization.slug}
    >
      <div className="mb-8">
        <p className="text-primary text-sm font-medium">Overview</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Your admin foundation is ready
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Authentication, Organizations, permissions, Projects, and audit
          activity share one server-enforced Tenant boundary.
        </p>
      </div>
      <section aria-label="Setup status" className="grid gap-4 lg:grid-cols-3">
        {[
          ["Organization", organization.name],
          ["Projects", "Role-protected example resource"],
          ["Security", "Server-derived access boundary"],
        ].map(([title, description]) => (
          <div
            className="border-border bg-card rounded-2xl border p-5 shadow-sm"
            key={title}
          >
            <p className="text-sm font-medium">{title}</p>
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
