"use client";

import { useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { InvitationManager } from "@/components/invitations/invitation-manager";
import { MemberDirectory } from "@/components/members/member-directory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MembersPageSkeleton } from "@/components/ui/page-skeletons";

type MembersView = "members" | "invitations" | "history";

export function OrganizationMembers({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const access = useQuery(
    api.organizationAuthorization.getMine,
    organization ? { organizationId: organization.id } : "skip",
  );
  const invitations = useQuery(
    api.invitations.listPending,
    organization && access?.can.manageMembers
      ? { organizationId: organization.id }
      : "skip",
  );
  const [view, setView] = useState<MembersView>("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  if (organization === undefined || (organization && access === undefined)) {
    return <MembersPageSkeleton />;
  }

  if (organization === null) {
    return (
      <section className="grid min-h-[50vh] place-items-center px-6 text-center">
        <div>
          <h1 className="dashboard-page-title">Organization unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This Organization does not exist or your Membership is inactive.
          </p>
        </div>
      </section>
    );
  }

  if (!access) return <MembersPageSkeleton />;

  const pendingCount = invitations ? ` (${invitations.length})` : "";
  const availableViews: Array<{
    id: MembersView;
    label: string;
    mobileLabel: string;
  }> = [
    { id: "members", label: "Members", mobileLabel: "Members" },
    ...(access.can.manageMembers
      ? [
          {
            id: "invitations" as const,
            label: `Pending invitations${pendingCount}`,
            mobileLabel: `Pending${pendingCount}`,
          },
          {
            id: "history" as const,
            label: "Former members",
            mobileLabel: "Former",
          },
        ]
      : []),
  ];

  const selectedView = availableViews.some(({ id }) => id === view)
    ? view
    : "members";

  function selectView(nextView: MembersView) {
    setView(nextView);
    setSearchQuery("");
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="dashboard-page-title">Members</h1>
          <p className="dashboard-page-description mt-1 max-w-2xl">
            Manage who belongs to this organization, their role, and pending
            invitations.
          </p>
        </div>
        {access.can.manageMembers ? (
          <Button onClick={() => setInviteOpen(true)}>Invite people</Button>
        ) : null}
      </header>

      <div
        aria-label="Member management views"
        className="mt-6 flex gap-5 overflow-x-auto border-b"
        role="tablist"
      >
        {availableViews.map((item) => (
          <button
            aria-label={item.label}
            aria-selected={selectedView === item.id}
            className={`focus-visible:after:bg-ring relative shrink-0 pb-2.5 text-sm font-medium transition-colors outline-none after:absolute after:inset-x-0 after:bottom-[-1px] after:rounded-full focus-visible:after:h-1 ${
              selectedView === item.id
                ? "text-foreground after:bg-foreground after:h-0.5"
                : "text-muted-foreground hover:text-foreground"
            }`}
            key={item.id}
            onClick={() => selectView(item.id)}
            role="tab"
            type="button"
          >
            <span aria-hidden="true" className="sm:hidden">
              {item.mobileLabel}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="my-4">
        <Input
          aria-label={
            selectedView === "invitations"
              ? "Search pending invitations"
              : selectedView === "history"
                ? "Search former members"
                : "Search members"
          }
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={
            selectedView === "invitations"
              ? "Search pending invitations by email, role, or inviter"
              : selectedView === "history"
                ? "Search former members by name or email"
                : "Search members by name, email, or role"
          }
          type="search"
          value={searchQuery}
        />
      </div>

      {selectedView !== "invitations" ? (
        <MemberDirectory
          organizationId={organization.id}
          searchQuery={searchQuery}
          view={selectedView === "history" ? "history" : "active"}
        />
      ) : null}

      {access.can.manageMembers ? (
        <InvitationManager
          invitations={invitations}
          inviteOpen={inviteOpen}
          onInvitationCreated={() => selectView("invitations")}
          onInviteOpenChange={setInviteOpen}
          organizationId={organization.id}
          searchQuery={searchQuery}
          showList={selectedView === "invitations"}
        />
      ) : null}
    </div>
  );
}
