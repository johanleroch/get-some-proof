"use client";

import { useProjectShell } from "@/components/organizations/project-shell-context";
import { BrandDashboardView } from "@/components/organizations/organization-dashboard";
import { OverviewPageSkeleton } from "@/components/ui/page-skeletons";

export function OverviewRouteLoading() {
  const project = useProjectShell();
  if (!project) return <OverviewPageSkeleton />;

  return (
    <BrandDashboardView
      accountLoading
      copyCollectionUrl={() =>
        Promise.reject(new Error("Collection link is still loading."))
      }
      name={project.brandName}
      pendingCount={project.pendingCount}
      publicSlug={project.publicSlug}
      slug={project.slug}
    />
  );
}
