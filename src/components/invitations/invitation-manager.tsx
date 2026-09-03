"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShortDate } from "@/lib/format-date";

export type PendingInvitation = FunctionReturnType<
  typeof api.invitations.listPending
>[number];

type PendingAction = {
  invitationId: Id<"invitations">;
  kind: "role" | "resend" | "revoke";
} | null;

function invitationErrorMessage(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";

  if (message.includes("INVITATION_ALREADY_PENDING")) {
    return "A pending invitation already exists for this email address.";
  }
  if (message.includes("INVALID_INVITATION_EMAIL")) {
    return "Enter a valid email address.";
  }
  if (message.includes("INVITATION_UNAVAILABLE")) {
    return "This invitation is no longer available. Refresh and try again.";
  }

  return "We couldn’t complete this invitation action. Please try again.";
}

export function InvitationManager({
  organizationId,
  invitations,
  inviteOpen,
  onInvitationCreated,
  onInviteOpenChange,
  searchQuery,
  showList,
}: {
  organizationId: Id<"organizations">;
  invitations: PendingInvitation[] | undefined;
  inviteOpen: boolean;
  onInvitationCreated?: () => void;
  onInviteOpenChange: (open: boolean) => void;
  searchQuery: string;
  showList: boolean;
}) {
  const createInvitation = useAction(api.invitations.create);
  const resendInvitation = useAction(api.invitations.resend);
  const changeRole = useAction(api.invitations.changeRole);
  const revokeInvitation = useMutation(api.invitations.revoke);
  const [invitePending, setInvitePending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [currentTime] = useState(() => Date.now());
  const [revokeTarget, setRevokeTarget] = useState<PendingInvitation | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredInvitations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!invitations || normalizedQuery.length === 0) return invitations;

    return invitations.filter(
      (invitation) =>
        invitation.email.toLowerCase().includes(normalizedQuery) ||
        invitation.role.includes(normalizedQuery) ||
        invitation.invitedByDisplayName.toLowerCase().includes(normalizedQuery),
    );
  }, [invitations, searchQuery]);

  function clearFeedback() {
    setError(null);
    setSuccess(null);
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email")).trim();
    setInvitePending(true);
    clearFeedback();

    try {
      await createInvitation({
        organizationId,
        email,
        role: String(form.get("role")) as "admin" | "editor" | "viewer",
      });
      formElement.reset();
      onInviteOpenChange(false);
      setSuccess(`Invitation sent to ${email}.`);
      onInvitationCreated?.();
    } catch (caught) {
      setError(invitationErrorMessage(caught));
    } finally {
      setInvitePending(false);
    }
  }

  async function runRowAction(
    invitation: PendingInvitation,
    kind: Exclude<PendingAction, null>["kind"],
    operation: () => Promise<unknown>,
  ) {
    setPendingAction({ invitationId: invitation.id, kind });
    clearFeedback();
    try {
      await operation();
      setSuccess(
        kind === "resend"
          ? `A new invitation was sent to ${invitation.email}.`
          : kind === "role"
            ? `The initial role for ${invitation.email} was updated.`
            : `The invitation for ${invitation.email} was revoked.`,
      );
      if (kind === "revoke") setRevokeTarget(null);
    } catch (caught) {
      setError(invitationErrorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section aria-label="Pending invitations">
      {showList && error ? (
        <div
          aria-live="assertive"
          className="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {showList && success ? (
        <div
          aria-live="polite"
          className="mb-4 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          {success}
        </div>
      ) : null}

      {!showList ? null : filteredInvitations === undefined ? (
        <div aria-label="Loading Pending Invitations" role="status">
          <div className="dashboard-skeleton h-12 rounded-md" />
          <div className="dashboard-skeleton mt-2 h-20 rounded-md" />
          <span className="sr-only">Loading Pending Invitations</span>
        </div>
      ) : filteredInvitations.length === 0 ? (
        <div className="border-border/70 rounded-lg border border-dashed px-6 py-12 text-center">
          <h2 className="text-sm font-medium">
            {searchQuery ? "No invitations found" : "No pending invitations"}
          </h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            {searchQuery
              ? "Try a different email address, role, or inviter."
              : "New invitations will appear here until they are accepted or revoked."}
          </p>
        </div>
      ) : (
        <div className="border-border/70 overflow-hidden rounded-lg border">
          <div className="bg-muted/35 text-muted-foreground hidden grid-cols-[minmax(0,1fr)_9rem_10rem_auto] gap-4 border-b px-4 py-2 text-xs font-medium sm:grid">
            <span>Email</span>
            <span>Initial role</span>
            <span>Sent</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y">
            {filteredInvitations.map((invitation) => {
              const expired = invitation.expiresAt <= currentTime;
              const isBusy = pendingAction?.invitationId === invitation.id;
              const statusLabel = expired
                ? "Expired"
                : invitation.deliveryStatus === "failed"
                  ? "Delivery failed"
                  : invitation.deliveryStatus === "pending"
                    ? "Sending"
                    : "Pending";

              return (
                <div
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_auto] sm:items-center sm:gap-4"
                  key={invitation.id}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {invitation.email}
                      </p>
                      <span
                        className={
                          expired || invitation.deliveryStatus === "failed"
                            ? "bg-destructive/10 text-destructive shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            : "bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        }
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      Invited by {invitation.invitedByDisplayName} · Expires{" "}
                      {formatShortDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <label className="grid grid-cols-[5rem_1fr] items-center gap-2 text-xs sm:block">
                    <span className="text-muted-foreground sm:sr-only">
                      Initial role
                    </span>
                    <select
                      aria-label={`Role for ${invitation.email}`}
                      className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-xs capitalize"
                      disabled={isBusy}
                      onChange={(event) =>
                        void runRowAction(invitation, "role", () =>
                          changeRole({
                            organizationId,
                            invitationId: invitation.id,
                            role: event.target.value as
                              "admin" | "editor" | "viewer",
                          }),
                        )
                      }
                      value={invitation.role}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <div className="text-muted-foreground grid grid-cols-[5rem_1fr] items-center gap-2 text-xs sm:block">
                    <span className="sm:sr-only">Sent</span>
                    <span>{formatShortDate(invitation.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1 sm:justify-end">
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        void runRowAction(invitation, "resend", () =>
                          resendInvitation({
                            organizationId,
                            invitationId: invitation.id,
                          }),
                        )
                      }
                      size="sm"
                      variant="outline"
                    >
                      {pendingAction?.invitationId === invitation.id &&
                      pendingAction.kind === "resend"
                        ? "Sending…"
                        : "Resend"}
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() => setRevokeTarget(invitation)}
                      size="sm"
                      variant="ghost"
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog onOpenChange={onInviteOpenChange} open={inviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite people</DialogTitle>
            <DialogDescription>
              Send a time-limited, single-use invitation with an initial role.
              Owner access is managed separately.
            </DialogDescription>
          </DialogHeader>
          <form className="mt-2 space-y-5" onSubmit={invite}>
            {error ? (
              <div
                aria-live="assertive"
                className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
                role="alert"
              >
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="invitation-email">Email address</Label>
              <Input
                autoComplete="email"
                autoFocus
                id="invitation-email"
                name="email"
                placeholder="person@company.com"
                required
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitation-role">Initial role</Label>
              <select
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                defaultValue="viewer"
                id="invitation-role"
                name="role"
              >
                <option value="viewer">Viewer · view organization data</option>
                <option value="editor">Editor · create and edit work</option>
                <option value="admin">Admin · manage members and data</option>
              </select>
              <p className="text-muted-foreground text-xs">
                The role can be changed while the invitation is pending.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => onInviteOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={invitePending} type="submit">
                {invitePending ? "Sending invitation…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        open={revokeTarget !== null}
      >
        {revokeTarget ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
              <AlertDialogDescription>
                The link sent to {revokeTarget.email} will stop working
                immediately. This action is recorded in the audit log.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void runRowAction(revokeTarget, "revoke", () =>
                      revokeInvitation({
                        organizationId,
                        invitationId: revokeTarget.id,
                      }),
                    )
                  }
                  variant="destructive"
                >
                  {pendingAction?.kind === "revoke" ? "Revoking…" : "Revoke"}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </section>
  );
}
