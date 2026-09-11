"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Id } from "@convex/_generated/dataModel";

export type ProjectShellValue = {
  brandName: string;
  organizationId: Id<"organizations">;
  pendingCount?: number;
  publicSlug: string;
  slug: string;
};

const ProjectShellContext = createContext<ProjectShellValue | null>(null);

export function ProjectShellProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ProjectShellValue;
}) {
  return (
    <ProjectShellContext.Provider value={value}>
      {children}
    </ProjectShellContext.Provider>
  );
}

export function useProjectShell() {
  return useContext(ProjectShellContext);
}
