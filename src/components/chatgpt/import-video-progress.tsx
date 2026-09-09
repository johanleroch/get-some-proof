"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { App } from "@modelcontextprotocol/ext-apps";
import type { z } from "zod";
import {
  importStatusSchema,
  importOperationErrorSchema,
  importOperationErrorMessages,
} from "@/lib/chatgpt/import-wire";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { ImportPhotoProgress } from "@/components/testimonials/import-photo-progress";

type Status = z.infer<typeof importStatusSchema>;

export function ImportVideoProgress({
  jobId,
  callTool,
  onUpdate,
}: {
  jobId: string;
  callTool: App["callServerTool"];
  onUpdate: (status: Status) => void;
}) {
  const version = useRef(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(
    async (itemId?: string, photo = false) => {
      const request = ++version.current;
      setBusy(true);
      setRetrying(itemId ?? null);
      setError("");
      try {
        const response = await callTool({
          name: itemId
            ? photo
              ? "retry_import_photo"
              : "retry_import_video"
            : "read_testimonial_import",
          arguments: { jobId, ...(itemId ? { itemId } : {}) },
        });
        if (request !== version.current) return;
        if (response.isError) {
          const code = importOperationErrorSchema.safeParse(
            response._meta?.importError,
          );
          setError(
            code.success
              ? importOperationErrorMessages[code.data]
              : response._meta?.["mcp/www_authenticate"]
                ? "Reconnect your account, then refresh progress."
                : "Progress could not be updated. Try refreshing again.",
          );
          return;
        }
        const next = importStatusSchema.parse(response.structuredContent);
        if (next.jobId !== jobId) throw new Error("Import changed");
        setStatus(next);
        onUpdate(next);
      } catch {
        if (request === version.current)
          setError(
            "Progress could not be updated. Reconnect your account or refresh to check the current state.",
          );
      } finally {
        if (request === version.current) {
          setBusy(false);
          setRetrying(null);
        }
      }
    },
    [callTool, jobId, onUpdate],
  );

  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [refresh, invalidate]);

  useEffect(() => {
    if (
      busy ||
      error ||
      (!status?.result.processing &&
        !status?.photos?.some((photo) => photo.status === "processing"))
    )
      return;
    const timer = window.setTimeout(() => void refresh(), 5000);
    return () => window.clearTimeout(timer);
  }, [busy, error, status, refresh]);

  return (
    <section aria-label="Video import progress" className="grid gap-4">
      <FieldError>{error}</FieldError>
      <ImportPhotoProgress
        photos={status?.photos ?? []}
        onRetry={(itemId) => refresh(itemId, true)}
      />
      {!!status?.videos.length && (
        <ul className="bg-surface border-line divide-line divide-y rounded-lg border">
          {status.videos.map((video) => (
            <li
              key={video.itemId}
              className="flex flex-wrap items-center justify-between gap-4 p-4 max-md:flex-col max-md:items-start"
            >
              <div className="min-w-0 flex-1">
                <p className="type-ui break-words">{video.authorName}</p>
                {video.status === "failed" && (
                  <p className="type-small text-ink-2 mt-2 max-w-prose max-md:text-sm">
                    {video.failureMessage ??
                      "Video processing failed. Check the source video and try again."}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    video.status === "failed"
                      ? "danger"
                      : video.status === "processing"
                        ? "warning"
                        : "success"
                  }
                >
                  {video.status === "failed"
                    ? "Failed"
                    : video.status === "processing"
                      ? "Processing"
                      : "Ready"}
                </Badge>
                {video.status === "failed" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    loading={retrying === video.itemId}
                    aria-label={`Retry video for ${video.authorName}`}
                    onClick={() => void refresh(video.itemId)}
                  >
                    Retry video
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="ghost"
        className="w-fit"
        disabled={busy}
        loading={busy && !retrying}
        onClick={() => void refresh()}
      >
        Refresh progress
      </Button>
    </section>
  );
}
