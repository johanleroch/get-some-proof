"use client";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { InvitationManager } from "@/components/invitations/invitation-manager";

export function OrganizationMembers({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });

  if (organization === undefined) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading Members…
      </main>
    );
  }

  if (organization === null) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Organization unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This Organization does not exist or your Membership is inactive.
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
      <InvitationManager organizationId={organization.id} />
    </AppShell>
  );
}
