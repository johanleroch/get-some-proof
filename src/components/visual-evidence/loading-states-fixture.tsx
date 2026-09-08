"use client";

import { BlobLoadingText } from "@/components/brand/blob-loader";
import { VideoUploadProgress } from "@/components/collection/video-upload-progress";
import { Button } from "@/components/ui/button";
import { ProjectsPageSkeleton } from "@/components/ui/page-skeletons";

export function LoadingStatesFixture() {
  return (
    <div className="space-y-6 [--brand-accent:var(--brand)]">
      <h1 className="type-heading">Loading states</h1>
      <section className="bg-surface space-y-4 rounded-lg border p-5">
        <h2 className="type-subheading">Actions and inline waits</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading>Save settings</Button>
          <Button loading variant="outline">
            Send invitation
          </Button>
          <Button loading size="xs" variant="destructive">
            Delete
          </Button>
        </div>
        <BlobLoadingText label="Verifying this submission…" />
      </section>
      <VideoUploadProgress phase="uploading" progress={46} />
      <section className="bg-surface rounded-lg border p-5">
        <h2 className="type-subheading mb-4">Page content</h2>
        <ProjectsPageSkeleton />
      </section>
    </div>
  );
}
