"use client";

// The shell fixtures mount the real project switcher and user row, which take
// callbacks: a server component cannot hand a function to a client one.
import type { ReactNode } from "react";

import type { Id } from "@convex/_generated/dataModel";
import { NavUserView } from "@/components/account/nav-user";
import { AppShellView } from "@/components/app-shell";
import { OrganizationSwitcherView } from "@/components/organizations/organization-switcher";
import { OverviewRouteLoading } from "@/components/organizations/overview-route-loading";
import { StudioRouteLoading } from "@/components/studio/studio-route-loading";
import { InboxRouteLoading } from "@/components/testimonials/inbox-route-loading";

/** The shell fixtures show the real project switcher, logo and all. */
const atraktLogo = "/fixtures/bumpr-logo.svg";

export function WorkspacePageShell({
  children,
  inboxCount,
  pathname,
}: {
  children: ReactNode;
  inboxCount?: number;
  pathname: string;
}) {
  return (
    <AppShellView
      account={{
        effectivePlan: "free",
        freeProjectId: "fixture-atrakt" as Id<"organizations">,
      }}
      connected
      inboxCount={inboxCount}
      organizationId={"fixture-atrakt" as Id<"organizations">}
      organizationName="Atrakt"
      organizationPublicSlug="atrakt"
      organizationSlug="atrakt"
      pathname={pathname}
      projectSwitcher={
        <OrganizationSwitcherView
          canCreateProject={false}
          canReadAudit={false}
          canReadBilling={false}
          canUpdateOrganization
          currentLogoUrl={atraktLogo}
          currentName="Atrakt"
          currentSlug="atrakt"
          loadMore={() => undefined}
          organizations={[
            {
              id: "fixture-atrakt",
              logoUrl: atraktLogo,
              name: "Atrakt",
              slug: "atrakt",
            },
          ]}
          status="Exhausted"
          switchProject={() => undefined}
        />
      }
      userMenu={
        <NavUserView
          signOut={async () => undefined}
          user={{ email: "alex@example.test", name: "Alex Morgan" }}
        />
      }
    >
      {children}
    </AppShellView>
  );
}

export function OverviewLoadingFixture() {
  return (
    <WorkspacePageShell inboxCount={3} pathname="/org/atrakt/dashboard">
      <OverviewRouteLoading />
    </WorkspacePageShell>
  );
}

export function InboxLoadingFixture() {
  return (
    <WorkspacePageShell pathname="/org/atrakt/inbox">
      <InboxRouteLoading />
    </WorkspacePageShell>
  );
}

export function StudioLoadingFixture() {
  return (
    <WorkspacePageShell pathname="/org/atrakt/studio">
      <StudioRouteLoading />
    </WorkspacePageShell>
  );
}
