import type { ReactNode } from "react";

import type { Id } from "@convex/_generated/dataModel";
import { AppShellView } from "@/components/app-shell";
import { OverviewRouteLoading } from "@/components/organizations/overview-route-loading";
import { StudioRouteLoading } from "@/components/studio/studio-route-loading";
import { InboxRouteLoading } from "@/components/testimonials/inbox-route-loading";

function LoadingPageShell({
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
    <LoadingPageShell inboxCount={3} pathname="/org/atrakt/dashboard">
      <OverviewRouteLoading />
    </LoadingPageShell>
  );
}

export function InboxLoadingFixture() {
  return (
    <LoadingPageShell pathname="/org/atrakt/inbox">
      <InboxRouteLoading />
    </LoadingPageShell>
  );
}

export function StudioLoadingFixture() {
  return (
    <LoadingPageShell pathname="/org/atrakt/studio">
      <StudioRouteLoading />
    </LoadingPageShell>
  );
}
