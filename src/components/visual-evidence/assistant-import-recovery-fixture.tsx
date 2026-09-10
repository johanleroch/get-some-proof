"use client";
import type { Id } from "@convex/_generated/dataModel";
import { AssistantImportRecoveryView } from "@/components/testimonials/assistant-import-recovery";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { IconUpload } from "@tabler/icons-react";
export function AssistantImportRecoveryFixture() {
  return (
    <main className="bg-paper text-ink min-h-svh space-y-6 p-5 md:p-8">
      <PageHeader
        eyebrow="Workspace"
        title="Inbox"
        description="Review private Submissions and choose what becomes public."
      />
      <AssistantImportRecoveryView
        value={{
          jobId: "fixture-job" as Id<"testimonialImportJobs">,
          sourceUrl: "https://willow-ceramics.example/stories",
          createdAt: Date.UTC(2026, 8, 10),
          canUpload: true,
          createdCount: 5,
          readyCount: 1,
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
        }}
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
