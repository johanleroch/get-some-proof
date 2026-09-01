"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DirectoryLoadingSkeleton } from "@/components/ui/page-skeletons";
import { formatShortDate } from "@/lib/format-date";

type Member = {
  id: Id<"memberships">;
  userId: string;
  displayName: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer" | null;
  status: "active" | "inactive";
  createdAt: number;
  updatedAt: number;
};

function memberErrorMessage(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";

  if (message.includes("LAST_OWNER_REQUIRED")) {
    return "Every organization must keep at least one owner.";
  }
  if (message.includes("MEMBERSHIP_UNAVAILABLE")) {
    return "This membership is no longer available. Refresh and try again.";
  }

  return "We couldn’t complete this member action. Please try again.";
}

export function MemberDirectory({
  organizationId,
  searchQuery,
  view,
}: {
  organizationId: Id<"organizations">;
  searchQuery: string;
  view: "active" | "history";
}) {
  const router = useRouter();
  const members = useQuery(api.members.list, { organizationId });
  const access = useQuery(api.organizationAuthorization.getMine, {
    organizationId,
  });
  const currentUser = useQuery(api.auth.getCurrentUser, {});
  const history = useQuery(
    api.members.listHistory,
    access?.can.manageMembers && view === "history"
      ? { organizationId }
      : "skip",
  );
  const changeRole = useMutation(api.members.changeRole);
  const removeMember = useMutation(api.members.remove);
  const leaveOrganization = useMutation(api.members.leave);
  const [confirmation, setConfirmation] = useState<
    { type: "leave" } | { type: "remove"; member: Member } | null
  >(null);
  const [pending, setPending] = useState(false);
  const [pendingMemberId, setPendingMemberId] =
    useState<Id<"memberships"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const visibleMembers = useMemo(() => {
    const source = view === "active" ? members : history;
    if (!source) return source;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return source;

    return source.filter(
      (member) =>
        member.displayName.toLowerCase().includes(normalizedQuery) ||
        member.email.toLowerCase().includes(normalizedQuery) ||
        member.role?.includes(normalizedQuery),
    );
  }, [history, members, searchQuery, view]);

  if (
    members === undefined ||
    access === undefined ||
    currentUser === undefined ||
    (view === "history" && history === undefined)
  ) {
    return <DirectoryLoadingSkeleton />;
  }

  async function updateRole(member: Member, role: NonNullable<Member["role"]>) {
    setPendingMemberId(member.id);
    setError(null);
    setSuccess(null);
    try {
      await changeRole({ organizationId, membershipId: member.id, role });
      setSuccess(`${member.displayName} is now ${role}.`);
    } catch (caught) {
      setError(memberErrorMessage(caught));
    } finally {
      setPendingMemberId(null);
    }
  }

  async function confirmAction() {
    if (!confirmation) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      if (confirmation.type === "leave") {
        await leaveOrganization({ organizationId });
        router.replace("/dashboard");
        return;
      }
      await removeMember({
        organizationId,
        membershipId: confirmation.member.id,
      });
      setSuccess(`${confirmation.member.displayName} was removed.`);
      setConfirmation(null);
    } catch (caught) {
      setError(memberErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const emptyTitle =
    view === "history"
      ? searchQuery
        ? "No former members found"
        : "No former members"
      : "No members found";

  return (
    <section aria-label={view === "active" ? "Members" : "Former members"}>
      {error ? (
        <div
          aria-live="assertive"
          className="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          aria-live="polite"
          className="mb-4 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          {success}
        </div>
      ) : null}

      {visibleMembers?.length === 0 ? (
        <div className="border-border/70 rounded-lg border border-dashed px-6 py-12 text-center">
          <h2 className="text-sm font-medium">{emptyTitle}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {searchQuery
              ? "Try a different name, email address, or role."
              : "Removed members will appear here with their history preserved."}
          </p>
        </div>
      ) : (
        <div className="border-border/70 overflow-hidden rounded-lg border">
          <div
            className={`bg-muted/35 text-muted-foreground hidden gap-4 border-b px-4 py-2 text-xs font-medium sm:grid ${
              view === "active"
                ? "grid-cols-[minmax(0,1fr)_9rem_9rem_auto]"
                : "grid-cols-[minmax(0,1fr)_9rem_9rem]"
            }`}
          >
            <span>Member</span>
            <span>Role</span>
            <span>{view === "active" ? "Joined" : "Removed"}</span>
            {view === "active" ? (
              <span className="text-right">Actions</span>
            ) : null}
          </div>
          <div className="divide-y">
            {visibleMembers?.map((member) => {
              const isCurrentUser = currentUser?.id === member.userId;
              const canAdminister =
                view === "active" &&
                access.can.manageMembers &&
                !isCurrentUser &&
                (member.role !== "owner" || access.can.manageOwnership);

              return (
                <div
                  className={`grid gap-3 px-4 py-3 sm:items-center sm:gap-4 ${
                    view === "active"
                      ? "sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]"
                      : "sm:grid-cols-[minmax(0,1fr)_9rem_9rem]"
                  }`}
                  key={member.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-foreground text-background grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
                      {member.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.displayName} {isCurrentUser ? "(you)" : ""}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-[5rem_1fr] items-center gap-2 text-xs sm:block">
                    <span className="text-muted-foreground sm:sr-only">
                      Role
                    </span>
                    {canAdminister ? (
                      <select
                        aria-label={`Role for ${member.displayName}`}
                        className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-xs capitalize"
                        disabled={pendingMemberId === member.id}
                        onChange={(event) =>
                          void updateRole(
                            member,
                            event.target.value as NonNullable<Member["role"]>,
                          )
                        }
                        value={member.role ?? "viewer"}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                        {access.can.manageOwnership ? (
                          <option value="owner">Owner</option>
                        ) : null}
                      </select>
                    ) : (
                      <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2 py-1 text-xs capitalize">
                        {view === "history"
                          ? "Former"
                          : (member.role ?? "No role")}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground grid grid-cols-[5rem_1fr] items-center gap-2 text-xs sm:block">
                    <span className="sm:sr-only">
                      {view === "active" ? "Joined" : "Removed"}
                    </span>
                    <span>
                      {formatShortDate(
                        view === "active" ? member.createdAt : member.updatedAt,
                      )}
                    </span>
                  </div>
                  {view === "active" ? (
                    <div className="flex sm:justify-end">
                      {canAdminister ? (
                        <Button
                          onClick={() =>
                            setConfirmation({ type: "remove", member })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          Remove
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "active" ? (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => setConfirmation({ type: "leave" })}
            size="sm"
            variant="outline"
          >
            Leave organization
          </Button>
        </div>
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        open={confirmation !== null}
      >
        {confirmation ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmation.type === "leave"
                  ? "Leave organization?"
                  : "Remove member?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation.type === "leave"
                  ? "Your membership and organization roles will be deactivated. Historical attribution will be preserved."
                  : `${confirmation.member.displayName} will lose access immediately. Their historical attribution will be preserved.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  disabled={pending}
                  onClick={() => void confirmAction()}
                  variant="destructive"
                >
                  {pending ? "Working…" : "Confirm"}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </section>
  );
}
