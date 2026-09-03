"use client";

import { type ReactNode, useEffect, useReducer } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { AppShell } from "@/components/app-shell";

function organizationSlugFromPathname(pathname: string) {
  return pathname.match(/^\/org\/([^/]+)/)?.[1] ?? null;
}

function WorkspaceLoading() {
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-6">
      <p className="text-muted-foreground text-sm" role="status">
        Loading your workspace…
      </p>
    </main>
  );
}

export function AuthenticatedApplicationShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const organizations = useQuery(api.organizations.listMine, {});
  const routeOrganizationSlug = organizationSlugFromPathname(pathname);
  const [lastOrganizationSlug, rememberOrganizationSlug] = useReducer(
    (_current: string | null, next: string) => next,
    routeOrganizationSlug,
  );

  useEffect(() => {
    if (routeOrganizationSlug) {
      rememberOrganizationSlug(routeOrganizationSlug);
    }
  }, [routeOrganizationSlug]);

  useEffect(() => {
    if (organizations && pathname === "/onboarding" && organizations[0]) {
      router.replace(`/org/${organizations[0].slug}/dashboard`);
      return;
    }
    if (
      organizations?.length === 0 &&
      pathname !== "/onboarding" &&
      !pathname.startsWith("/account")
    ) {
      router.replace("/onboarding");
    }
  }, [organizations, pathname, router]);

  if (pathname === "/onboarding") {
    return organizations?.length === 0 ? children : <WorkspaceLoading />;
  }

  if (!organizations) {
    return <WorkspaceLoading />;
  }

  const preferredSlug =
    routeOrganizationSlug ?? lastOrganizationSlug ?? organizations[0]?.slug;
  const organization = organizations.find(({ slug }) => slug === preferredSlug);

  if (!organization) {
    return children;
  }

  return (
    <AppShell
      organizationId={organization.id}
      organizationLogoUrl={organization.logoUrl}
      organizationName={organization.name}
      organizationPublicSlug={organization.publicSlug}
      organizationSlug={organization.slug}
    >
      {children}
    </AppShell>
  );
}
