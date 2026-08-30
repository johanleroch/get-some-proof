import type { Route } from "next";

const safeOrganizationSections = new Set(["dashboard", "members", "projects"]);

export function organizationSwitchRoute(pathname: string, nextSlug: string) {
  const currentSection = pathname.split("/").filter(Boolean)[2];
  const nextSection =
    currentSection && safeOrganizationSections.has(currentSection)
      ? currentSection
      : "dashboard";

  return `/org/${nextSlug}/${nextSection}` as Route;
}
