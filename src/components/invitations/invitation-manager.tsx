"use client";

import { type FormEvent, useState } from "react";
import { MailPlus, RefreshCw, X } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InvitationManager({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const access = useQuery(api.organizationAuthorization.getMine, {
    organizationId,
  });
  const invitations = useQuery(
    api.invitations.listPending,
    access?.can.manageMembers ? { organizationId } : "skip",
  );
  const createInvitation = useAction(api.invitations.create);
  const resendInvitation = useAction(api.invitations.resend);
  const changeRole = useAction(api.invitations.changeRole);
  const revokeInvitation = useMutation(api.invitations.revoke);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(formElement);
    try {
      await createInvitation({
        organizationId,
        email: String(form.get("email")),
        role: String(form.get("role")) as "admin" | "editor" | "viewer",
      });
      formElement.reset();
      setSuccess("Invitation sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation failed.");
    } finally {
      setPending(false);
    }
  }

  if (access === undefined) {
    return <p className="text-muted-foreground text-sm">Loading Members…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Invitations</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Invite people with a fixed initial role. Owner access is managed
          separately.
        </p>
      </div>

      {access.can.manageMembers ? (
        <form
          className="bg-card grid gap-4 rounded-2xl border p-5 shadow-sm md:grid-cols-[1fr_160px_auto] md:items-end"
          onSubmit={invite}
        >
          <div className="space-y-2">
            <Label htmlFor="invitation-email">Email address</Label>
            <Input id="invitation-email" name="email" required type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invitation-role">Initial role</Label>
            <select
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              defaultValue="viewer"
              id="invitation-role"
              name="role"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button disabled={pending} type="submit">
            <MailPlus aria-hidden="true" className="size-4" />
            {pending ? "Sending…" : "Invite"}
          </Button>
        </form>
      ) : (
        <p className="bg-muted/40 text-muted-foreground rounded-xl border p-4 text-sm">
          Your role can view Members but cannot manage Invitations.
        </p>
      )}

      {error ? (
        <p aria-live="assertive" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {success ? (
        <p aria-live="polite" className="text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      {invitations ? (
        <section>
          <h2 className="text-lg font-semibold">Pending Invitations</h2>
          {invitations.length === 0 ? (
            <p className="text-muted-foreground mt-3 rounded-xl border border-dashed p-6 text-sm">
              No pending Invitations.
            </p>
          ) : (
            <div className="bg-card mt-3 divide-y rounded-2xl border">
              {invitations.map((invitation) => (
                <div
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                  key={invitation.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {invitation.email}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs capitalize">
                      {invitation.deliveryStatus} · expires{" "}
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <select
                    aria-label={`Role for ${invitation.email}`}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm capitalize"
                    onChange={(event) =>
                      void changeRole({
                        organizationId,
                        invitationId: invitation.id,
                        role: event.target.value as
                          "admin" | "editor" | "viewer",
                      })
                    }
                    value={invitation.role}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="flex gap-1">
                    <Button
                      aria-label={`Resend to ${invitation.email}`}
                      onClick={() =>
                        void resendInvitation({
                          organizationId,
                          invitationId: invitation.id,
                        })
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <RefreshCw aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      aria-label={`Revoke ${invitation.email}`}
                      onClick={() =>
                        void revokeInvitation({
                          organizationId,
                          invitationId: invitation.id,
                        })
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
