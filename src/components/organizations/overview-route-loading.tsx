"use client";

import { useProjectShell } from "@/components/organizations/project-shell-context";
import { OverviewPageSkeleton } from "@/components/ui/page-skeletons";

export function OverviewRouteLoading() {
  const project = useProjectShell();
  return <OverviewPageSkeleton name={project?.brandName} />;
}
