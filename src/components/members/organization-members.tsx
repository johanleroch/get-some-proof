"use client";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { InvitationManager } from "@/components/invitations/invitation-manager";
import { MemberDirectory } from "@/components/members/member-directory";

export function OrganizationMembers({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });

  if (organization === undefined) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        Loading Members…
      </div>
    );
  }

  if (organization === null) {
    return (
      <section className="grid min-h-[50vh] place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Organization unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This Organization does not exist or your Membership is inactive.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <MemberDirectory organizationId={organization.id} />
      <InvitationManager organizationId={organization.id} />
    </div>
  );
}
