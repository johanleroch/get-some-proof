import { Skeleton } from "@/components/ui/skeleton";
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

function OverviewPageSkeleton() {
  return (
    <div
      aria-label="Loading Organization overview"
      className="space-y-6"
      role="status"
    >
      <PageHeaderSkeleton action />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="dashboard-panel space-y-5 p-5" key={index}>
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="size-4" />
            </div>
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div className="dashboard-panel space-y-5 p-6" key={index}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-56 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading Organization overview</span>
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
  AuditListSkeleton,
  AuditPageSkeleton,
  DirectoryLoadingSkeleton,
  InvitationsLoadingSkeleton,
  MembersPageSkeleton,
  OverviewPageSkeleton,
  PageHeaderSkeleton,
  ProjectsPageSkeleton,
};
