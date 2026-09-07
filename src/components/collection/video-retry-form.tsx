"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { IconRefresh } from "@tabler/icons-react";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  normalizeVideoMimeType,
  supportedVideoMimeTypes,
} from "@convex/domain/video";
import { Sparkle, WallFrames } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoUploadProgress } from "@/components/collection/video-upload-progress";
import { inspectVideoFile } from "@/lib/video-file";
import { useVideoUpload } from "@/hooks/use-video-upload";
import { uploadDirectVideo } from "@/lib/video-upload";

type RetryContext = {
  brandName: string;
  publicSlug: string;
  spokenLanguage: "en" | "fr";
};

type RetryUpload = (input: {
  clientSubmissionId: string;
  dimensions?: { height: number; width: number };
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
  inspectVideo?: (file: File) => Promise<{
    durationSeconds: number;
    height?: number;
    width?: number;
  }>;
  token: string;
  uploadVideo?: typeof uploadDirectVideo;
}) {
  const [file, setFile] = useState<File>();
  const [language, setLanguage] = useState<"en" | "fr">();
  const videoUpload = useVideoUpload();
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedContext, setClaimedContext] = useState<RetryContext | null>(
    null,
  );
  const activeContext = context ?? claimedContext;

  if (context === undefined && !activeContext) {
    return <p className="text-ink-2 text-sm">Loading link…</p>;
  }
  if (!activeContext) {
    return (
      <EmptyState
        description="This private link is invalid, expired or has already been used."
        headingLevel={1}
        illustration={<WallFrames className="h-28" />}
        title="Replacement unavailable"
      />
    );
  }
  if (complete) {
    return (
      <section className="mx-auto w-full max-w-xl space-y-5">
        <Sparkle className="text-ink size-14" draw />
        <div className="space-y-2">
          <h1 className="type-heading">Replacement uploaded</h1>
          <p className="type-body text-ink-2">
            Your new video is processing. It remains private until{" "}
            {activeContext.brandName} reviews it.
          </p>
        </div>
      </section>
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
    setClaimedContext(activeContext);
    const clientSubmissionId = crypto.randomUUID();
    try {
      const completed = await videoUpload.run({
        file,
        reserve: async () => {
          const metadata = await inspectVideo(file);
          const target = await createRetryUpload({
            clientSubmissionId,
            ...(metadata.height && metadata.width
              ? {
                  dimensions: {
                    height: metadata.height,
                    width: metadata.width,
                  },
                }
              : {}),
            fileSizeBytes: file.size,
            mimeType,
            spokenLanguage,
            token,
          });
          return {
            ...target,
            release: () =>
              cancelRetryVideo({
                clientSubmissionId,
                reservationId: target.reservationId,
                token,
              }),
          };
        },
        upload: uploadVideo,
      });
      if (completed) setComplete(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Replacement upload failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl space-y-6">
      <header className="space-y-3">
        <div className="bg-surface-2 text-ink grid size-11 place-items-center rounded-md">
          <IconRefresh aria-hidden="true" className="size-5" />
        </div>
        <div className="space-y-1.5">
          <p className="type-micro text-ink-2">{activeContext.brandName}</p>
          <h1 className="type-heading">Replace your video</h1>
          <p className="type-body text-ink-2">
            Upload one new MP4, MOV or WebM video, up to 2 minutes. This private
            link works once and expires after 24 hours.
          </p>
        </div>
      </header>
      <div className="space-y-5">
        <Field>
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
          {file ? <FieldDescription>{file.name}</FieldDescription> : null}
        </Field>
        <Field>
          <Label htmlFor="replacement-language">Spoken language</Label>
          <Select
            onValueChange={(value) => setLanguage(value as "en" | "fr")}
            value={spokenLanguage}
          >
            <SelectTrigger className="w-full" id="replacement-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">French</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {videoUpload.phase !== "idle" ? (
          <VideoUploadProgress
            onCancel={
              videoUpload.phase === "uploading" ? videoUpload.cancel : undefined
            }
            phase={videoUpload.phase}
            progress={videoUpload.progress}
          />
        ) : null}
        {error ? <ErrorToast message={error} /> : null}
        <Button
          className="w-full"
          disabled={!file}
          loading={submitting}
          onClick={() => void submitReplacement()}
          size="lg"
          type="button"
        >
          Replace video
        </Button>
      </div>
    </section>
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
