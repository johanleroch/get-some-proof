"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { BlobLoader } from "@/components/brand/blob-loader";

type ClientDetails = { name: string };

export function ImportAuthorization({
  oauthQuery,
  signInRequired = false,
}: {
  oauthQuery: string;
  signInRequired?: boolean;
}) {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = !!session;
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
    scopes.includes("testimonials:import") &&
    scopes.every((scope) =>
      ["testimonials:import", "offline_access"].includes(scope),
    );
  const callback = `/import/authorize?${oauthQuery}`;

  useEffect(() => {
    if (!validRequest || !signedIn || signInRequired) return;
    const controller = new AbortController();
    void fetch(
      `/api/import-auth/oauth2/public-client?client_id=${encodeURIComponent(clientId!)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Client unavailable");
        const value: unknown = await response.json();
        if (!value || typeof value !== "object")
          throw new Error("Invalid client");
        const name =
          "client_name" in value && typeof value.client_name === "string"
            ? value.client_name
            : "Connected app";
        if (!controller.signal.aborted) setClient({ name: name.slice(0, 120) });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "This connection request is unavailable. Return to ChatGPT and try connecting again.",
          );
      });
    return () => controller.abort();
  }, [clientId, signedIn, signInRequired, validRequest]);

  async function respond(accept: boolean) {
    setPending(accept ? "allow" : "deny");
    setError(null);
    try {
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
      if (
        redirect.protocol !== "https:" &&
        redirect.origin !== window.location.origin
      )
        throw new Error("Invalid redirect");
      window.location.assign(redirect.href);
    } catch {
      setError(
        "This request may have expired. Return to ChatGPT and try connecting again.",
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
          Start a new connection from ChatGPT to continue.
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
      <FieldError>{error}</FieldError>
      {!client && !error ? (
        <BlobLoader label="Checking app details…" showLabel />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          className="min-h-11"
          disabled={!client || !session.user.emailVerified || !!pending}
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
