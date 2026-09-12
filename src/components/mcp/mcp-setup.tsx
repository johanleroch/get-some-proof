"use client";
import Link from "next/link";
import type { Route } from "next";
import { IconArrowLeft } from "@tabler/icons-react";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { assistantReuseRightsText } from "@convex/domain/testimonialImport";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantSetupInstructions } from "./assistant-setup-instructions";
import { SpeechBubbleStars } from "@/components/doodles";

const importAccessConfirmed =
  "Reuse rights confirmed. Your account can receive assistant imports.";

export function McpSetupView({
  paid,
  activated,
  onActivate,
  origin,
  connections = [],
  onRevoke,
  backHref,
  loading = false,
}: {
  origin: string;
  backHref?: string;
  loading?: boolean;
  connections?: { clientId: string; name: string }[];
  onRevoke?: (clientId: string) => Promise<unknown>;
  paid: boolean;
  activated: boolean;
  onActivate: () => Promise<unknown>;
}) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function activate() {
    setPending(true);
    setError(null);
    try {
      await onActivate();
    } catch {
      setError(
        "Your import access could not be activated. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }
  async function revoke(clientId: string) {
    if (!onRevoke) return;
    setRevoking(clientId);
    setError(null);
    try {
      await onRevoke(clientId);
    } catch {
      setError(
        "This app could not be disconnected. Check your connection and try again.",
      );
    } finally {
      setRevoking(null);
    }
  }
  return (
    <div
      className="mx-auto grid w-full max-w-5xl gap-8"
      aria-busy={loading || undefined}
    >
      <PageHeader
        leading={
          backHref ? (
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link
                href={backHref as Route}
                aria-label="Back to import testimonials"
              >
                <IconArrowLeft aria-hidden="true" />
              </Link>
            </Button>
          ) : undefined
        }
        title="Import with your assistant"
        description="Bring existing testimonials from a page into your Inbox with an MCP connection."
      />
      <div className="grid max-w-3xl gap-6">
        <section
          className="border-line grid gap-6 border-y py-6"
          aria-labelledby="mcp-rights-title"
        >
          <div className="grid gap-3">
            <h2 id="mcp-rights-title" className="type-heading">
              Keep control of your proof
            </h2>
            <p className="type-body text-ink-2">
              Your assistant sends the original testimonials you ask it to
              import. They appear as Pending. You decide what to publish from
              the Inbox.
            </p>
          </div>
          {loading ? (
            <div
              role="status"
              aria-label="Loading import access"
              className="relative"
            >
              <p className="type-body invisible" aria-hidden="true">
                {importAccessConfirmed}
              </p>
              <Skeleton className="absolute inset-0" />
            </div>
          ) : !paid ? (
            <div className="grid justify-items-start gap-4">
              <p className="type-body text-ink-2">
                Assistant imports are included with Pro.
              </p>
              <Button asChild>
                <Link href="/account/billing">Upgrade to Pro</Link>
              </Button>
            </div>
          ) : activated ? (
            <p className="type-body text-success" role="status">
              {importAccessConfirmed}
            </p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="mcp-reuse-rights"
                  checked={accepted}
                  onCheckedChange={(value) => setAccepted(value === true)}
                  disabled={pending}
                  aria-describedby="mcp-rights-note"
                />
                <label
                  htmlFor="mcp-reuse-rights"
                  className="type-body cursor-pointer"
                >
                  {assistantReuseRightsText}
                </label>
              </div>
              <p id="mcp-rights-note" className="type-small text-ink-2">
                This is your confirmation of reuse rights. It does not record
                consent from the testimonial’s author.
              </p>

              <Button
                className="justify-self-start"
                disabled={!accepted || pending}
                loading={pending}
                onClick={() => void activate()}
              >
                Enable assistant imports
              </Button>
            </>
          )}
        </section>
        <aside className="bg-surface-2 flex items-start gap-4 rounded-lg p-5">
          <SpeechBubbleStars
            aria-hidden="true"
            className="hidden h-16 w-20 shrink-0 sm:block"
          />
          <div className="grid gap-1">
            <h2 className="type-subheading">One page at a time</h2>
            <p className="type-body text-ink-2">
              Give your assistant the page you want to migrate and tell it which
              Project should receive the testimonials.
            </p>
          </div>
        </aside>
      </div>
      <FieldError>{error}</FieldError>
      <div className="max-w-3xl">
        <AssistantSetupInstructions
          origin={origin}
          enabled={!loading && paid && activated}
        />
      </div>
      <section
        aria-labelledby="mcp-connections-title"
        className="border-line grid max-w-3xl gap-4 border-t pt-6"
      >
        <h2 id="mcp-connections-title" className="type-heading">
          Connected apps
        </h2>
        {loading ? (
          <div
            role="status"
            aria-label="Loading connected apps"
            className="flex items-center justify-between gap-4 py-4"
          >
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-11 w-28" />
          </div>
        ) : connections.length ? (
          <ul className="divide-line divide-y">
            {connections.map((connection) => (
              <li
                key={connection.clientId}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <span className="type-body min-w-0 break-words">
                  {connection.name}
                </span>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={!!revoking || !onRevoke}
                  loading={revoking === connection.clientId}
                  aria-label={`Disconnect ${connection.name}`}
                  onClick={() => void revoke(connection.clientId)}
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-ink-2">
            No apps connected yet. Finish the browser sign-in to see your
            assistant here.
          </p>
        )}
        <p className="type-small text-ink-2">
          Disconnecting stops the app’s access. Testimonials already saved stay
          in your Inbox.
        </p>
      </section>
    </div>
  );
}

export function McpSetup({ slug, origin }: { slug: string; origin: string }) {
  const project = useQuery(api.organizations.getBySlug, { slug });
  const state = useQuery(
    api.assistantImports.activation,
    project ? { organizationId: project.id } : "skip",
  );
  const connections = useQuery(api.assistantImports.connections, {});
  const revoke = useMutation(api.assistantImports.revokeConnection);
  const activate = useMutation(api.assistantImports.activate);
  if (project === null)
    return <p className="type-body">Project unavailable.</p>;
  return (
    <McpSetupView
      backHref={`/org/${slug}/import`}
      loading={
        project === undefined ||
        state === undefined ||
        connections === undefined
      }
      origin={origin}
      connections={connections}
      onRevoke={(clientId) => revoke({ clientId })}
      paid={state?.paid ?? false}
      activated={state?.activated ?? false}
      onActivate={() =>
        project
          ? activate({ organizationId: project.id, acceptReuseRights: true })
          : Promise.resolve()
      }
    />
  );
}
