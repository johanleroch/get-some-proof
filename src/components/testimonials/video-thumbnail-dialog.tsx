"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ConvexError } from "convex/values";
import { IconPhotoUp, IconX } from "@tabler/icons-react";

import { defaultPrimaryColor } from "@convex/domain/brand";
import { maximumStoredImageBytes } from "@convex/domain/profileImage";
import type { TestimonialCardVideoValue } from "@convex/testimonialCardValue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  testimonialPoster,
  videoAspectRatioStyle,
} from "@/components/testimonials/testimonial-card-markup";
import { WallCardMiniature } from "@/components/testimonials/wall-card-miniature";
import { cn } from "@/lib/utils";

/** The miniature's width on screen: `w-52`, the preview column. */
const previewWidth = 208;

export type VideoThumbnailChoice =
  { kind: "frame"; timeSeconds: number } | { kind: "image"; file: File };

/** Eight moments across the video, on half seconds so Mux has them ready. */
const frameCount = 8;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];

function saveError(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  if (
    error instanceof ConvexError &&
    typeof (error.data as { message?: unknown })?.message === "string"
  ) {
    return (error.data as { message: string }).message;
  }
  return error instanceof Error
    ? error.message
    : "Could not save the thumbnail.";
}

function frameUrl(playbackId: string, timeSeconds: number) {
  return `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.webp?width=240&time=${timeSeconds}`;
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The poster the card shows, never dark: the last image that finished
 * loading stays on the card until the next one has arrived, so a new choice
 * reads as the picture changing rather than going out and coming back.
 */
function useLoadedPoster(src: string) {
  const [loaded, setLoaded] = useState(src);
  return {
    loaded,
    markLoaded: () => setLoaded(src),
    pending: loaded === src ? null : src,
  };
}

/**
 * Choosing the still a visitor sees before they press play: one of eight
 * moments of the video, or an image the Owner uploads. The preview on the
 * right is the published card itself — stars, name, play button — so it can
 * never be mistaken for a ninth moment to click; that is why this dialog is
 * the one that runs wider than DESIGN.md's 560px. No scrubbing: a frame Mux
 * has not rendered yet arrives late, and eight good moments are enough.
 */
export function VideoThumbnailDialog({
  accentColor = defaultPrimaryColor,
  durationSeconds,
  isPublished = false,
  onClose,
  onSave,
  submitterName,
  testimonial,
}: {
  accentColor?: string;
  /** Known once the asset is ready; without it the moments span 30 seconds. */
  durationSeconds?: number;
  /** A Published Testimonial changes on the public Wall the moment we save. */
  isPublished?: boolean;
  onClose: () => void;
  onSave: (choice: VideoThumbnailChoice) => Promise<unknown>;
  submitterName: string;
  testimonial: TestimonialCardVideoValue;
}) {
  const momentsLabelId = useId();
  const duration =
    durationSeconds && durationSeconds > 0 ? durationSeconds : 30;
  const [timeSeconds, setTimeSeconds] = useState(
    Math.min(testimonial.posterTimeSeconds ?? duration / 2, duration),
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // The chosen image previews from an object URL that lives as long as the
  // file is the choice; the effect only lets the browser reclaim it.
  const fileUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : undefined),
    [file],
  );
  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl],
  );

  // Evenly spaced across the video, keeping clear of the black first frame.
  const frames = useMemo(
    () =>
      Array.from(
        { length: frameCount },
        (_, index) =>
          Math.round((((index + 0.5) / frameCount) * duration) / 0.5) * 0.5,
      ),
    [duration],
  );
  const usingImage = file !== null && fileUrl !== undefined;
  // The same URL the card already loaded, so opening the dialog is instant.
  const chosenSrc = usingImage
    ? fileUrl
    : testimonialPoster({
        ...testimonial,
        posterTimeSeconds: timeSeconds,
        posterUrl: undefined,
      });
  const poster = useLoadedPoster(chosenSrc);
  const aspectRatio = videoAspectRatioStyle(testimonial.aspectRatio);

  function chooseFile(next: File | undefined) {
    setError(undefined);
    if (!next) return;
    if (!imageTypes.includes(next.type)) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (next.size > maximumStoredImageBytes) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    setFile(next);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a thumbnail</DialogTitle>
          <DialogDescription>
            What a visitor sees before they press play on {submitterName}
            &apos;s video. Pick a moment of the video, or upload an image.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="type-ui" id={momentsLabelId}>
              Moment of the video
            </p>
            <div
              aria-labelledby={momentsLabelId}
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
            >
              {frames.map((frameTime) => {
                const selected =
                  !usingImage && Math.abs(frameTime - timeSeconds) < 0.01;
                return (
                  <button
                    aria-checked={selected}
                    aria-label={`Moment at ${formatTime(frameTime)}`}
                    className={cn(
                      "focus-visible:ring-ring relative cursor-pointer overflow-hidden rounded-md border bg-black transition-[border-color,box-shadow,opacity] duration-150 outline-none focus-visible:ring-[3px] disabled:cursor-default disabled:opacity-50",
                      selected
                        ? "border-brand ring-brand-ring ring-[3px]"
                        : "border-line hover:border-line-2",
                    )}
                    disabled={saving || usingImage}
                    key={frameTime}
                    onClick={() => setTimeSeconds(frameTime)}
                    role="radio"
                    style={{ aspectRatio }}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      src={frameUrl(testimonial.playbackId, frameTime)}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-2">
              {file ? (
                <>
                  <span className="type-small text-ink min-w-0 flex-1 truncate">
                    {file.name}
                  </span>
                  <Button
                    aria-label="Remove the image and pick a moment instead"
                    disabled={saving}
                    onClick={() => setFile(null)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <IconX aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild disabled={saving} size="sm" variant="outline">
                    <label className="cursor-pointer">
                      <IconPhotoUp aria-hidden="true" />
                      Upload an image
                      <input
                        accept={imageTypes.join(",")}
                        aria-label="Image file"
                        className="sr-only"
                        data-testid="thumbnail-image-file"
                        disabled={saving}
                        onChange={(event) => {
                          chooseFile(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                        type="file"
                      />
                    </label>
                  </Button>
                  <p className="type-small text-ink-2">
                    JPEG, PNG or WebP, 5 MB max.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mx-auto w-52 shrink-0 space-y-2 sm:mx-0">
            <p className="type-ui">On your Public Wall</p>
            <WallCardMiniature
              accentColor={accentColor}
              testimonial={{
                ...testimonial,
                posterTimeSeconds: timeSeconds,
                posterUrl: poster.loaded,
              }}
              width={previewWidth}
            >
              {poster.pending ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="sr-only"
                    data-testid="thumbnail-preload"
                    key={poster.pending}
                    onError={poster.markLoaded}
                    onLoad={poster.markLoaded}
                    src={poster.pending}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 z-10 h-0.5 animate-pulse"
                    style={{ background: accentColor }}
                  />
                </>
              ) : null}
            </WallCardMiniature>
          </div>
        </div>

        {error ? (
          <p className="text-danger type-small" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="items-center">
          <p className="text-ink-2 type-small mr-auto">
            {isPublished
              ? "Saving updates your Public Wall right away."
              : "Cancel keeps the current thumbnail."}
          </p>
          <Button disabled={saving} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setError(undefined);
              try {
                await onSave(
                  file
                    ? { file, kind: "image" }
                    : { kind: "frame", timeSeconds },
                );
                onClose();
              } catch (error) {
                setError(saveError(error));
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
