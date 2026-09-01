"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera, IconTrash } from "@tabler/icons-react";

import { ImageCropDialog } from "@/components/profile-image/image-crop-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const maximumImageBytes = 5 * 1024 * 1024;

export function ProfileImageControl({
  alt,
  cropShape,
  fallback,
  imageUrl,
  label,
  onRemove,
  onUpload,
  readOnly = false,
}: {
  alt: string;
  cropShape: "round" | "rect";
  fallback: string;
  imageUrl: string | null;
  label: string;
  onRemove: () => Promise<void>;
  onUpload: (blob: Blob) => Promise<void>;
  readOnly?: boolean;
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
    if (!file.type.startsWith("image/") || file.size > maximumImageBytes) {
      setError("Choose a PNG, JPG, or WebP image smaller than 5 MB.");
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
          className={cropShape === "round" ? "size-24" : "size-24 rounded-xl"}
        >
          {imageUrl ? <AvatarImage alt={alt} src={imageUrl} /> : null}
          <AvatarFallback
            className={
              cropShape === "round"
                ? "text-xl font-semibold"
                : "rounded-xl text-xl font-semibold"
            }
          >
            {fallback}
          </AvatarFallback>
        </Avatar>
        {!readOnly ? (
          <button
            aria-label={`Edit ${label.toLowerCase()}`}
            className="bg-background/95 hover:bg-background absolute inset-x-2 bottom-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium shadow-sm"
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
            PNG, JPG, or WebP. Maximum 5 MB.
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
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            chooseFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        {error ? (
          <p
            aria-live="assertive"
            className="text-destructive text-xs"
            role="alert"
          >
            {error}
          </p>
        ) : null}
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
