"use client";

import { type ReactNode, useEffect, useReducer } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { BlobLoaderScreen } from "@/components/brand/blob-loader";
import { AppShell } from "@/components/app-shell";

function organizationSlugFromPathname(pathname: string) {
  return pathname.match(/^\/org\/([^/]+)/)?.[1] ?? null;
}

export function AuthenticatedApplicationShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const account = useQuery(api.accounts.getMine, isAuthenticated ? {} : "skip");
  const organizations = useQuery(
    api.organizations.listMine,
    isAuthenticated ? {} : "skip",
  );
  const routeOrganizationSlug = organizationSlugFromPathname(pathname);
  const [lastOrganizationSlug, rememberOrganizationSlug] = useReducer(
    (_current: string | null, next: string) => next,
    routeOrganizationSlug,
  );
  const querySlug = routeOrganizationSlug ?? lastOrganizationSlug;
  const routeOrganization = useQuery(
    api.organizations.getBySlug,
    isAuthenticated && querySlug ? { slug: querySlug } : "skip",
  );

  useEffect(() => {
    if (routeOrganizationSlug) {
      rememberOrganizationSlug(routeOrganizationSlug);
    }
  }, [routeOrganizationSlug]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (!isLoading) router.replace("/sign-in?callbackURL=/dashboard");
      return;
    }
    if (
      account?.deletionStartedAt !== undefined &&
      pathname !== "/account/billing"
    ) {
      router.replace("/account/billing");
      return;
    }
    if (organizations && pathname === "/onboarding" && organizations[0]) {
      router.replace(`/org/${organizations[0].slug}/dashboard`);
      return;
    }
    if (
      account !== undefined &&
      organizations?.length === 0 &&
      pathname !== "/onboarding" &&
      !pathname.startsWith("/account")
    ) {
      router.replace(account ? "/account/billing" : "/onboarding");
    }
  }, [account, organizations, pathname, router, isAuthenticated, isLoading]);

  if (!isAuthenticated) return <BlobLoaderScreen />;

  if (account?.deletionStartedAt !== undefined)
    return pathname === "/account/billing" ? children : <BlobLoaderScreen />;

  if (pathname === "/onboarding") {
    return organizations?.length === 0 ? children : <BlobLoaderScreen />;
  }

  if (!organizations) {
    return <BlobLoaderScreen />;
  }

  const preferredSlug =
    routeOrganizationSlug ?? lastOrganizationSlug ?? organizations[0]?.slug;
  const organization =
    routeOrganization ??
    organizations.find(({ slug }) => slug === preferredSlug);

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
