import type { Route } from "next";
import { redirect } from "next/navigation";

import { AcceptInvitation } from "@/components/invitations/accept-invitation";
import { isAuthenticated } from "@/lib/auth-server";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="bg-muted/30 grid min-h-svh place-items-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Invitation unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This link is incomplete. Ask an Organization admin for a new one.
          </p>
        </div>
      </main>
    );
  }

  if (!(await isAuthenticated())) {
    const callbackURL = `/accept-invitation?token=${encodeURIComponent(token)}`;
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}` as Route,
    );
  }

  return <AcceptInvitation token={token} />;
}
