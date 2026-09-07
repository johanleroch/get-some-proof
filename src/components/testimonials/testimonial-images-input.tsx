"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import {
  type TestimonialImage,
  maximumTestimonialImages,
  maximumTestimonialImageBytes,
  testimonialImageMimeTypes,
} from "@convex/domain/testimonialImage";
import { Button } from "@/components/ui/button";

function FilePreview({ file }: { file: File }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="relative h-24">
      <Image
        ref={imageRef}
        alt={file.name}
        className="rounded-md object-contain"
        fill
        sizes="(max-width: 640px) 30vw, 180px"
        src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
        unoptimized
      />
    </div>
  );
}
export function TestimonialImagesInput({
  files,
  onFilesChange,
  images = [],
  onImagesChange,
  disabled = false,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  images?: TestimonialImage[];
  onImagesChange?: (images: TestimonialImage[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const allowedTypes = new Set(testimonialImageMimeTypes);
  const [error, setError] = useState<string>();
  const count = files.length + images.length;
  return (
    <div className="space-y-2">
      {count > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image, index) => (
            <div className="relative rounded-md border p-1" key={image.id}>
              <Image
                alt={`Attached image ${index + 1}`}
                className="h-auto max-h-24 w-full rounded-md object-contain"
                height={96}
                src={image.url}
                unoptimized
                width={120}
              />
              <Button
                aria-label={`Remove attached image ${index + 1}`}
                className="absolute top-0 right-0 size-7"
                disabled={disabled}
                onClick={() =>
                  onImagesChange?.(
                    images.filter((item) => item.id !== image.id),
                  )
                }
                size="icon"
                type="button"
                variant="secondary"
              >
                <X />
              </Button>
            </div>
          ))}
          {files.map((file, index) => (
            <div
              className="relative rounded-md border p-1"
              key={`${file.name}-${file.size}-${file.lastModified}`}
            >
              <FilePreview file={file} />
              <Button
                aria-label={`Remove ${file.name}`}
                className="absolute top-0 right-0 size-7"
                disabled={disabled}
                onClick={() =>
                  onFilesChange(files.filter((_, i) => i !== index))
                }
                size="icon"
                type="button"
                variant="secondary"
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <input
        accept={testimonialImageMimeTypes.join(",")}
        aria-label="Attach testimonial images"
        className="sr-only"
        disabled={disabled || count >= maximumTestimonialImages}
        multiple
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (selected.length + count > maximumTestimonialImages) {
            setError("Add up to 3 images.");
            return;
          }
          if (
            selected.some(
              (file) =>
                !allowedTypes.has(file.type) ||
                file.size > maximumTestimonialImageBytes ||
                file.size === 0,
            )
          ) {
            setError("Choose JPG, PNG or WebP images smaller than 5 MB.");
            return;
          }
          setError(undefined);
          const unique = new Map(
            [...files, ...selected].map((file) => [
              `${file.name}-${file.size}-${file.lastModified}`,
              file,
            ]),
          );
          onFilesChange([...unique.values()]);
        }}
        ref={input}
        type="file"
      />
      <Button
        disabled={disabled || count >= maximumTestimonialImages}
        onClick={() => input.current?.click()}
        size="sm"
        type="button"
        variant="ghost"
      >
        <ImagePlus aria-hidden="true" /> Add images{" "}
        <span className="text-muted-foreground text-xs">
          {count ? `${count}/3` : "Optional"}
        </span>
      </Button>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
