"use client";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { AuditLog } from "./audit-log";

export function OrganizationAudit({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const access = useQuery(
    api.organizationAuthorization.getMine,
    organization ? { organizationId: organization.id } : "skip",
  );

  if (organization === undefined || (organization && access === undefined)) {
    return (
      <main className="bg-muted/35 grid min-h-screen place-items-center">
        <p className="text-muted-foreground text-sm">Loading Audit Log…</p>
      </main>
    );
  }

  if (organization === null) {
    return (
      <main className="bg-muted/35 grid min-h-screen place-items-center px-6">
        <div className="max-w-md text-center">
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
      organizationId={organization.id}
      organizationName={organization.name}
      organizationSlug={organization.slug}
    >
      {access?.can.readAudit ? (
        <AuditLog organizationId={organization.id} />
      ) : (
        <section className="bg-card rounded-2xl border p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Audit Log unavailable</h1>
          <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm leading-6">
            Only an Organization Owner or Admin can review administrative
            activity.
          </p>
        </section>
      )}
    </AppShell>
  );
}
