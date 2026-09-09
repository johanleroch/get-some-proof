"use client";

import { useState } from "react";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { TestimonialImportView } from "@/components/testimonials/testimonial-import";
import { ImportPublicationDialog } from "@/components/testimonials/import-publication-dialog";
import { Button } from "@/components/ui/button";

const jobId = "fixture-wall-import" as Id<"testimonialImportJobs">;
const quotes = [
  {
    authorName: "Camille Laurent",
    tagline: "Founder, Atelier June",
    text: "We had kind words scattered across emails and old pages. Now our customers can see them all in one place.",
  },
  {
    authorName: "Daniel Reed",
    tagline: "Owner, Fernhill Studio",
    text: "I brought over our client testimonials in a few minutes. Being able to choose exactly what appears on the wall made the move much easier.",
  },
  {
    authorName: "Lina Moreau",
    tagline: "Photographer",
    text: "The best part is keeping our clients’ own words. Their stories explain our work better than we ever could.",
  },
];
const items: Doc<"testimonialImportItems">[] = quotes.map(
  (quote, position) => ({
    ...quote,
    _id: `fixture-import-${position}` as Id<"testimonialImportItems">,
    _creationTime: 0,
    organizationId: "fixture-fernhill" as Id<"organizations">,
    jobId,
    position,
    sourceId: `source-${position}`,
    type: "text",
  }),
);

export function TestimonialImportFixture({
  initial = "preview",
  publicPreview = false,
}: {
  initial?: "url" | "preview" | "expired" | "video-failed" | "video-processing";
  publicPreview?: boolean;
}) {
  const [step, setStep] = useState<
    | "url"
    | "preview"
    | "result"
    | "expired"
    | "video-failed"
    | "video-processing"
  >(initial);
  const [provider, setProvider] = useState<"testimonial-to" | "senja">(
    "testimonial-to",
  );
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState(
    new Set(items.slice(0, 2).map((item) => item._id)),
  );
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [previewItems, setPreviewItems] = useState(items);
  const [typeFilter, setTypeFilter] = useState<"all" | "text" | "video">("all");
  return (
    <main
      className={
        publicPreview
          ? "bg-paper text-ink min-h-svh p-5 md:p-8 [&_button:not([role=checkbox])]:min-h-11 [&_label:has([role=checkbox])]:min-h-11 [&_label:has([role=checkbox])]:min-w-11"
          : "bg-paper text-ink min-h-svh p-5 md:p-8"
      }
    >
      <TestimonialImportView
        publicPreview={publicPreview}
        typeFilter={typeFilter}
        onTypeFilterChange={(type) => {
          setTypeFilter(type);
          setCursors([null]);
        }}
        slug="fernhill-studio"
        jobId={step === "url" ? null : jobId}
        provider={provider}
        setProvider={setProvider}
        url={url}
        setUrl={setUrl}
        loading={false}
        saving={false}
        error=""
        result={
          step === "video-processing"
            ? {
                imported: 1,
                skipped: 0,
                changed: 0,
                unavailable: 0,
                processing: 1,
                failed: 0,
              }
            : step === "result"
              ? {
                  imported: selected.size,
                  skipped: 0,
                  changed: 0,
                  unavailable: 0,
                }
              : null
        }
        preview={
          step === "expired"
            ? null
            : {
                provider,
                sourceUrl: "https://testimonial.to/fernhill-studio/all",
                itemCount: step === "video-failed" ? 1 : items.length,
                expiresAt: 0,
                videoCapacity: {
                  used: 0,
                  limit: 2,
                  available: true,
                  configured: false,
                },
                result: null,
                selectedItemIds: [],
                items: {
                  page:
                    step === "video-failed"
                      ? [
                          {
                            ...items[0]!,
                            type: "video",
                            videoStatus: "failed",
                            failureReason:
                              "The source video could not be copied. Check that it is still available and retry.",
                          },
                        ]
                      : previewItems.filter(
                          (item) =>
                            typeFilter === "all" || item.type === typeFilter,
                        ),
                  isDone: true,
                  continueCursor: "",
                },
              }
        }
        selected={step === "video-failed" ? new Set() : selected}
        changeSelection={setSelected}
        cursors={cursors}
        setCursors={setCursors}
        backToUrl={() => setStep("url")}
        read={async () => setStep("preview")}
        save={async () => setStep("result")}
        onRetry={async () => setStep("video-processing")}
        onCorrectIdentity={
          publicPreview
            ? undefined
            : async (itemId, identity) => {
                setPreviewItems((previous) =>
                  previous.map((item) =>
                    item._id === itemId
                      ? {
                          ...item,
                          identityCorrection: {
                            ...identity,
                            editedBy: "fixture-owner",
                            editedAt: 0,
                          },
                        }
                      : item,
                  ),
                );
              }
        }
      />
    </main>
  );
}

export function PublicTestimonialImportFixture() {
  return <TestimonialImportFixture publicPreview />;
}

export function TestimonialImportUrlFixture() {
  return <TestimonialImportFixture initial="url" />;
}

export function TestimonialImportVideoFailedFixture() {
  return <TestimonialImportFixture initial="video-failed" />;
}
export function TestimonialImportVideoProcessingFixture() {
  return <TestimonialImportFixture initial="video-processing" />;
}

export function TestimonialImportExpiredFixture() {
  return <TestimonialImportFixture initial="expired" />;
}

export function ImportPublicationFixture() {
  const [open, setOpen] = useState(true);
  const [published, setPublished] = useState(false);
  return (
    <main className="bg-paper text-ink min-h-svh p-5 md:p-8">
      <Button
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        Publish testimonial
      </Button>
      {published && (
        <p role="status" className="type-body mt-4">
          Testimonial published.
        </p>
      )}
      {open && (
        <ImportPublicationDialog
          name="Camille Laurent"
          onClose={() => setOpen(false)}
          onPublish={async () => setPublished(true)}
        />
      )}
    </main>
  );
}
