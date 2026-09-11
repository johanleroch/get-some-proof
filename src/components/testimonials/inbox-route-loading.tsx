"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";

import { useProjectShell } from "@/components/organizations/project-shell-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { InboxListSkeleton } from "@/components/ui/page-skeletons";
import {
  InboxCategoryTabs,
  InboxImportActions,
  inboxCategoryFromUrl,
  setModerationStatusFilter,
} from "@/components/testimonials/testimonial-inbox";

export function InboxRouteLoading() {
  const project = useProjectShell();
  const moderationStatus = inboxCategoryFromUrl(useSearchParams());

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          project ? (
            <InboxImportActions
              publicSlug={project.publicSlug}
              slug={project.slug}
            />
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button disabled type="button">
                Import testimonials
              </Button>
              <Button disabled type="button" variant="outline">
                Open Public Wall
                <IconExternalLink aria-hidden="true" />
              </Button>
            </div>
          )
        }
        description="Review private Submissions and choose what becomes public."
        eyebrow="Workspace"
        title="Inbox"
      />
      <InboxCategoryTabs
        moderationStatus={moderationStatus}
        onModerationStatusChange={setModerationStatusFilter}
      >
        <InboxListSkeleton />
      </InboxCategoryTabs>
    </div>
  );
}
