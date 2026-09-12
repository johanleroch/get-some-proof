"use client";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import {
  AssistantImportRecoveryView,
  type AssistantImportProgress,
} from "@/components/testimonials/assistant-import-recovery";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { IconUpload } from "@tabler/icons-react";
export function AssistantImportRecoveryFixture() {
  const [value, setValue] = useState<AssistantImportProgress>({
    jobId: "fixture-job" as Id<"testimonialImportJobs">,
    sourceUrl: "https://willow-ceramics.example/stories",
    createdAt: Date.UTC(2026, 8, 10),
    canUpload: true,
    createdCount: 5,
    readyCount: 1,
    availableVideoSlots: 2,
    result: {
      imported: 2,
      skipped: 1,
      changed: 1,
      unavailable: 0,
      processing: 1,
      failed: 1,
      blocked: 1,
    },
    items: [
      {
        itemId: "elise" as Id<"testimonialImportItems">,
        authorName: "Elise Martin",
        videoStatus: undefined,
        portraitStatus: "failed",
        blocked: false,
        hasVideoUrl: false,
        failureMessage: undefined,
      },
      {
        itemId: "camille" as Id<"testimonialImportItems">,
        authorName: "Camille Roche",
        videoStatus: "failed",
        portraitStatus: "ready",
        blocked: false,
        hasVideoUrl: false,
        failureMessage:
          "Choose the original file to complete this Pending testimonial.",
      },
      {
        itemId: "lina" as Id<"testimonialImportItems">,
        authorName: "Lina Moreau",
        failureMessage: undefined,
        videoStatus: "processing",
        portraitStatus: "ready",
        blocked: false,
        hasVideoUrl: true,
      },
      {
        itemId: "remy" as Id<"testimonialImportItems">,
        authorName: "Remy Jupille",
        failureMessage: undefined,
        portraitStatus: undefined,
        videoStatus: "ready",
        blocked: false,
        hasVideoUrl: true,
      },
      {
        itemId: "nora" as Id<"testimonialImportItems">,
        authorName: "Nora Lewis",
        failureMessage: undefined,
        portraitStatus: undefined,
        videoStatus: "failed",
        blocked: true,
        hasVideoUrl: true,
      },
    ],
  });
  return (
    <main className="bg-paper text-ink min-h-svh space-y-6 p-5 md:p-8">
      <PageHeader
        eyebrow="Workspace"
        title="Inbox"
        description="Review private Submissions and choose what becomes public."
      />
      <AssistantImportRecoveryView
        value={value}
        onResumeVideos={async (itemIds) => {
          const selectedIds = new Set(itemIds);
          setValue((current) => ({
            ...current,
            availableVideoSlots: current.availableVideoSlots - itemIds.length,
            result: {
              ...current.result,
              blocked: (current.result.blocked ?? 0) - itemIds.length,
              processing: (current.result.processing ?? 0) + itemIds.length,
            },
            items: current.items.map((item) =>
              selectedIds.has(item.itemId)
                ? { ...item, blocked: false, videoStatus: "processing" }
                : item,
            ),
          }));
        }}
        onRetryPortrait={async (itemId) =>
          setValue((current) => ({
            ...current,
            items: current.items.map((item) =>
              item.itemId === itemId
                ? { ...item, portraitStatus: "processing" }
                : item,
            ),
          }))
        }
        fileUpload={(item) =>
          item.videoStatus === "failed" ? (
            <Button size="sm" variant="outline" className="h-10 sm:h-9">
              <IconUpload aria-hidden="true" />
              Choose video file
            </Button>
          ) : null
        }
      />
    </main>
  );
}
