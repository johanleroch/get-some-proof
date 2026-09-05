"use client";

import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/error-toast";
import { OverviewPageSkeleton } from "@/components/ui/page-skeletons";
import { PublishedCuration } from "@/components/testimonials/published-curation";
import {
  TestimonialCard,
  type TestimonialCardValue,
} from "@/components/testimonials/testimonial-card";
import {
  InboxTestimonialMenu,
  type InboxTestimonialAction,
} from "@/components/testimonials/inbox-testimonial-menu";
import {
  videoDownloadFeedback,
  waitForVideoDownload,
} from "@/components/testimonials/video-download-feedback";

type InboxTestimonialIdentity = {
  card: TestimonialCardValue | null;
  consentAcceptedAt: number;
  createdAt: number;
  moderationStatus: "pending" | "published" | "archived" | "spam";
  publicVisibilityOverrides?: {
    avatar?: boolean;
    company?: boolean;
    rating?: boolean;
    role?: boolean;
  };
  quarantineExpiresAt?: number;
  spamCreditRestored?: boolean;
  submitterEmail: string;
  submitterName: string;
  testimonialId: Id<"testimonials">;
};

type InboxTestimonial =
  | (InboxTestimonialIdentity & {
      card: TestimonialCardValue;
      submissionType: "text";
    })
  | (InboxTestimonialIdentity & {
      canDownload: boolean;
      captionsStatus: "requested" | "ready" | "failed";
      submissionType: "video";
      videoStatus: "awaiting_upload" | "processing" | "ready" | "failed";
    });

type ModerationFilter = "all" | "pending" | "published" | "archived" | "spam";
type SubmissionTypeFilter = "all" | "text" | "video";

const deletionSubmittedAtFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
type InboxSort = "newest" | "oldest";

function videoStatusLabel(
  status: Extract<InboxTestimonial, { submissionType: "video" }>["videoStatus"],
) {
  return status === "awaiting_upload"
    ? "Awaiting upload"
    : `${status[0].toUpperCase()}${status.slice(1)}`;
}

