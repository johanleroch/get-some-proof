"use client";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { ProjectsPageSkeleton } from "@/components/ui/page-skeletons";
import { ProjectManager } from "./project-manager";

export function OrganizationProjects({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });

  if (organization === undefined) {
    return <ProjectsPageSkeleton />;
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

  return <ProjectManager organizationId={organization.id} />;
}
