import type { ReactNode } from "react";

import type { Id } from "@convex/_generated/dataModel";
import { AppShellView } from "@/components/app-shell";
import {
  InboxPageSkeleton,
  OverviewPageSkeleton,
  StudioPageSkeleton,
} from "@/components/ui/page-skeletons";

function LoadingPageShell({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  return (
    <AppShellView
      account={{
        effectivePlan: "free",
        freeProjectId: "fixture-atrakt" as Id<"organizations">,
      }}
      authorization={{
        can: { manageOwnership: true, updateOrganization: true },
      }}
      connected
      inboxCount={undefined}
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
    <LoadingPageShell pathname="/org/atrakt/dashboard">
      <OverviewPageSkeleton name="Atrakt" />
    </LoadingPageShell>
  );
}

export function InboxLoadingFixture() {
  return (
    <LoadingPageShell pathname="/org/atrakt/inbox">
      <InboxPageSkeleton />
    </LoadingPageShell>
  );
}

export function StudioLoadingFixture() {
  return (
    <LoadingPageShell pathname="/org/atrakt/studio">
      <StudioPageSkeleton />
    </LoadingPageShell>
  );
}
