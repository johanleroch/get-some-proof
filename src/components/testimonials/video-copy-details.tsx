"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { useState } from "react";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function sourceLabel(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname}`;
  } catch {
    return "Original video";
  }
}

export function VideoCopyDetails({
  busy,
  disabled,
  failureReason,
  onRetry,
  sourceUrl,
  status,
  testimonialName,
}: {
  busy: boolean;
  disabled: boolean;
  failureReason?: string;
  onRetry: () => Promise<unknown>;
  sourceUrl: string;
  status: "failed" | "processing";
  testimonialName: string;
}) {
  const [open, setOpen] = useState(false);
  const processing = status === "processing";

  return (
    <>
      <button
        aria-label={`Video copy details for ${testimonialName}`}
        className="focus-visible:ring-ring inline-flex rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span
          className={cn(
            badgeVariants({ variant: processing ? "warning" : "danger" }),
            "pl-2",
          )}
        >
          <span
            aria-hidden="true"
            className={
              processing
                ? "bg-warning size-1.5 rounded-full"
                : "bg-danger size-1.5 rounded-full"
            }
          />
          {processing ? "Processing" : "Failed"}
        </span>
      </button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Video copy</DialogTitle>
            <DialogDescription>
              Copy status for {testimonialName}&apos;s imported video.
            </DialogDescription>
          </DialogHeader>

          <dl className="border-line divide-line divide-y rounded-lg border">
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[6rem_1fr] sm:gap-4">
              <dt className="type-small text-ink-2">Status</dt>
              <dd>
                <Badge variant={processing ? "warning" : "danger"}>
                  {processing ? "Processing" : "Failed"}
                </Badge>
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[6rem_1fr] sm:gap-4">
              <dt className="type-small text-ink-2">Video URL</dt>
              <dd className="type-ui min-w-0">
                <a
                  className="text-brand-text inline-flex max-w-full items-center gap-1 underline underline-offset-4"
                  href={sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="truncate">{sourceLabel(sourceUrl)}</span>
                  <IconExternalLink
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </a>
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[6rem_1fr] sm:gap-4">
              <dt className="type-small text-ink-2">
                {processing ? "Progress" : "Error"}
              </dt>
              <dd className="type-small text-ink">
                {processing
                  ? "Copying and checking the video. This dialog updates automatically."
                  : (failureReason ??
                    "The imported video could not be copied.")}
              </dd>
            </div>
          </dl>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            {!processing ? (
              <Button
                disabled={disabled}
                loading={busy}
                onClick={() => void onRetry()}
              >
                Retry copy
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
