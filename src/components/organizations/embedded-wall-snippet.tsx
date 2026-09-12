"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { EmbedCode } from "@/components/ui/embed-code";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";

export function EmbeddedWallSnippet({
  embedOrigin,
  publicSlug,
  compact = false,
}: {
  compact?: boolean;
  embedOrigin: string;
  publicSlug: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const snippet = embedOrigin
    ? `<div data-gsp-wall data-public-slug="${publicSlug}" data-theme="system"></div>\n<script async src="${embedOrigin}/embed/v1.js" data-api-origin="${embedOrigin}"></script>`
    : "";

  async function copy() {
    setError(null);
    setSuccess(null);
    try {
      await navigator.clipboard.writeText(snippet);
      setSuccess("Embed snippet copied.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Copy failed.");
    }
  }

  return (
    <div
      className={
        compact
          ? "space-y-4"
          : "bg-card scroll-mt-24 space-y-4 rounded-lg border p-5"
      }
      id="embed"
    >
      <div>
        {!compact ? <h2 className="type-subheading">Embedded Wall</h2> : null}
        <p className="text-ink-2 mt-1 text-sm">
          Paste this snippet where your website accepts custom HTML. It inherits
          the host font and never uses an iframe.
        </p>
      </div>
      <Field>
        <p className="text-sm font-medium">Embed snippet</p>
        <EmbedCode id="embed-snippet" code={snippet} />
      </Field>
      {error ? <ErrorToast message={error} /> : null}
      {success ? <SuccessToast message={success} /> : null}
      <Button
        disabled={!snippet}
        onClick={() => void copy()}
        type="button"
        variant="outline"
      >
        Copy embed snippet
      </Button>
    </div>
  );
}
