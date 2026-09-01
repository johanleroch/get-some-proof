"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
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

type Member = {
  id: Id<"memberships">;
  userId: string;
  displayName: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer" | null;
};

export function MemberDirectory({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const router = useRouter();
  const members = useQuery(api.members.list, { organizationId });
  const access = useQuery(api.organizationAuthorization.getMine, {
    organizationId,
  });
  const currentUser = useQuery(api.auth.getCurrentUser, {});
  const history = useQuery(
    api.members.listHistory,
    access?.can.manageMembers ? { organizationId } : "skip",
  );
  const changeRole = useMutation(api.members.changeRole);
  const removeMember = useMutation(api.members.remove);
  const leaveOrganization = useMutation(api.members.leave);
  const [confirmation, setConfirmation] = useState<
    { type: "leave" } | { type: "remove"; member: Member } | null
  >(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!members || !access || currentUser === undefined) {
    return <DirectoryLoadingSkeleton />;
  }

  async function updateRole(member: Member, role: NonNullable<Member["role"]>) {
    setError(null);
    setSuccess(null);
    try {
      await changeRole({ organizationId, membershipId: member.id, role });
      setSuccess(`${member.displayName} is now ${role}.`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Role change failed.",
      );
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
      setError(
        caught instanceof Error ? caught.message : "Member action failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="dashboard-page-title">Members</h1>
          <p className="dashboard-page-description mt-1">
            Active Members can see this directory. Management actions follow the
            Owner and Admin boundary.
          </p>
        </div>
        <Button
          onClick={() => setConfirmation({ type: "leave" })}
          variant="outline"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Leave Organization
        </Button>
      </div>

      {error ? (
        <p aria-live="assertive" className="mt-5 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {success ? (
        <p aria-live="polite" className="mt-5 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      <div className="dashboard-panel mt-6 divide-y overflow-hidden">
        {members.map((member) => {
          const isCurrentUser = currentUser?.id === member.userId;
          const canAdminister =
            access.can.manageMembers &&
            !isCurrentUser &&
            (member.role !== "owner" || access.can.manageOwnership);

          return (
            <div
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
              key={member.id}
            >
              <div className="bg-foreground text-background grid size-9 place-items-center rounded-full text-sm font-semibold">
                {member.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.displayName} {isCurrentUser ? "(you)" : ""}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {member.email}
                </p>
              </div>
              {canAdminister ? (
                <select
                  aria-label={`Role for ${member.displayName}`}
                  className="border-input h-9 rounded-md border bg-transparent px-3 text-sm capitalize"
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
                <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs capitalize">
                  {member.role ?? "No role"}
                </span>
              )}
              {canAdminister ? (
                <Button
                  aria-label={`Remove ${member.displayName}`}
                  onClick={() => setConfirmation({ type: "remove", member })}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="size-4 text-red-600" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {history && history.length > 0 ? (
        <details className="bg-muted/20 mt-4 rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Former Members ({history.length})
          </summary>
          <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
            {history.map((member) => (
              <li key={member.id}>
                {member.displayName} · {member.email}
              </li>
            ))}
          </ul>
        </details>
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
                  ? "Leave Organization?"
                  : "Remove Member?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation.type === "leave"
                  ? "Your Membership and Organization roles will be deactivated."
                  : `${confirmation.member.displayName} will lose access, while historical attribution is preserved.`}
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
