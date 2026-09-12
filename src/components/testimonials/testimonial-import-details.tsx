"use client";

import { IconExternalLink, IconFileImport } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import type { TestimonialImportDetailsValue } from "./testimonial-inbox";
import { badgeVariants } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatShortDate } from "@/lib/format-date";

const providerLabels: Record<
  TestimonialImportDetailsValue["provider"],
  string
> = {
  assistant: "your assistant",
  senja: "Senja",
  "testimonial-to": "Testimonial.to",
};

function sourceHostname(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "the original source";
  }
}

export function TestimonialImportDetails({
  details,
  recoveryNeeded = false,
  slug,
  testimonialName,
}: {
  details: TestimonialImportDetailsValue;
  recoveryNeeded?: boolean;
  slug?: string;
  testimonialName: string;
}) {
  const [open, setOpen] = useState(false);
  const hostname = sourceHostname(details.sourceUrl);
  const provider = providerLabels[details.provider];

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={`Import details for ${testimonialName}`}
              className="focus-visible:ring-ring inline-flex min-h-10 min-w-6 items-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden md:min-h-9"
              onClick={() => setOpen(true)}
              type="button"
            >
              <span className={badgeVariants({ variant: "outline" })}>
                <IconFileImport aria-hidden="true" />
                Imported
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Imported from {hostname}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import details</DialogTitle>
            <DialogDescription>
              Where {testimonialName}&apos;s Testimonial came from.
            </DialogDescription>
          </DialogHeader>

          <dl className="border-line divide-line divide-y rounded-lg border">
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
              <dt className="type-small text-ink-2">Imported via</dt>
              <dd className="type-ui text-ink">{provider}</dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
              <dt className="type-small text-ink-2">Source</dt>
              <dd className="type-ui min-w-0">
                <a
                  className="text-brand-text inline-flex max-w-full items-center gap-1 underline underline-offset-4"
                  href={details.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="truncate">{hostname}</span>
                  <IconExternalLink
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </a>
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
              <dt className="type-small text-ink-2">Imported on</dt>
              <dd className="type-ui text-ink">
                {formatShortDate(details.importedAt)}
              </dd>
            </div>
          </dl>

          <DialogFooter>
            {recoveryNeeded && slug && details.jobId ? (
              <Button asChild variant="outline">
                <Link
                  href={
                    `/org/${slug}/inbox?import=${encodeURIComponent(details.jobId)}` as Route
                  }
                >
                  Review import progress
                </Link>
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