export function TestimonialInboxView({
  accentColor = "#6d5dfc",
  actionsDisabled = false,
  onAction,
  testimonials,
}: {
  accentColor?: string;
  actionsDisabled?: boolean;
  onAction: (
    testimonial: InboxTestimonial,
    action: InboxTestimonialAction,
  ) => void;
  testimonials: InboxTestimonial[];
}) {
  if (testimonials.length === 0) {
    return (
      <section className="bg-card rounded-xl border border-dashed p-10 text-center shadow-xs">
        <h2 className="font-semibold">No Testimonials match these filters.</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
          New Submissions appear here as Pending before anything becomes public.
        </p>
      </section>
    );
  }

  return (
    <div className="columns-1 gap-4 lg:columns-2 xl:columns-3">
      {testimonials.map((testimonial) => {
        const menu = (
          <InboxTestimonialMenu
            disabled={actionsDisabled}
            onAction={(action) => onAction(testimonial, action)}
            testimonial={testimonial}
          />
        );
        return (
          <div
            data-testid={`inbox-testimonial-${testimonial.testimonialId}`}
            key={testimonial.testimonialId}
          >
            {testimonial.card ? (
              <TestimonialCard
                accentColor={accentColor}
                menu={menu}
                testimonial={testimonial.card}
              />
            ) : testimonial.submissionType === "video" ? (
              <section className="bg-card relative mb-5 grid min-h-64 break-inside-avoid place-items-center overflow-hidden rounded-xl border px-6 py-10 text-center shadow-xs">
                <div className="absolute top-3 right-3">{menu}</div>
                <div>
                  <p className="font-medium">
                    {videoStatusLabel(testimonial.videoStatus)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {testimonial.captionsStatus === "failed"
                      ? "Captions unavailable"
                      : testimonial.captionsStatus === "ready"
                        ? "Captions ready"
                        : "Captions requested"}
                  </p>
                </div>
              </section>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function TestimonialDeleteDialog({
  onDelete,
  onDownload,
  onOpenChange,
  pending,
  target,
}: {
  onDelete: () => void;
  onDownload: (testimonial: InboxTestimonial) => void;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  target: InboxTestimonial | null;
}) {
  const submittedAt = target
    ? deletionSubmittedAtFormatter.format(new Date(target.createdAt))
    : null;
  return (
    <AlertDialog onOpenChange={onOpenChange} open={target !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Permanently delete {target?.submitterName}&apos;s Testimonial?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `${target.submissionType === "video" ? "Video" : "Text"} Testimonial submitted ${submittedAt} UTC · ${target.testimonialId}. `
              : null}
            {target?.submissionType === "video"
              ? "This immediately removes the video from the Public Wall, then deletes its Mux source, renditions, captions, thumbnails, private record, consent, and email history. This cannot be undone."
              : "This immediately removes it from the Public Wall and deletes its private content, consent record, email history, and avatar. This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row">
          {target?.submissionType === "video" &&
          target.videoStatus === "ready" &&
          target.canDownload ? (
            <Button
              disabled={pending}
              onClick={() => onDownload(target)}
              variant="outline"
            >
              <Download aria-hidden="true" />
              Download MP4 first
            </Button>
          ) : null}
          <AlertDialogCancel asChild>
            <Button disabled={pending} variant="outline">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button disabled={pending} onClick={onDelete} variant="destructive">
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InboxFilters({
  moderationStatus,
  onModerationStatusChange,
  onSortChange,
  onSubmissionTypeChange,
  sort,
  submissionType,
}: {
  moderationStatus: ModerationFilter;
  onModerationStatusChange: (value: ModerationFilter) => void;
  onSortChange: (value: InboxSort) => void;
  onSubmissionTypeChange: (value: SubmissionTypeFilter) => void;
  sort: InboxSort;
  submissionType: SubmissionTypeFilter;
}) {
  return (
    <div className="flex flex-wrap gap-3" aria-label="Inbox filters">
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground block text-xs">Status</span>
        <select
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
          onChange={(event) =>
            onModerationStatusChange(event.target.value as ModerationFilter)
          }
          value={moderationStatus}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
          <option value="spam">Spam quarantine</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground block text-xs">Type</span>
        <select
          aria-label="Type"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
          onChange={(event) =>
            onSubmissionTypeChange(event.target.value as SubmissionTypeFilter)
          }
          value={submissionType}
        >
          <option value="all">All types</option>
          <option value="text">Text</option>
          <option value="video">Video</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground block text-xs">Sort</span>
        <select
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
          onChange={(event) => onSortChange(event.target.value as InboxSort)}
          value={sort}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>
    </div>
  );
}

export function InboxFeedback({
  error,
  message,
  tone = "success",
}: {
  error: string | null;
  message: string | null;
  tone?: "processing" | "success";
}) {
  return (
    <>
      {message ? (
        <p
          className={
            tone === "processing"
              ? "rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300"
              : "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? <ErrorToast message={error} /> : null}
    </>
  );
}

function InboxLoadMore({
  onLoadMore,
  paginationStatus,
  pending,
}: {
  onLoadMore: () => void;
  paginationStatus: string;
  pending: boolean;
}) {
  if (
    paginationStatus !== "CanLoadMore" &&
    paginationStatus !== "LoadingMore"
  ) {
    return null;
  }
  return (
    <Button
      disabled={paginationStatus === "LoadingMore" || pending}
      onClick={onLoadMore}
      type="button"
      variant="outline"
    >
      {paginationStatus === "LoadingMore"
        ? "Loading…"
        : "Load more Testimonials"}
    </Button>
  );
}

function actionError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The Testimonial action could not be completed.";
}

async function runInboxAction({
  onError,
  onFinish,
  onStart,
  onSuccess,
  run,
}: {
  onError: (message: string) => void;
  onFinish: () => void;
  onStart: () => void;
  onSuccess: () => void;
  run: () => Promise<unknown>;
}) {
  onStart();
  try {
    await run();
    onSuccess();
  } catch (error) {
    onError(actionError(error));
  } finally {
    onFinish();
  }
}

export function TestimonialInbox({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const [moderationStatus, setModerationStatusFilter] =
    useState<ModerationFilter>("all");
  const [submissionType, setSubmissionType] =
    useState<SubmissionTypeFilter>("all");
  const [sort, setSort] = useState<InboxSort>("newest");
  const {
    loadMore,
    results: testimonials,
    status: paginationStatus,
  } = usePaginatedQuery(
    api.testimonialModeration.listInbox,
    organization
      ? {
          organizationId: organization.id,
          sort,
          status: moderationStatus === "all" ? undefined : moderationStatus,
          submissionType: submissionType === "all" ? undefined : submissionType,
        }
      : "skip",
    { initialNumItems: 20 },
  );
  const setModerationStatus = useMutation(api.testimonialModeration.setStatus);
  const wallSettings = useQuery(
    api.wallCustomization.getSettings,
    organization ? { organizationId: organization.id } : "skip",
  );
  const markSpam = useMutation(api.testimonialModeration.markSpam);
  const undoSpam = useMutation(api.testimonialModeration.undoSpam);
  const removeText = useMutation(api.testimonialModeration.remove);
  const removeVideo = useAction(api.videoMedia.remove);
  const requestDownload = useAction(api.videoMedia.requestDownload);
  const [deleteTarget, setDeleteTarget] = useState<InboxTestimonial | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"processing" | "success">(
    "success",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (organization === undefined || paginationStatus === "LoadingFirstPage") {
    return <OverviewPageSkeleton />;
  }
  if (organization === null) {
    return <p className="text-muted-foreground text-sm">Brand unavailable.</p>;
  }
  const activeOrganization = organization;

  async function changeStatus(
    testimonial: InboxTestimonial,
    nextStatus: "published" | "archived",
  ) {
    await runInboxAction({
      onError: setError,
      onFinish: () => setPending(false),
      onStart: () => {
        setPending(true);
        setError(null);
        setMessage(null);
      },
      onSuccess: () => {
        setMessageTone("success");
        setMessage(
          `${testimonial.submitterName}'s Testimonial is now ${nextStatus}.`,
        );
      },
      run: () =>
        setModerationStatus({
          organizationId: activeOrganization.id,
          status: nextStatus,
          testimonialId: testimonial.testimonialId,
        }),
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const args = {
      organizationId: activeOrganization.id,
      testimonialId: deleteTarget.testimonialId,
    };
    const remove =
      deleteTarget.submissionType === "video" ? removeVideo : removeText;
    await runInboxAction({
      onError: setError,
      onFinish: () => setPending(false),
      onStart: () => {
        setPending(true);
        setError(null);
        setMessage(null);
      },
      onSuccess: () => {
        setMessageTone("success");
        setMessage("Testimonial permanently deleted.");
        setDeleteTarget(null);
      },
      run: () => remove(args),
    });
  }

  async function changeSpamStatus(
    testimonial: InboxTestimonial,
    action: "mark" | "undo",
  ) {
    await runInboxAction({
      onError: setError,
      onFinish: () => setPending(false),
      onStart: () => {
        setPending(true);
        setError(null);
        setMessage(null);
      },
      onSuccess: () => {
        setMessageTone("success");
        setMessage(
          action === "mark"
            ? "Testimonial moved to seven-day Spam quarantine."
            : "Spam report undone and collection capacity updated.",
        );
      },
      run: () =>
        (action === "mark" ? markSpam : undoSpam)({
          organizationId: activeOrganization.id,
          testimonialId: testimonial.testimonialId,
        }),
    });
  }

  async function downloadVideo(testimonial: InboxTestimonial) {
    if (testimonial.submissionType !== "video") return;
    await runInboxAction({
      onError: setError,
      onFinish: () => setPending(false),
      onStart: () => {
        setPending(true);
        setError(null);
        setMessage(null);
      },
      onSuccess: () => {
        setMessageTone("success");
        setMessage(videoDownloadFeedback("ready"));
      },
      run: async () => {
        const result = await waitForVideoDownload({
          onProcessing: () => {
            setMessageTone("processing");
            setMessage(videoDownloadFeedback("processing"));
          },
          requestDownload: () =>
            requestDownload({
              organizationId: activeOrganization.id,
              testimonialId: testimonial.testimonialId,
            }),
        });
        const link = document.createElement("a");
        link.href = result.url;
        link.rel = "noopener noreferrer";
        link.click();
      },
    });
  }

  function handleInboxAction(
    testimonial: InboxTestimonial,
    action: InboxTestimonialAction,
  ) {
    switch (action) {
      case "delete":
        setDeleteTarget(testimonial);
        return;
      case "download":
        void downloadVideo(testimonial);
        return;
      case "spam":
      case "undo-spam":
        void changeSpamStatus(testimonial, action === "spam" ? "mark" : "undo");
        return;
      case "publish":
        void changeStatus(testimonial, "published");
        return;
      case "archive":
      case "unpublish":
        void changeStatus(testimonial, "archived");
        return;
      default: {
        const unhandledAction: never = action;
        throw new Error(`Unhandled Inbox action: ${unhandledAction}`);
      }
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="dashboard-page-title">Inbox</h1>
          <p className="dashboard-page-description mt-1 max-w-2xl">
            Review private Submissions and choose what becomes public.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/w/${organization.publicSlug}` as Route} target="_blank">
            Open Public Wall
            <ExternalLink aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <InboxFilters
        moderationStatus={moderationStatus}
        onModerationStatusChange={setModerationStatusFilter}
        onSortChange={setSort}
        onSubmissionTypeChange={setSubmissionType}
        sort={sort}
        submissionType={submissionType}
      />

      <InboxFeedback error={error} message={message} tone={messageTone} />

      <div aria-busy={pending} className={pending ? "opacity-70" : undefined}>
        <TestimonialInboxView
          accentColor={wallSettings?.accentColor}
          actionsDisabled={pending}
          onAction={handleInboxAction}
          testimonials={testimonials}
        />
      </div>

      <details className="bg-card rounded-xl border shadow-xs">
        <summary className="marker:text-muted-foreground cursor-pointer px-4 py-3 text-sm font-medium">
          Wall order &amp; visibility
        </summary>
        <div className="border-t p-4 sm:p-5">
          <PublishedCuration organizationId={activeOrganization.id} />
        </div>
      </details>

      <InboxLoadMore
        onLoadMore={() => loadMore(20)}
        paginationStatus={paginationStatus}
        pending={pending}
      />

      <TestimonialDeleteDialog
        onDelete={() => void confirmDelete()}
        onDownload={(testimonial) => void downloadVideo(testimonial)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        pending={pending}
        target={deleteTarget}
      />
    </>
  );
}
