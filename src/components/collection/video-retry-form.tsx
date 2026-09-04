"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  normalizeVideoMimeType,
  supportedVideoMimeTypes,
} from "@convex/domain/video";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  VideoUploadProgress,
  type VideoUploadPhase,
} from "@/components/collection/video-upload-progress";
import { inspectVideoFile } from "@/lib/video-file";
import { uploadDirectVideo } from "@/lib/video-upload";

type RetryContext = {
  brandName: string;
  publicSlug: string;
  spokenLanguage: "en" | "fr";
};

type RetryUpload = (input: {
  clientSubmissionId: string;
  fileSizeBytes: number;
  mimeType: string;
  spokenLanguage: "en" | "fr";
  token: string;
}) => Promise<{
  provider: "fake" | "mux";
  reservationId: Id<"videoReservations">;
  uploadUrl: string;
}>;

type CancelRetryVideo = (input: {
  clientSubmissionId: string;
  reservationId: Id<"videoReservations">;
  token: string;
}) => Promise<null>;

export function VideoRetryFormView({
  cancelRetryVideo = async () => null,
  context,
  createRetryUpload,
  inspectVideo = inspectVideoFile,
  token,
  uploadVideo = uploadDirectVideo,
}: {
  cancelRetryVideo?: CancelRetryVideo;
  context: RetryContext | null | undefined;
  createRetryUpload: RetryUpload;
  inspectVideo?: (file: File) => Promise<{ durationSeconds: number }>;
  token: string;
  uploadVideo?: typeof uploadDirectVideo;
}) {
  const [file, setFile] = useState<File>();
  const [language, setLanguage] = useState<"en" | "fr">();
  const [progress, setProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<VideoUploadPhase>("idle");
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedContext, setClaimedContext] = useState<RetryContext | null>(
    null,
  );
  const activeContext = context ?? claimedContext;

  useEffect(() => {
    if (uploadPhase === "idle") return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [uploadPhase]);

  if (context === undefined && !activeContext) {
    return <p className="text-muted-foreground text-sm">Loading link…</p>;
  }
  if (!activeContext) {
    return (
      <Card className="w-full max-w-xl text-center">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Replacement unavailable</h1>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          This private link is invalid, expired or has already been used.
        </CardContent>
      </Card>
    );
  }
  if (complete) {
    return (
      <Card className="w-full max-w-xl text-center">
        <CardContent className="space-y-3 py-6">
          <CheckCircle2 className="text-primary mx-auto size-12" />
          <h1 className="text-2xl font-semibold">Replacement uploaded</h1>
          <p className="text-muted-foreground text-sm leading-6">
            Your new video is processing. It remains private until{" "}
            {activeContext.brandName}
            reviews it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const spokenLanguage = language ?? activeContext.spokenLanguage;
  async function submitReplacement() {
    if (!file) return;
    setError(null);
    const mimeType = normalizeVideoMimeType(file.type);
    if (!(supportedVideoMimeTypes as readonly string[]).includes(mimeType)) {
      setError("Choose an MP4, MOV or WebM video.");
      return;
    }
    setSubmitting(true);
    setProgress(0);
    setUploadPhase("uploading");
    setClaimedContext(activeContext);
    const clientSubmissionId = crypto.randomUUID();
    const uploadController = new AbortController();
    uploadAbortControllerRef.current = uploadController;
    let reservationId: Id<"videoReservations"> | undefined;
    try {
      await inspectVideo(file);
      const target = await createRetryUpload({
        clientSubmissionId,
        fileSizeBytes: file.size,
        mimeType,
        spokenLanguage,
        token,
      });
      reservationId = target.reservationId;
      await uploadVideo(file, {
        onProgress: setProgress,
        provider: target.provider,
        signal: uploadController.signal,
        uploadUrl: target.uploadUrl,
      });
      setProgress(100);
      setUploadPhase("processing");
      setComplete(true);
    } catch (caught) {
      let cancellationCleanupFailed = false;
      if (reservationId) {
        try {
          await cancelRetryVideo({
            clientSubmissionId,
            reservationId,
            token,
          });
        } catch {
          cancellationCleanupFailed = true;
        }
      }
      setError(
        cancellationCleanupFailed
          ? "The upload stopped, but its reservation could not be released. Refresh before trying again."
          : caught instanceof Error &&
              caught.message === "Video upload cancelled."
            ? null
            : caught instanceof Error
              ? caught.message
              : "Replacement upload failed.",
      );
    } finally {
      uploadAbortControllerRef.current = null;
      setUploadPhase("idle");
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <div className="bg-muted grid size-11 place-items-center rounded-xl">
          <RotateCcw className="size-5" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">
          {activeContext.brandName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Replace your video
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Upload one new MP4, MOV or WebM video, up to 2 minutes. This private
          link works once and expires after 24 hours.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="replacement-video">New video</Label>
          <Input
            accept="video/mp4,video/quicktime,video/webm"
            id="replacement-video"
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setError(null);
            }}
            type="file"
          />
          {file ? (
            <p className="text-muted-foreground text-xs">{file.name}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="replacement-language">Spoken language</Label>
          <select
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
            id="replacement-language"
            onChange={(event) => setLanguage(event.target.value as "en" | "fr")}
            value={spokenLanguage}
          >
            <option value="en">English</option>
            <option value="fr">French</option>
          </select>
        </div>
        {uploadPhase !== "idle" ? (
          <VideoUploadProgress
            onCancel={
              uploadPhase === "uploading"
                ? () => uploadAbortControllerRef.current?.abort()
                : undefined
            }
            phase={uploadPhase}
            progress={progress}
          />
        ) : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={!file || submitting}
          onClick={() => void submitReplacement()}
          type="button"
        >
          {submitting ? "Uploading…" : "Replace video"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function VideoRetryForm({ token }: { token: string }) {
  const context = useQuery(api.video.getRetryContext, { token });
  const createRetryUpload = useAction(api.video.createRetryDirectUpload);
  const cancelRetryVideo = useMutation(api.video.cancelRetryUpload);
  return (
    <VideoRetryFormView
      cancelRetryVideo={cancelRetryVideo}
      context={context}
      createRetryUpload={createRetryUpload}
      token={token}
    />
  );
}
