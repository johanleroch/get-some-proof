"use client";
import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { IconUpload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { BlobLoader } from "@/components/brand/blob-loader";
import {
  AssistantVideoTransferError,
  transferAssistantVideo,
} from "@/lib/assistant-video-transfer";
import { convexErrorMessage } from "@/lib/convex-error-message";

export function AssistantFileUpload({
  jobId,
  itemId,
  authorName,
  disabled,
  eligible,
  ready = false,
}: {
  jobId: Id<"testimonialImportJobs">;
  itemId: Id<"testimonialImportItems">;
  authorName: string;
  disabled?: boolean;
  eligible: boolean;
  ready?: boolean;
}) {
  const issue = useAction(api.assistantUploads.issueFromInbox);
  const input = useRef<HTMLInputElement>(null);
  const attempt = useRef<{
    file: File;
    requestId: string;
    mimeType: string;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "uploading" | "interrupted" | "complete" | "finalizing"
  >("idle");
  const [actionLabel, setActionLabel] = useState("Choose video file");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function send() {
    const current = attempt.current;
    if (!current || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setPhase("uploading");
    setError(null);
    try {
      const capability = await issue({
        jobId,
        itemId,
        requestId: current.requestId,
        totalBytes: current.file.size,
        mimeType: current.mimeType,
      });
      const status = await transferAssistantVideo(current.file, capability, {
        signal: abort.signal,
        onProgress: (offset, total) =>
          setPercent(Math.floor((offset / total) * 100)),
      });
      setPhase(status);
    } catch (caught) {
      if (!abort.signal.aborted) {
        const resumable =
          caught instanceof AssistantVideoTransferError
            ? caught.resumable
            : !(caught instanceof ConvexError);
        setPhase(resumable ? "interrupted" : "idle");
        if (!resumable) attempt.current = null;
        setActionLabel(resumable ? "Resume upload" : "Choose video file");
        setError(
          convexErrorMessage(
            caught,
            "The transfer was interrupted. Try resuming with this file.",
          ),
        );
      }
    } finally {
      controller.current = null;
    }
  }
  function choose(file: File | undefined) {
    if (!file) return;
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    const mimeType =
      file.type ||
      ({ mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" }[
        extension ?? ""
      ] ??
        "");
    if (
      !file.size ||
      file.size > 512 * 1024 * 1024 ||
      !["video/mp4", "video/quicktime", "video/webm"].includes(mimeType)
    ) {
      setError("Choose an MP4, MOV or WebM video up to 512 MB and 10 minutes.");
      return;
    }
    setActionLabel("Choose video file");
    attempt.current = { file, mimeType, requestId: crypto.randomUUID() };
    void send();
  }
  if (ready || (!eligible && phase === "idle")) return null;
  const displayPhase =
    eligible && (phase === "complete" || phase === "finalizing")
      ? "idle"
      : phase;
  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        className="hidden"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        aria-label={`Choose a video for ${authorName || "this testimonial"}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          choose(file);
        }}
      />
      {displayPhase === "complete" || displayPhase === "finalizing" ? (
        <p role="status" className="type-small text-ink-2">
          {phase === "complete"
            ? "File uploaded. Checking the video before it becomes Ready."
            : "Confirming the final transfer. Keep this testimonial Pending while the video is checked."}
        </p>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-10 sm:h-9"
          loading={phase === "uploading"}
          disabled={
            (disabled && phase !== "interrupted") || phase === "uploading"
          }
          onClick={() =>
            phase === "interrupted" ? void send() : input.current?.click()
          }
        >
          <IconUpload aria-hidden="true" />
          {actionLabel}
        </Button>
      )}
      {phase === "uploading" && (
        <div className="space-y-1" role="status">
          <div className="flex items-center gap-2">
            <BlobLoader size={24} />
            <span className="type-small text-ink-2">
              Uploading video · {percent}%
            </span>
          </div>
          <progress
            className="accent-primary h-1 w-full"
            max={100}
            value={percent}
            aria-label="Video upload progress"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="type-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
