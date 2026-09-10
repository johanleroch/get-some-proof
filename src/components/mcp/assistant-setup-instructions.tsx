"use client";

import Image from "next/image";
import { useState } from "react";
import { IconBrandOpenai, IconCheck, IconCopy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  assistantConnectionCommands,
  assistantMigrationInstructions,
} from "@/lib/assistant-import-instructions";

function CopyInstructions({
  text,
  label,
  disabled = false,
}: {
  text: string;
  label: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(null);
    } catch {
      setError("Copy failed. Select the instructions and copy them manually.");
    }
  }
  return (
    <div className="grid justify-items-start gap-2">
      <Button
        variant="outline"
        className="min-h-11"
        disabled={disabled}
        onClick={() => void copy()}
      >
        {copied ? (
          <IconCheck aria-hidden="true" />
        ) : (
          <IconCopy aria-hidden="true" />
        )}
        {label}
      </Button>
      <span className="type-small text-success" role="status">
        {copied ? "Copied to clipboard." : ""}
      </span>
      <FieldError>{error}</FieldError>
      {error && (
        <Textarea
          aria-label={`${label} manually`}
          readOnly
          value={text}
          rows={8}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}

export function AssistantSetupInstructions({
  origin,
  enabled,
}: {
  origin: string;
  enabled: boolean;
}) {
  return (
    <section aria-labelledby="mcp-connect-title" className="grid gap-6">
      <div className="grid gap-3">
        <h2 id="mcp-connect-title" className="type-heading">
          Connect your assistant
        </h2>
        <p className="type-body text-ink-2">
          Use the terminal app on a computer where you can open the source page
          and your video files.
        </p>
      </div>
      <Tabs defaultValue="claude">
        <TabsList aria-label="Choose your assistant">
          <TabsTrigger className="min-h-11" value="claude">
            <Image
              src="/integrations/claude.svg"
              width={20}
              height={20}
              alt=""
            />
            Claude
          </TabsTrigger>
          <TabsTrigger className="min-h-11" value="codex">
            <IconBrandOpenai aria-hidden="true" />
            Codex
          </TabsTrigger>
        </TabsList>
        {(["claude", "codex"] as const).map((assistant) => {
          const commands = assistantConnectionCommands(assistant, origin);
          return (
            <TabsContent
              key={assistant}
              value={assistant}
              className="grid gap-4"
            >
              <h3 className="type-subheading">
                {assistant === "claude" ? "Claude Code" : "Codex CLI"}
              </h3>
              <p className="type-body text-ink-2">
                Run these commands in your terminal. Sign in to Get Some Proof
                in the browser, review access, then return to your assistant.
              </p>
              <pre
                tabIndex={0}
                role="region"
                aria-label="Connection commands"
                className="type-small border-line bg-surface focus-visible:ring-ring overflow-x-auto rounded-md border p-4 outline-none focus-visible:ring-[3px]"
              >
                <code>{commands}</code>
              </pre>
              <CopyInstructions
                key={assistant}
                text={commands}
                label="Copy connection commands"
                disabled={!enabled}
              />
            </TabsContent>
          );
        })}
      </Tabs>
      <div className="border-line grid gap-4 border-t pt-6">
        <h2 className="type-heading">Give it your page</h2>
        <p className="type-body text-ink-2">
          Replace [PAGE URL] in the instructions, then paste them into your
          connected assistant. Your testimonials arrive as Pending for you to
          review.
        </p>
        <CopyInstructions
          text={assistantMigrationInstructions}
          label="Copy import instructions"
          disabled={!enabled}
        />
        <p className="type-small text-ink-2">
          Videos: a public file URL or a local file, up to 10 minutes and 512 MB
          each. Photos and videos copy in the background. If your assistant
          cannot transfer a file, choose it in the Inbox. Optional yt-dlp use
          depends on your environment and source access.
        </p>
      </div>
    </section>
  );
}
