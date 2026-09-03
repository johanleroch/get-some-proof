"use client";

import { useState } from "react";
import {
  Archive,
  Download,
  ExternalLink,
  Send,
  ShieldAlert,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OverviewPageSkeleton } from "@/components/ui/page-skeletons";
import { formatShortDate } from "@/lib/format-date";

type InboxTestimonialIdentity = {
  avatarUrl: string | null;
  company?: string;
  consentAcceptedAt: number;
  createdAt: number;
  moderationStatus: "pending" | "published" | "archived" | "spam";
  quarantineExpiresAt?: number;
  rating?: number;
  role?: string;
  submitterEmail: string;
  submitterName: string;
  spamCreditRestored?: boolean;
  testimonialId: Id<"testimonials"> | string;
};

type InboxTestimonial =
  | (InboxTestimonialIdentity & {
      submissionType: "text";
      text: string;
    })
  | (InboxTestimonialIdentity & {
      captionsStatus: "requested" | "ready" | "failed";
      durationSeconds?: number;
      playbackId?: string;
      submissionType: "video";
      videoStatus: "awaiting_upload" | "processing" | "ready" | "failed";
    });

type ModerationFilter = "all" | "pending" | "published" | "archived" | "spam";
type SubmissionTypeFilter = "all" | "text" | "video";
type InboxSort = "newest" | "oldest";

function videoStatusLabel(
  status: Extract<InboxTestimonial, { submissionType: "video" }>["videoStatus"],
) {
  return status === "awaiting_upload"
    ? "Awaiting upload"
    : `${status[0].toUpperCase()}${status.slice(1)}`;
}

