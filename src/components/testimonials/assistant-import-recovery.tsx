"use client";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { IconExternalLink } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/format-date";
import { AssistantFileUpload } from "./assistant-file-upload";

type Progress = NonNullable<
  FunctionReturnType<typeof api.assistantImports.inboxStatus>
>;
export function AssistantImportRecoveryView({
  value,
  fileUpload,
}: {
  value: Progress;
  fileUpload?: (item: Progress["items"][number]) => ReactNode;
}) {
  const media = value.items.filter(
    (item) => item.videoStatus || item.portraitStatus,
  );
  return (
    <section
      aria-label="Assistant import progress"
      className="border-line bg-surface overflow-hidden rounded-lg border"
    >
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="type-subheading font-display">
            Your imported testimonials
          </h2>
          <span className="type-small text-ink-2">
            {formatShortDate(value.createdAt)}
          </span>
        </div>
        <p className="type-small text-ink-2">
          Created: {value.createdCount} · Duplicates: {value.result.skipped} ·
          Conflicts: {value.result.changed} · Videos Ready: {value.readyCount} ·
          Processing: {value.result.processing ?? 0} · Blocked:{" "}
          {value.result.blocked ?? 0} · Failed: {value.result.failed ?? 0}
        </p>
        <a
          href={value.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="type-small text-brand-text inline-flex items-center gap-1 underline underline-offset-4"
        >
          Open source page
          <IconExternalLink aria-hidden="true" className="size-4" />
        </a>
        {!value.canUpload && (
          <p className="type-small text-ink-2">
            Your saved testimonials stay in the Inbox. Pro is required to start
            another media transfer.
          </p>
        )}
      </div>
      {media.length > 0 && (
        <ul className="divide-line border-line divide-y border-t">
          {media.map((item) => (
            <li
              key={item.itemId}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <p className="type-ui text-ink font-semibold">
                  {item.authorName || "Unnamed testimonial"}
                </p>
                {item.videoStatus && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        item.blocked
                          ? "warning"
                          : item.videoStatus === "ready"
                            ? "success"
                            : item.videoStatus === "failed"
                              ? "danger"
                              : "warning"
                      }
                    >
                      {item.blocked
                        ? "Capacity blocked"
                        : item.videoStatus === "ready"
                          ? "Ready"
                          : item.videoStatus === "failed"
                            ? "Video missing"
                            : "Processing"}
                    </Badge>
                    <span className="type-small text-ink-2">
                      {item.videoStatus === "ready"
                        ? "Video copied and checked."
                        : item.blocked
                          ? "Free a video place, then choose a video to resume."
                          : item.videoStatus === "failed"
                            ? (item.failureMessage ??
                              "Choose the original file to complete this Pending testimonial.")
                            : "The video is being copied or checked. It is not Ready yet."}
                    </span>
                  </div>
                )}
                {item.portraitStatus && (
                  <p className="type-small text-ink-2">
                    {item.portraitStatus === "ready"
                      ? "Photo copied."
                      : item.portraitStatus === "processing"
                        ? "Photo copying in the background."
                        : "Photo could not be copied. The testimonial is saved."}
                  </p>
                )}
              </div>
              {item.videoStatus && (
                <div className="shrink-0 sm:max-w-64">{fileUpload?.(item)}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AssistantImportRecovery({
  organizationId,
  jobId,
}: {
  organizationId: Id<"organizations">;
  jobId: string;
}) {
  const value = useQuery(api.assistantImports.inboxStatus, {
    organizationId,
    jobId,
  });
  if (!value) return null;
  return (
    <AssistantImportRecoveryView
      value={value}
      fileUpload={(item) => (
        <AssistantFileUpload
          key={item.itemId}
          jobId={value.jobId}
          itemId={item.itemId}
          authorName={item.authorName}
          eligible={item.videoStatus === "failed"}
          ready={item.videoStatus === "ready"}
          disabled={!value.canUpload}
        />
      )}
    />
  );
}

export function AssistantImportNotice({
  organizationId,
  jobId,
  slug,
}: {
  organizationId: Id<"organizations">;
  jobId?: string;
  slug: string;
}) {
  if (jobId === undefined) return null;
  return (
    <>
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <p className="type-body text-ink-2">
          Showing testimonials from this import.
        </p>
        <Button asChild variant="ghost">
          <Link href={`/org/${slug}/inbox` as Route}>
            Show all testimonials
          </Link>
        </Button>
      </div>
      <AssistantImportRecovery organizationId={organizationId} jobId={jobId} />
    </>
  );
}
