"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ImportPhotoProgress({
  photos,
  onRetry,
}: {
  photos: {
    itemId: string;
    authorName: string;
    status: "processing" | "ready" | "failed";
    diagnostic?: string;
    attempt?: number;
  }[];
  onRetry: (itemId: string) => Promise<void>;
}) {
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!photos.length) return null;
  return (
    <section aria-label="Photo import progress" className="grid gap-3">
      <FieldError>{error}</FieldError>
      <ul className="divide-line divide-y">
        {photos.map((photo) => (
          <li
            key={photo.itemId}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <p className="type-small text-ink-2">
              {photo.authorName}:{" "}
              {photo.status === "ready"
                ? "Photo copied."
                : photo.status === "processing"
                  ? "Copying photo…"
                  : "Photo could not be copied. The testimonial was saved without it."}
              {process.env.NODE_ENV === "development" &&
                photo.status === "failed" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="focus-ring ml-2 inline-flex size-6 items-center justify-center rounded-sm align-middle"
                          aria-label={`Photo error details for ${photo.authorName}`}
                        >
                          <IconInfoCircle
                            className="size-4"
                            stroke={1.75}
                            aria-hidden="true"
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm text-left break-words whitespace-pre-line">
                        {`Photo import · development\n${photo.diagnostic ?? "No diagnostic recorded. Retry the photo to capture one."}\nAttempt: ${photo.attempt ?? "unknown"}\nItem: ${photo.itemId}\nBackend: ${process.env.NEXT_PUBLIC_CONVEX_URL ?? "unknown"}`}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
            </p>
            {photo.status === "failed" && (
              <Button
                variant="outline"
                disabled={retrying !== null}
                loading={retrying === photo.itemId}
                aria-label={`Retry photo for ${photo.authorName}`}
                onClick={async () => {
                  setRetrying(photo.itemId);
                  setError("");
                  try {
                    await onRetry(photo.itemId);
                  } catch {
                    setError(
                      "The photo could not be retried. Refresh the import and try again.",
                    );
                  } finally {
                    setRetrying(null);
                  }
                }}
              >
                Retry photo
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
