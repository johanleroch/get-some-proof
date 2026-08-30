"use client";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { ProjectManager } from "./project-manager";

export function OrganizationProjects({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });

  if (organization === undefined) {
    return (
      <main className="bg-muted/35 grid min-h-screen place-items-center">
        <p className="text-muted-foreground text-sm">Loading Projects…</p>
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
      <ProjectManager organizationId={organization.id} />
    </AppShell>
  );
}
