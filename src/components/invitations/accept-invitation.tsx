"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";

function invitationAcceptanceError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";

  if (message.includes("INVITATION_UNAVAILABLE")) {
    return "This invitation has expired, was revoked, or was already used. Ask an Organization admin for a new invitation.";
  }
  if (message.includes("INVITATION_EMAIL_MISMATCH")) {
    return "Sign in with the verified email address that received this invitation.";
  }
  if (message.includes("EMAIL_NOT_VERIFIED")) {
    return "Verify your email address before accepting this invitation.";
  }

  return "This invitation cannot be accepted. Ask an Organization admin for a new invitation.";
}

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const accept = useMutation(api.invitations.accept);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acceptInvitation() {
    setPending(true);
    setError(null);
    try {
      const result = await accept({ token });
      router.replace(`/org/${result.organizationSlug}/dashboard` as Route);
    } catch (caught) {
      setError(invitationAcceptanceError(caught));
      setPending(false);
    }
  }

  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-6">
      <div className="bg-card w-full max-w-md rounded-xl border p-7 text-center shadow-xs">
        <p className="text-muted-foreground text-sm font-medium">
          Organization Invitation
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Join the Organization</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          Your verified account email must match the address that received this
          link.
        </p>
        {error ? (
          <p
            aria-live="assertive"
            className="mt-5 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <Button
          className="mt-6 w-full"
          disabled={pending}
          onClick={() => void acceptInvitation()}
        >
          {pending ? "Accepting…" : "Accept Invitation"}
        </Button>
      </div>
    </main>
  );
}
