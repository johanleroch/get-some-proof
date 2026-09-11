import {
  IconArrowLeft,
  IconCode,
  IconCopy,
  IconExternalLink,
} from "@tabler/icons-react";

import { WallFrames } from "@/components/doodles";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-[min(32rem,70vw)]" />
      </div>
      {action ? <Skeleton className="h-9 w-36" /> : null}
    </div>
  );
}

function MemberListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="dashboard-panel divide-y overflow-hidden">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="flex items-center gap-4 p-4" key={index}>
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function InvitationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="dashboard-panel space-y-5 p-5 md:p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

function MembersPageSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-label="Loading Members"
      className={cn("space-y-8", className)}
      role="status"
    >
      <PageHeaderSkeleton action />
      <MemberListSkeleton />
      <InvitationSkeleton />
      <span className="sr-only">Loading Members</span>
    </div>
  );
}

function InvitationsLoadingSkeleton() {
  return (
    <div aria-label="Loading Invitations" role="status">
      <InvitationSkeleton />
      <span className="sr-only">Loading Invitations</span>
    </div>
  );
}

function DirectoryLoadingSkeleton() {
  return (
    <div
      aria-label="Loading Member directory"
      className="space-y-6"
      role="status"
    >
      <PageHeaderSkeleton action />
      <MemberListSkeleton />
      <span className="sr-only">Loading Member directory</span>
    </div>
  );
}

function OverviewContentSkeleton() {
  return (
    <div
      aria-label="Loading Overview content"
      className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)] lg:items-start"
      role="status"
    >
      <section aria-label="Brand overview" className="space-y-6">
        <div className="border-line bg-surface rounded-xl border p-6 sm:p-8">
          <p className="type-micro text-ink-2">Your Collection Form</p>
          <Skeleton className="mt-2 h-7 w-[min(34rem,85%)]" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled type="button">
              <IconCopy aria-hidden="true" />
              Copy link
            </Button>
            <Button disabled type="button" variant="outline">
              Open Collection Form
              <IconExternalLink aria-hidden="true" />
            </Button>
          </div>
        </div>

        <section
          aria-label="Public Wall"
          className="border-line bg-surface grid gap-6 rounded-lg border p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-8"
        >
          <WallFrames
            aria-hidden="true"
            className="text-ink mx-auto h-28 lg:h-32"
          />
          <div className="min-w-0">
            <p className="type-micro text-ink-2">Your Public Wall</p>
            <h2 className="type-heading mt-1">
              Only what you publish reaches it
            </h2>
            <Skeleton className="mt-2 h-6 w-[min(30rem,80%)]" />
            <div className="mt-5 flex flex-wrap gap-2">
              <Button disabled type="button" variant="outline">
                Open Wall
                <IconExternalLink aria-hidden="true" />
              </Button>
              <Button disabled type="button" variant="ghost">
                Embed on your site
                <IconCode aria-hidden="true" />
              </Button>
            </div>
          </div>
        </section>
      </section>

      <AccountPlanSkeleton announce={false} />
      <span className="sr-only">Loading Overview content</span>
    </div>
  );
}

function AccountPlanSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <section
      aria-label={announce ? "Loading Account plan and usage" : undefined}
      className="border-line bg-surface space-y-4 rounded-lg border p-5 lg:sticky lg:top-6"
      role={announce ? "status" : undefined}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-4 w-44 max-w-full" />
      <div className="space-y-4 pt-1">
        {Array.from({ length: 2 }).map((_, index) => (
          <div className="space-y-2" key={index}>
            <div className="flex justify-between gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      {announce ? (
        <span className="sr-only">Loading Account plan and usage</span>
      ) : null}
    </section>
  );
}

function OverviewPageSkeleton({ name }: { name?: string }) {
  return (
    <div className="space-y-8">
      <PageHeader
        description="Share your Collection Form, read what comes in, publish what you choose."
        eyebrow="Overview"
        title={
          name ?? (
            <span
              aria-label="Loading Brand name"
              className="dashboard-skeleton inline-block h-9 w-40 rounded-md align-middle"
            />
          )
        }
      />
      <OverviewContentSkeleton />
    </div>
  );
}

function InboxListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section
      aria-label="Loading testimonials"
      className="border-line bg-surface overflow-hidden rounded-lg border"
      role="status"
    >
      <div className="divide-line divide-y">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            className="grid min-h-28 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 sm:p-5"
            key={index}
          >
            <Skeleton className="size-14 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-[min(28rem,85%)]" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="size-9" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading testimonials</span>
    </section>
  );
}

function InboxPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button disabled type="button">
              Import testimonials
            </Button>
            <Button disabled type="button" variant="outline">
              Open Public Wall
              <IconExternalLink aria-hidden="true" />
            </Button>
          </>
        }
        description="Review private Submissions and choose what becomes public."
        eyebrow="Workspace"
        title="Inbox"
      />
      <Tabs defaultValue="pending">
        <TabsList aria-label="Testimonial categories">
          {["Pending", "Published", "Archived", "Spam"].map((label) => (
            <TabsTrigger key={label} value={label.toLowerCase()}>
              {label}
              <Skeleton aria-hidden="true" className="h-3 w-4" />
            </TabsTrigger>
          ))}
        </TabsList>
        {["pending", "published", "archived", "spam"].map((category) => (
          <TabsContent key={category} value={category}>
            <InboxListSkeleton />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StudioWidgetListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section
      aria-label="Loading widgets"
      className="border-line bg-surface divide-line divide-y rounded-lg border"
      role="status"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className="flex min-h-20 items-center gap-3 p-4 sm:p-5"
          key={index}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="size-9" />
        </div>
      ))}
      <span className="sr-only">Loading widgets</span>
    </section>
  );
}

function StudioEditorSkeleton({ onBack }: { onBack?: () => void }) {
  return (
    <div
      aria-label="Opening widget"
      className="mx-auto w-full max-w-7xl p-5 sm:p-8"
      role="status"
    >
      <header className="border-line mb-6 space-y-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <Button
            aria-label="Back to Studio"
            disabled={!onBack}
            onClick={onBack}
            size="icon"
            type="button"
            variant="ghost"
          >
            <IconArrowLeft aria-hidden="true" className="size-5" />
          </Button>
          <Skeleton className="h-9 max-w-80 min-w-0 flex-1" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="space-y-2" key={index}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="min-h-[32rem] w-full" />
      </div>
      <span className="sr-only">Opening widget</span>
    </div>
  );
}

function StudioCandidateListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      aria-label="Loading published testimonials"
      className="border-line divide-line divide-y overflow-hidden rounded-lg border"
      role="status"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-4"
          key={index}
        >
          <Skeleton className="size-14 rounded-lg" />
          <div className="space-y-2 self-center">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-[min(24rem,80%)]" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading published testimonials</span>
    </div>
  );
}

function ProjectsPageSkeleton() {
  return (
    <div aria-label="Loading Projects" className="space-y-6" role="status">
      <PageHeaderSkeleton action />
      <div className="dashboard-panel overflow-hidden">
        <div className="flex gap-3 border-b p-4">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-32" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="flex items-center gap-4 border-b p-5 last:border-b-0"
            key={index}
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading Projects</span>
    </div>
  );
}

function AuditPageSkeleton() {
  return (
    <div aria-label="Loading Audit Log" className="space-y-6" role="status">
      <PageHeaderSkeleton />
      <div className="dashboard-panel divide-y overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="flex items-start justify-between gap-4 p-5"
            key={index}
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading Audit Log</span>
    </div>
  );
}

function AuditListSkeleton() {
  return (
    <div aria-label="Loading activity" role="status">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className="flex items-start justify-between gap-4 border-b p-5 last:border-b-0"
          key={index}
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
      <span className="sr-only">Loading activity</span>
    </div>
  );
}

export {
  AccountPlanSkeleton,
  AuditListSkeleton,
  AuditPageSkeleton,
  DirectoryLoadingSkeleton,
  InvitationsLoadingSkeleton,
  InboxListSkeleton,
  InboxPageSkeleton,
  MembersPageSkeleton,
  OverviewContentSkeleton,
  OverviewPageSkeleton,
  PageHeaderSkeleton,
  ProjectsPageSkeleton,
  StudioCandidateListSkeleton,
  StudioEditorSkeleton,
  StudioWidgetListSkeleton,
};