export function TestimonialInboxView({
  actionsDisabled = false,
  onArchive,
  onDeleteRequest,
  onDownload,
  onPublish,
  onSpam,
  onUndoSpam,
  testimonials,
}: {
  actionsDisabled?: boolean;
  onArchive: (testimonial: InboxTestimonial) => void;
  onDeleteRequest: (testimonial: InboxTestimonial) => void;
  onDownload?: (testimonial: InboxTestimonial) => void;
  onPublish: (testimonial: InboxTestimonial) => void;
  onSpam?: (testimonial: InboxTestimonial) => void;
  onUndoSpam?: (testimonial: InboxTestimonial) => void;
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
    <div className="grid gap-4 xl:grid-cols-2">
      {testimonials.map((testimonial) => (
        <Card className="shadow-xs" key={testimonial.testimonialId}>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{testimonial.submitterName}</p>
                <p className="text-muted-foreground text-sm">
                  {testimonial.submitterEmail}
                </p>
              </div>
              <span className="bg-muted rounded-full px-2.5 py-1 text-xs font-medium capitalize">
                {testimonial.moderationStatus}
              </span>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="capitalize">{testimonial.submissionType}</span>
              <span>{formatShortDate(testimonial.createdAt)}</span>
              <span>Consent recorded</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {testimonial.submissionType === "text" ? (
              <blockquote className="bg-muted/30 rounded-xl border p-4 text-sm leading-6">
                “{testimonial.text}”
              </blockquote>
            ) : (
              <div className="flex items-start gap-4 rounded-xl border p-3">
                <div className="bg-muted relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-lg">
                  {testimonial.playbackId ? (
                    <Image
                      alt=""
                      className="object-cover"
                      fill
                      sizes="80px"
                      src={`https://image.mux.com/${encodeURIComponent(testimonial.playbackId)}/thumbnail.png?width=160&height=284&fit_mode=smartcrop&time=${testimonial.durationSeconds ? testimonial.durationSeconds / 2 : 0.5}`}
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5 pt-1 text-sm">
                  <p className="font-medium">
                    {videoStatusLabel(testimonial.videoStatus)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {testimonial.captionsStatus === "failed"
                      ? "Captions unavailable"
                      : testimonial.captionsStatus === "ready"
                        ? "Captions ready"
                        : "Captions requested"}
                  </p>
                  {testimonial.durationSeconds ? (
                    <p className="text-muted-foreground text-xs">
                      {Math.round(testimonial.durationSeconds)} seconds
                    </p>
                  ) : null}
                </div>
              </div>
            )}
            {testimonial.role || testimonial.company || testimonial.rating ? (
              <p className="text-muted-foreground text-sm">
                {[testimonial.role, testimonial.company]
                  .filter(Boolean)
                  .join(" · ")}
                {testimonial.rating ? ` · ${testimonial.rating}/5` : ""}
              </p>
            ) : null}
            {testimonial.moderationStatus === "spam" ? (
              <p className="text-muted-foreground rounded-xl border p-3 text-sm">
                Quarantined until{" "}
                {testimonial.quarantineExpiresAt
                  ? formatShortDate(testimonial.quarantineExpiresAt)
                  : "expiry"}
                .{" "}
                {testimonial.spamCreditRestored
                  ? "Collection capacity was restored."
                  : "Credit restoration requires support review."}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {testimonial.moderationStatus === "spam" && onUndoSpam ? (
                <Button
                  disabled={actionsDisabled}
                  onClick={() => onUndoSpam(testimonial)}
                  size="sm"
                >
                  <Undo2 aria-hidden="true" />
                  Undo Spam
                </Button>
              ) : null}
              {testimonial.moderationStatus !== "spam" &&
              testimonial.moderationStatus !== "published" ? (
                <Button
                  disabled={
                    actionsDisabled ||
                    (testimonial.submissionType === "video" &&
                      testimonial.videoStatus !== "ready")
                  }
                  onClick={() => onPublish(testimonial)}
                  size="sm"
                >
                  <Send aria-hidden="true" />
                  Publish
                </Button>
              ) : null}
              {testimonial.moderationStatus !== "spam" &&
              testimonial.moderationStatus !== "archived" ? (
                <Button
                  disabled={actionsDisabled}
                  onClick={() => onArchive(testimonial)}
                  size="sm"
                  variant="outline"
                >
                  <Archive aria-hidden="true" />
                  Archive
                </Button>
              ) : null}
              {testimonial.moderationStatus !== "spam" &&
              testimonial.submissionType === "video" &&
              testimonial.videoStatus === "ready" &&
              onDownload ? (
                <Button
                  disabled={actionsDisabled}
                  onClick={() => onDownload(testimonial)}
                  size="sm"
                  variant="outline"
                >
                  <Download aria-hidden="true" />
                  Download MP4 (Pro)
                </Button>
              ) : null}
              {testimonial.moderationStatus !== "spam" ? (
                <>
                  {onSpam ? (
                    <Button
                      disabled={actionsDisabled}
                      onClick={() => onSpam(testimonial)}
                      size="sm"
                      variant="outline"
                    >
                      <ShieldAlert aria-hidden="true" />
                      Mark as Spam
                    </Button>
                  ) : null}
                  <Button
                    disabled={actionsDisabled}
                    onClick={() => onDeleteRequest(testimonial)}
                    size="sm"
                    variant="outline"
                  >
                    <Trash2 aria-hidden="true" />
                    Delete permanently
                  </Button>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TestimonialDeleteDialog({
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
  return (
    <AlertDialog onOpenChange={onOpenChange} open={target !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete Testimonial?</AlertDialogTitle>
          <AlertDialogDescription>
            {target?.submissionType === "video"
              ? "This immediately removes the video from the Public Wall, then deletes its Mux source, renditions, captions, thumbnails, private record, consent, and email history. This cannot be undone."
              : "This immediately removes it from the Public Wall and deletes its private content, consent record, email history, and avatar. This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {target?.submissionType === "video" &&
          target.videoStatus === "ready" ? (
            <Button
              disabled={pending}
              onClick={() => onDownload(target)}
              variant="outline"
            >
              <Download aria-hidden="true" />
              Download MP4 (Pro)
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

function InboxFeedback({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {message ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className="text-destructive rounded-xl border p-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
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
  const markSpam = useMutation(api.testimonialModeration.markSpam);
  const undoSpam = useMutation(api.testimonialModeration.undoSpam);
  const removeText = useMutation(api.testimonialModeration.remove);
  const removeVideo = useAction(api.videoMedia.remove);
  const requestDownload = useAction(api.videoMedia.requestDownload);
  const [deleteTarget, setDeleteTarget] = useState<InboxTestimonial | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
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
      onSuccess: () =>
        setMessage(
          `${testimonial.submitterName}'s Testimonial is now ${nextStatus}.`,
        ),
      run: () =>
        setModerationStatus({
          organizationId: activeOrganization.id,
          status: nextStatus,
          testimonialId: testimonial.testimonialId as Id<"testimonials">,
        }),
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const args = {
      organizationId: activeOrganization.id,
      testimonialId: deleteTarget.testimonialId as Id<"testimonials">,
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
      onSuccess: () =>
        setMessage(
          action === "mark"
            ? "Testimonial moved to seven-day Spam quarantine."
            : "Spam report undone and collection capacity updated.",
        ),
      run: () =>
        (action === "mark" ? markSpam : undoSpam)({
          organizationId: activeOrganization.id,
          testimonialId: testimonial.testimonialId as Id<"testimonials">,
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
      onSuccess: () => setMessage("Your MP4 download is ready."),
      run: async () => {
        const result = await requestDownload({
          organizationId: activeOrganization.id,
          testimonialId: testimonial.testimonialId as Id<"testimonials">,
        });
        const link = document.createElement("a");
        link.href = result.url;
        link.rel = "noopener noreferrer";
        link.click();
      },
    });
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

      <InboxFeedback error={error} message={message} />

      <div aria-busy={pending} className={pending ? "opacity-70" : undefined}>
        <TestimonialInboxView
          actionsDisabled={pending}
          onArchive={(testimonial) =>
            void changeStatus(testimonial, "archived")
          }
          onDeleteRequest={setDeleteTarget}
          onDownload={(testimonial) => void downloadVideo(testimonial)}
          onPublish={(testimonial) =>
            void changeStatus(testimonial, "published")
          }
          onSpam={(testimonial) => void changeSpamStatus(testimonial, "mark")}
          onUndoSpam={(testimonial) =>
            void changeSpamStatus(testimonial, "undo")
          }
          testimonials={testimonials}
        />
      </div>

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
