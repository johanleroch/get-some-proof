"use client";
import Link from "next/link";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { assistantReuseRightsText } from "@convex/domain/testimonialImport";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { BlobLoader } from "@/components/brand/blob-loader";
import { SpeechBubbleStars } from "@/components/doodles";

export function McpSetupView({
  paid,
  activated,
  onActivate,
}: {
  paid: boolean;
  activated: boolean;
  onActivate: () => Promise<unknown>;
}) {
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
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8">
      <PageHeader
        eyebrow="Integrations"
        title="Import with your assistant"
        description="Bring existing testimonials from a page into your Inbox with an MCP connection."
      />
      <div className="grid items-start gap-8 md:grid-cols-[2fr_1fr]">
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
          {!paid ? (
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
              Reuse rights confirmed. Your account can receive assistant
              imports.
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
              <FieldError>{error}</FieldError>
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
        <aside className="mx-auto grid max-w-xs gap-4">
          <SpeechBubbleStars className="mx-auto h-36 w-auto" />
          <h2 className="type-subheading">One page at a time</h2>
          <p className="type-body text-ink-2">
            Give your assistant the page you want to migrate and tell it which
            Project should receive the testimonials.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function McpSetup({ slug }: { slug: string }) {
  const project = useQuery(api.organizations.getBySlug, { slug });
  const state = useQuery(
    api.assistantImports.activation,
    project ? { organizationId: project.id } : "skip",
  );
  const activate = useMutation(api.assistantImports.activate);
  if (project === null)
    return <p className="type-body">Project unavailable.</p>;
  if (project === undefined || state === undefined)
    return <BlobLoader label="Loading import settings…" showLabel />;
  return (
    <McpSetupView
      paid={state.paid}
      activated={state.activated}
      onActivate={() =>
        activate({ organizationId: project.id, acceptReuseRights: true })
      }
    />
  );
}
