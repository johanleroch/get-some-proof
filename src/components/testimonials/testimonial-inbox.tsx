"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconExternalLink,
  IconLoader2,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";

import { api } from "@convex/_generated/api";
import { defaultPrimaryColor } from "@convex/domain/brand";
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
import { SpeechBubbleStars } from "@/components/doodles";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OverviewPageSkeleton } from "@/components/ui/page-skeletons";
import { PublishedCuration } from "@/components/testimonials/published-curation";
import {
  TestimonialCard,
  type TestimonialCardValue,
} from "@/components/testimonials/testimonial-card";
import { videoAspectRatioStyle } from "@/components/testimonials/testimonial-card-markup";
import {
  InboxTestimonialMenu,
  type InboxTestimonialAction,
} from "@/components/testimonials/inbox-testimonial-menu";

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
      aspectRatio?: string;
      captionsStatus: "requested" | "ready" | "failed";
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
    ? "Processing"
    : `${status[0].toUpperCase()}${status.slice(1)}`;
}

function VideoAssetPlaceholder({
  menu,
  testimonial,
}: {
  menu: ReactNode;
  testimonial: Extract<InboxTestimonial, { submissionType: "video" }>;
}) {
  if (
    testimonial.videoStatus !== "awaiting_upload" &&
    testimonial.videoStatus !== "processing"
  ) {
    return (
      <section
        className="bg-card relative mb-5 grid min-h-64 break-inside-avoid place-items-center overflow-hidden rounded-lg border px-6 py-10 text-center"
        data-testid={`${testimonial.videoStatus}-video-placeholder`}
      >
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
    );
  }
  return (
    <section
      className="bg-ink text-paper border-ink relative mb-5 grid w-full break-inside-avoid place-items-center overflow-hidden rounded-lg border px-6 py-10 text-center"
      data-testid="processing-video-placeholder"
      data-video-aspect-ratio={testimonial.aspectRatio ?? "9:16"}
      style={{ aspectRatio: videoAspectRatioStyle(testimonial.aspectRatio) }}
    >
      <div className="absolute top-3 right-3">{menu}</div>
      <div className="max-w-64">
        <IconLoader2
          aria-hidden="true"
          className="mx-auto size-8 animate-spin motion-reduce:animate-none"
        />
        <p className="mt-4 font-medium">
          {videoStatusLabel(testimonial.videoStatus)}
        </p>
        <p className="text-paper/70 mt-1 text-sm leading-6">
          This video was just submitted. Playback will be available shortly.
        </p>
      </div>
    </section>
  );
}

export function TestimonialInboxView({
  accentColor = defaultPrimaryColor,
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
      <section className="bg-card rounded-lg border">
        <EmptyState
          description="New Submissions appear here as Pending before anything becomes public."
          illustration={<SpeechBubbleStars className="h-28" draw />}
          title="No Testimonials match these filters."
        />
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
              <VideoAssetPlaceholder menu={menu} testimonial={testimonial} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function TestimonialDeleteDialog({
  onDelete,
  onOpenChange,
  pending,
  target,
}: {
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  target: InboxTestimonial | null;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={target !== null}>
      <AlertDialogContent className="max-w-lg">
        <div className="flex items-start gap-4">
          <div className="bg-danger-soft text-danger flex size-10 shrink-0 items-center justify-center rounded-full">
            <IconAlertTriangle aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {target
                  ? `Delete ${target.submitterName}'s testimonial?`
                  : "Delete testimonial"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base leading-relaxed">
                Are you sure you want to delete this testimonial? This action is
                permanent.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel asChild>
                <Button disabled={pending} variant="outline">
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  loading={pending}
                  onClick={onDelete}
                  variant="destructive"
                >
                  Delete
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function InboxFilters({
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
      <Field className="w-44">
        <Label htmlFor="inbox-status">Status</Label>
        <Select
          onValueChange={(value) =>
            onModerationStatusChange(value as ModerationFilter)
          }
          value={moderationStatus}
        >
          <SelectTrigger className="w-full" id="inbox-status" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="spam">Spam quarantine</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-36">
        <Label htmlFor="inbox-type">Type</Label>
        <Select
          onValueChange={(value) =>
            onSubmissionTypeChange(value as SubmissionTypeFilter)
          }
          value={submissionType}
        >
          <SelectTrigger className="w-full" id="inbox-type" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-40">
        <Label htmlFor="inbox-sort">Sort</Label>
        <Select
          onValueChange={(value) => onSortChange(value as InboxSort)}
          value={sort}
        >
          <SelectTrigger className="w-full" id="inbox-sort" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export function InboxFeedback({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {message ? <SuccessToast message={message} /> : null}
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
      disabled={pending}
      loading={paginationStatus === "LoadingMore"}
      onClick={onLoadMore}
      type="button"
      variant="outline"
    >
      Load more Testimonials
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

/** Collapsible "Wall order & visibility" panel under the Inbox list. */
export function WallCurationPanel({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-card rounded-lg border">
      <button
        aria-controls="wall-curation"
        aria-expanded={open}
        className="hover:bg-accent flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-5 py-4 text-left transition-colors"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>
          <span className="type-subheading block">
            Wall order &amp; visibility
          </span>
          <span className="text-ink-2 type-small block">
            Reorder Published Testimonials and choose what each one shows.
          </span>
        </span>
        <IconChevronDown
          aria-hidden="true"
          className={cn(
            "text-ink-2 size-5 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="border-t p-5" id="wall-curation">
          {children}
        </div>
      ) : null}
    </section>
  );
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
      onSuccess: () => {
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

  function handleInboxAction(
    testimonial: InboxTestimonial,
    action: InboxTestimonialAction,
  ) {
    switch (action) {
      case "delete":
        setDeleteTarget(testimonial);
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
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link
              href={`/w/${organization.publicSlug}` as Route}
              target="_blank"
            >
              Open Public Wall
              <IconExternalLink aria-hidden="true" />
            </Link>
          </Button>
        }
        description="Review private Submissions and choose what becomes public."
        eyebrow="Workspace"
        title="Inbox"
      />

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
          accentColor={wallSettings?.accentColor}
          actionsDisabled={pending}
          onAction={handleInboxAction}
          testimonials={testimonials}
        />
      </div>

      <WallCurationPanel>
        <PublishedCuration organizationId={activeOrganization.id} />
      </WallCurationPanel>

      <InboxLoadMore
        onLoadMore={() => loadMore(20)}
        paginationStatus={paginationStatus}
        pending={pending}
      />

      <TestimonialDeleteDialog
        onDelete={() => void confirmDelete()}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        pending={pending}
        target={deleteTarget}
      />
    </>
  );
}
