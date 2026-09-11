"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { assistantReuseRightsText } from "@convex/domain/testimonialImport";
import { Checkbox } from "@/components/ui/checkbox";
import { isImportOAuthRedirect } from "@/lib/chatgpt/oauth-redirect";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { BlobLoader } from "@/components/brand/blob-loader";

type ClientDetails = { name: string };

async function readClientDetails(response: Response): Promise<ClientDetails> {
  if (!response.ok) throw new Error("Client unavailable");
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new Error("Invalid client");
  const name =
    "client_name" in value && typeof value.client_name === "string"
      ? value.client_name
      : "Connected app";
  return { name: name.slice(0, 120) };
}

export function ImportAuthorization({
  oauthQuery,
  signInRequired = false,
}: {
  oauthQuery: string;
  signInRequired?: boolean;
}) {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = !!session;
  const connection = useQuery(
    api.assistantImports.connectionStatus,
    signedIn && session.user.emailVerified && !signInRequired ? {} : "skip",
  );
  const activate = useMutation(api.assistantImports.activateConnection);
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const params = new URLSearchParams(oauthQuery);
  const clientId = params.get("client_id");
  const scopes = params.get("scope")?.split(" ").filter(Boolean) ?? [];
  const validRequest =
    oauthQuery.length <= 12_000 &&
    !!clientId &&
    !!params.get("sig") &&
    (scopes.includes("testimonials:import") ||
      scopes.includes("testimonials:import:assistant")) &&
    scopes.every((scope) =>
      [
        "testimonials:import",
        "testimonials:import:assistant",
        "offline_access",
      ].includes(scope),
    );
  const callback = `/import/authorize?${oauthQuery}`;

  useEffect(() => {
    if (!validRequest || !signedIn || signInRequired) return;
    const controller = new AbortController();
    void fetch(
      `/api/import-auth/oauth2/public-client?client_id=${encodeURIComponent(clientId!)}`,
      { signal: controller.signal },
    )
      .then(readClientDetails)
      .then((details) => {
        if (!controller.signal.aborted) setClient(details);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "This connection request is unavailable. Return to your assistant and try connecting again.",
          );
      });
    return () => controller.abort();
  }, [clientId, signedIn, signInRequired, validRequest]);

  async function respond(accept: boolean) {
    setPending(accept ? "allow" : "deny");
    setError(null);
    try {
      if (
        accept &&
        scopes.includes("testimonials:import:assistant") &&
        !connection?.activated
      )
        await activate({ acceptReuseRights: true });
      const response = await fetch("/api/import-auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept, oauth_query: oauthQuery }),
      });
      if (!response.ok) throw new Error("Consent failed");
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== "object" ||
        !("url" in value) ||
        typeof value.url !== "string"
      )
        throw new Error("Missing redirect");
      const redirect = new URL(value.url);
      if (!isImportOAuthRedirect(redirect.href))
        throw new Error("Invalid redirect");
      window.location.assign(redirect.href);
    } catch {
      setError(
        "This request may have expired. Return to your assistant and try connecting again.",
      );
      setPending(null);
    }
  }

  if (isPending) return <BlobLoader label="Checking your account…" showLabel />;
  if (!validRequest)
    return (
      <section className="grid gap-4">
        <h1 className="type-display">Connection unavailable</h1>
        <p className="type-body text-ink-2">
          Start a new connection from your assistant to continue.
        </p>
      </section>
    );
  if (!session || signInRequired)
    return (
      <section className="grid gap-6">
        <header className="grid gap-3">
          <h1 className="type-display">Connect your proof</h1>
          <p className="type-body text-ink-2">
            Sign in to review this app’s access to Get Some Proof.
          </p>
        </header>
        <Button asChild className="min-h-11">
          <a href={`/sign-in?callbackURL=${encodeURIComponent(callback)}`}>
            Sign in to continue
          </a>
        </Button>
      </section>
    );
  return (
    <ImportConsentView
      client={client}
      session={session}
      connection={connection}
      scopes={scopes}
      error={error}
      pending={pending}
      respond={respond}
    />
  );
}

export function ImportConsentView({
  client,
  session,
  connection,
  scopes,
  error,
  pending,
  respond,
}: {
  client: ClientDetails | null;
  session: { user: { email: string; emailVerified: boolean } };
  connection: { paid: boolean; activated: boolean } | undefined;
  scopes: string[];
  error: string | null;
  pending: "allow" | "deny" | null;
  respond: (accept: boolean) => Promise<void>;
}) {
  const [accepted, setAccepted] = useState(false);
  const assistantRequest = scopes.includes("testimonials:import:assistant");
  return (
    <section className="grid gap-6" aria-busy={!!pending}>
      <header className="grid gap-3">
        <h1 className="type-display">Connect your proof</h1>
        <p className="type-body text-ink-2">
          {client
            ? `${client.name} would like to connect to Get Some Proof.`
            : "Checking the connection request…"}
        </p>
      </header>
      <p className="type-small text-ink-2 break-words">
        Signed in as {session.user.email}
      </p>
      <ul className="type-body border-line grid gap-4 border-y py-5">
        <li>
          Choose a Project and save the testimonials you select as Pending.
        </li>
        {scopes.includes("offline_access") && (
          <li>Keep the connection available for your next import.</li>
        )}
      </ul>
      <p className="type-small text-ink-2">
        Publishing requires a separate review in your Inbox.
      </p>
      {!session.user.emailVerified && (
        <p className="type-body">
          Verify your email before connecting this account.
        </p>
      )}
      {assistantRequest && session.user.emailVerified && (
        <ImportAccessConfirmation
          connection={connection}
          accepted={accepted}
          setAccepted={setAccepted}
          pending={!!pending}
        />
      )}
      <p className="type-small text-ink-2">
        You can disconnect this app from your MCP settings at any time.
      </p>
      <FieldError>{error}</FieldError>
      {!client && !error ? (
        <BlobLoader label="Checking app details…" showLabel />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          className="min-h-11"
          disabled={
            !client ||
            !session.user.emailVerified ||
            (assistantRequest &&
              (!connection?.paid || (!connection.activated && !accepted))) ||
            !!pending
          }
          loading={pending === "allow"}
          onClick={() => void respond(true)}
        >
          Allow connection
        </Button>
        <Button
          className="min-h-11"
          variant="outline"
          disabled={!client || !!pending}
          loading={pending === "deny"}
          onClick={() => void respond(false)}
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}

function ImportAccessConfirmation({
  connection,
  accepted,
  setAccepted,
  pending,
}: {
  connection: { paid: boolean; activated: boolean } | undefined;
  accepted: boolean;
  setAccepted: (value: boolean) => void;
  pending: boolean;
}) {
  if (!connection)
    return <BlobLoader label="Checking import access…" showLabel />;
  if (!connection.paid)
    return (
      <div className="grid justify-items-start gap-3">
        <p className="type-body text-ink-2">
          Assistant imports are included with Pro.
        </p>
        <Button asChild>
          <Link href="/account/billing">Upgrade to Pro</Link>
        </Button>
      </div>
    );
  if (connection.activated) return null;
  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id="connection-reuse-rights"
          checked={accepted}
          onCheckedChange={(value) => setAccepted(value === true)}
          disabled={!!pending}
          aria-describedby="connection-rights-note"
        />
        <label
          className="type-body cursor-pointer"
          htmlFor="connection-reuse-rights"
        >
          {assistantReuseRightsText}
        </label>
      </div>
      <p id="connection-rights-note" className="type-small text-ink-2">
        Confirmed once for your account. This does not record consent from the
        testimonial’s author.
      </p>
    </div>
  );
}
