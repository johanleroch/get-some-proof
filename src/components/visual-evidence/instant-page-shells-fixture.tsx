import type { ReactNode } from "react";

import type { Id } from "@convex/_generated/dataModel";
import { AppShellView } from "@/components/app-shell";
import { OverviewRouteLoading } from "@/components/organizations/overview-route-loading";
import { StudioRouteLoading } from "@/components/studio/studio-route-loading";
import { InboxRouteLoading } from "@/components/testimonials/inbox-route-loading";

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
        <button className="type-heading px-3 py-2" type="button">
          Atrakt
        </button>
      }
      userMenu={<p className="type-small px-3 py-2">Alex Morgan</p>}
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
