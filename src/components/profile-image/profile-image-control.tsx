"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera, IconTrash } from "@tabler/icons-react";

import { ImageCropDialog } from "@/components/profile-image/image-crop-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/error-toast";
import {
  acceptedImageInputTypes,
  maximumImageInputBytes,
} from "@/lib/image-assets";
import { cn } from "@/lib/utils";

export function ProfileImageControl({
  alt,
  cropShape,
  fallback,
  imageUrl,
  label,
  onRemove,
  onUpload,
  preserveRatio = false,
  readOnly = false,
  size = "md",
}: {
  alt: string;
  cropShape: "round" | "rect";
  fallback: string;
  imageUrl: string | null;
  label: string;
  onRemove: () => Promise<void>;
  onUpload: (blob: Blob) => Promise<void>;
  preserveRatio?: boolean;
  readOnly?: boolean;
  /** `sm` where the image is optional and must not outweigh the fields. */
  size?: "md" | "sm";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );

  function chooseFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (
      !(acceptedImageInputTypes as readonly string[]).includes(file.type) ||
      file.size > maximumImageInputBytes ||
      file.size === 0
    ) {
      setError("Choose a JPEG, PNG, WebP, or AVIF image smaller than 20 MB.");
      return;
    }
    if (preserveRatio) {
      void upload(file);
      return;
    }
    setSource(URL.createObjectURL(file));
  }

  async function upload(blob: Blob) {
    setBusy(true);
    setError(null);
    try {
      await onUpload(blob);
      setSource(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await onRemove();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Removal failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="group relative w-fit">
        <Avatar
          className={cn(
            size === "sm" ? "size-16" : "size-24",
            cropShape === "rect" && "rounded-xl",
          )}
        >
          {imageUrl ? <AvatarImage alt={alt} src={imageUrl} /> : null}
          <AvatarFallback
            className={cn(
              "font-semibold",
              size === "sm" ? "text-base" : "text-xl",
              cropShape === "rect" && "rounded-xl",
            )}
          >
            {fallback}
          </AvatarFallback>
        </Avatar>
        {!readOnly ? (
          <button
            aria-label={`Edit ${label.toLowerCase()}`}
            className="bg-background/95 hover:bg-background pointer-events-none absolute inset-x-2 bottom-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <IconCamera className="size-3.5" />
            Edit
          </button>
        ) : null}
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            JPEG, PNG, WebP, or AVIF. Maximum 20 MB.
          </p>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {imageUrl ? "Replace image" : "Upload image"}
            </Button>
            {imageUrl ? (
              <Button
                disabled={busy}
                onClick={() => void remove()}
                size="sm"
                type="button"
                variant="ghost"
              >
                <IconTrash /> Remove
              </Button>
            ) : null}
          </div>
        ) : null}
        <input
          aria-label={`Upload ${label.toLowerCase()}`}
          accept={acceptedImageInputTypes.join(",")}
          className="sr-only"
          onChange={(event) => {
            chooseFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        {error ? <ErrorToast message={error} /> : null}
      </div>
      <ImageCropDialog
        key={source ?? "closed"}
        busy={busy}
        cropShape={cropShape}
        onCancel={() => !busy && setSource(null)}
        onConfirm={upload}
        source={source}
        title={`Edit ${label.toLowerCase()}`}
      />
    </div>
  );
}
