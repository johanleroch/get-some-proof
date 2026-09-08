"use client";

import { AnimatedBlob } from "@/components/brand/animated-blob";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowBackUp,
  IconExternalLink,
  IconEyeOff,
  IconHighlight,
  IconSend,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";

import { HighlightTestimonialDialog } from "./highlight-testimonial-dialog";

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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatShortDate } from "@/lib/format-date";
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

/**
 * The four categories a Testimonial can be in, in CONTEXT.md's own nouns and
 * in the order an Owner meets them. Pending is first and is the default,
 * because it is the only one that is a queue. The Video Asset's own states
 * (Processing, Ready, Failed) are a separate axis and never a category here.
 */
const inboxCategories = [
  {
    badge: "warning",
    empty: {
      description: "Nothing is waiting for your decision right now.",
      title: "Nothing Pending",
    },
    key: "pending",
    label: "Pending",
  },
  {
    badge: "success",
    empty: {
      description: "Publish a Pending Testimonial and it appears here.",
      title: "Nothing on your Public Wall yet",
    },
    key: "published",
    label: "Published",
  },
  {
    badge: "neutral",
    empty: {
      description: "Testimonials you keep but hide from the public land here.",
      title: "Nothing Archived",
    },
    key: "archived",
    label: "Archived",
  },
  {
    badge: "danger",
    empty: {
      description:
        "Testimonials you report as Spam wait here for seven days before they are deleted.",
      title: "No Spam quarantined",
    },
    key: "spam",
    label: "Spam quarantine",
  },
] as const;

type ModerationFilter = (typeof inboxCategories)[number]["key"];
type SubmissionTypeFilter = "all" | "text" | "video";

function categoryOf(key: ModerationFilter) {
  return inboxCategories.find((category) => category.key === key)!;
}

type InboxSort = "newest" | "oldest";

function videoStatusLabel(
  status: Extract<InboxTestimonial, { submissionType: "video" }>["videoStatus"],
) {
  return status === "awaiting_upload"
    ? "Processing"
    : `${status[0].toUpperCase()}${status.slice(1)}`;
}

function VideoAssetPlaceholder({
  status,
  testimonial,
}: {
  status: ReactNode;
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
        <div className="absolute top-3 left-3">{status}</div>
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
      <div className="absolute top-3 left-3">{status}</div>
      <div className="max-w-64">
        <AnimatedBlob size={64} variant="look" />
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

/**
 * One Testimonial in the Inbox, in three registers that must not be confused:
 * the private meta row above (facts only the Owner sees), the card itself
 * (the exact markup the Public Wall and the embed use, carrying only its
 * moderation Badge), and the action row below (the work).
 */
function InboxTestimonialCard({
  accentColor,
  busy,
  disabled,
  onAction,
  testimonial,
}: {
  accentColor: string;
  busy: boolean;
  disabled: boolean;
  onAction: (action: InboxTestimonialAction) => void;
  testimonial: InboxTestimonial;
}) {
  const category = categoryOf(testimonial.moderationStatus);
  const isSpam = testimonial.moderationStatus === "spam";
  const videoReady =
    testimonial.submissionType !== "video" ||
    testimonial.videoStatus === "ready";
  const menu = (
    <InboxTestimonialMenu
      disabled={disabled}
      onAction={onAction}
      testimonial={testimonial}
    />
  );
  const status = (
    <Badge dot variant={category.badge}>
      {category.label === "Spam quarantine" ? "Spam" : category.label}
    </Badge>
  );

  return (
    <article
      aria-busy={busy || undefined}
      className="mb-4 break-inside-avoid"
      data-testid={`inbox-testimonial-${testimonial.testimonialId}`}
    >
      <div className="text-ink-2 type-small flex flex-wrap items-center gap-x-2 gap-y-1 px-1 pb-2">
        <span>{formatShortDate(testimonial.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate font-mono text-[12px]">
          {testimonial.submitterEmail}
        </span>
      </div>

      {testimonial.card ? (
        <TestimonialCard
          accentColor={accentColor}
          status={status}
          testimonial={testimonial.card}
        />
      ) : testimonial.submissionType === "video" ? (
        <VideoAssetPlaceholder status={status} testimonial={testimonial} />
      ) : null}

      {isSpam && testimonial.quarantineExpiresAt ? (
        <p className="text-ink-2 type-small px-1 pb-2">
          Content is deleted on{" "}
          {formatShortDate(testimonial.quarantineExpiresAt)}.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 px-1">
        {isSpam ? (
          <Button
            disabled={disabled}
            loading={busy}
            onClick={() => onAction("undo-spam")}
            size="sm"
          >
            <IconArrowBackUp aria-hidden="true" />
            Not Spam
          </Button>
        ) : testimonial.moderationStatus === "published" ? (
          <Button
            disabled={disabled}
            loading={busy}
            onClick={() => onAction("unpublish")}
            size="sm"
            variant="outline"
          >
            <IconEyeOff aria-hidden="true" />
            Unpublish
          </Button>
        ) : (
          <>
            <Button
              disabled={disabled || !videoReady}
              loading={busy}
              onClick={() => onAction("publish")}
              size="sm"
            >
              <IconSend aria-hidden="true" />
              Publish
            </Button>
            {testimonial.moderationStatus === "pending" ? (
              <Button
                disabled={disabled}
                onClick={() => onAction("archive")}
                size="sm"
                variant="outline"
              >
                <IconArchive aria-hidden="true" />
                Archive
              </Button>
            ) : null}
          </>
        )}

        {!isSpam && testimonial.submissionType === "text" ? (
          <Button
            disabled={disabled}
            onClick={() => onAction("highlight")}
            size="sm"
            variant="ghost"
          >
            <IconHighlight aria-hidden="true" />
            Highlight a phrase
          </Button>
        ) : null}

        <span className="ml-auto">{menu}</span>
      </div>

      {!videoReady && !isSpam ? (
        <p className="text-ink-2 type-small px-1 pt-1.5">
          Only a Ready video can be Published.
        </p>
      ) : null}
    </article>
  );
}

export function TestimonialInboxView({
  accentColor = defaultPrimaryColor,
  actionsDisabled = false,
  category,
  emptyAction,
  filtered,
  onAction,
  pendingId,
  testimonials,
}: {
  accentColor?: string;
  actionsDisabled?: boolean;
  category: ModerationFilter;
  emptyAction?: ReactNode;
  /** True when a Type filter is narrowing the category. */
  filtered?: boolean;
  onAction: (
    testimonial: InboxTestimonial,
    action: InboxTestimonialAction,
  ) => void;
  pendingId: Id<"testimonials"> | null;
  testimonials: InboxTestimonial[];
}) {
  if (testimonials.length === 0) {
    const empty = filtered
      ? {
          description:
            "No Testimonial in this category matches the type you chose.",
          title: "Nothing here right now",
        }
      : categoryOf(category).empty;
    return (
      <section className="bg-card rounded-lg border">
        <EmptyState
          action={emptyAction}
          description={empty.description}
          illustration={<SpeechBubbleStars className="h-28" />}
          title={empty.title}
        />
      </section>
    );
  }

  return (
    <div className="columns-1 gap-4 lg:columns-2 xl:columns-3">
      {testimonials.map((testimonial) => (
        <InboxTestimonialCard
          accentColor={accentColor}
          busy={pendingId === testimonial.testimonialId}
          disabled={actionsDisabled}
          key={testimonial.testimonialId}
          onAction={(action) => onAction(testimonial, action)}
          testimonial={testimonial}
        />
      ))}
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

/**
 * The four categories as tabs, then the two controls that cut across all of
 * them. Status is no longer a select: a category is where you are, not a
 * filter you set.
 */
export function InboxCategoryTabs({
  children,
  filters,
  moderationStatus,
  onModerationStatusChange,
}: {
  /** The category's own panel: only the open one is rendered. */
  children: ReactNode;
  /** Type and Sort, which cut across every category. */
  filters?: ReactNode;
  moderationStatus: ModerationFilter;
  onModerationStatusChange: (value: ModerationFilter) => void;
}) {
  return (
    <Tabs
      className="gap-6"
      onValueChange={(value) =>
        onModerationStatusChange(value as ModerationFilter)
      }
      value={moderationStatus}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <TabsList aria-label="Testimonial categories">
          {inboxCategories.map((category) => (
            <TabsTrigger key={category.key} value={category.key}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {filters}
      </div>
      <TabsContent className="space-y-6" value={moderationStatus}>
        {children}
      </TabsContent>
    </Tabs>
  );
}

export function InboxFilters({
  onSortChange,
  onSubmissionTypeChange,
  sort,
  submissionType,
}: {
  onSortChange: (value: InboxSort) => void;
  onSubmissionTypeChange: (value: SubmissionTypeFilter) => void;
  sort: InboxSort;
  submissionType: SubmissionTypeFilter;
}) {
  return (
    <div className="flex flex-wrap gap-3" aria-label="Inbox filters">
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

export function TestimonialInbox({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const [moderationStatus, setModerationStatusFilter] =
    useState<ModerationFilter>("pending");
  const [publishedView, setPublishedView] = useState<"cards" | "order">(
    "cards",
  );
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
          status: moderationStatus,
          submissionType: submissionType === "all" ? undefined : submissionType,
        }
      : "skip",
    { initialNumItems: 20 },
  );
  const setModerationStatus = useMutation(api.testimonialModeration.setStatus);
  const saveHighlights = useMutation(api.testimonialModeration.setHighlights);
  const [highlightTarget, setHighlightTarget] =
    useState<InboxTestimonial | null>(null);
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
  // One Testimonial at a time, so the grid never dims as a whole and the
  // Owner can see which record is being acted on.
  const [pendingId, setPendingId] = useState<Id<"testimonials"> | null>(null);

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
      onFinish: () => setPendingId(null),
      onStart: () => {
        setPendingId(testimonial.testimonialId);
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
      onFinish: () => setPendingId(null),
      onStart: () => {
        setPendingId(deleteTarget.testimonialId);
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
      onFinish: () => setPendingId(null),
      onStart: () => {
        setPendingId(testimonial.testimonialId);
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
      case "highlight":
        setHighlightTarget(testimonial);
        return;
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

      <InboxFeedback error={error} message={message} />

      <InboxCategoryTabs
        filters={
          <InboxFilters
            onSortChange={setSort}
            onSubmissionTypeChange={setSubmissionType}
            sort={sort}
            submissionType={submissionType}
          />
        }
        moderationStatus={moderationStatus}
        onModerationStatusChange={(next) => {
          setModerationStatusFilter(next);
          setPublishedView("cards");
        }}
      >
        {moderationStatus === "published" ? (
          <div
            aria-label="Published view"
            className="bg-surface-2 inline-flex h-11 items-center gap-1 rounded-md p-1"
            role="group"
          >
            {(
              [
                { key: "cards", label: "Cards" },
                { key: "order", label: "Wall order" },
              ] as const
            ).map((view) => (
              <button
                aria-pressed={publishedView === view.key}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center rounded-sm border px-3 text-sm font-semibold tracking-[-0.008em] transition-[background-color,border-color,color] duration-150 outline-none focus-visible:ring-[3px]",
                  publishedView === view.key
                    ? "bg-surface border-line text-ink"
                    : "text-ink-2 hover:text-ink border-transparent",
                )}
                key={view.key}
                onClick={() => setPublishedView(view.key)}
                type="button"
              >
                {view.label}
              </button>
            ))}
          </div>
        ) : null}

        {moderationStatus === "published" && publishedView === "order" ? (
          <PublishedCuration organizationId={activeOrganization.id} />
        ) : (
          <>
            <TestimonialInboxView
              accentColor={wallSettings?.accentColor}
              actionsDisabled={pendingId !== null}
              category={moderationStatus}
              emptyAction={
                moderationStatus === "pending" ? null : (
                  <Button
                    onClick={() => setModerationStatusFilter("pending")}
                    variant="outline"
                  >
                    Go to Pending
                  </Button>
                )
              }
              filtered={submissionType !== "all"}
              onAction={handleInboxAction}
              pendingId={pendingId}
              testimonials={testimonials}
            />

            <InboxLoadMore
              onLoadMore={() => loadMore(20)}
              paginationStatus={paginationStatus}
              pending={pendingId !== null}
            />
          </>
        )}
      </InboxCategoryTabs>

      {highlightTarget?.card?.type === "text" ? (
        <HighlightTestimonialDialog
          accentColor={wallSettings?.accentColor}
          isPublished={highlightTarget.moderationStatus === "published"}
          key={highlightTarget.testimonialId}
          onClose={() => setHighlightTarget(null)}
          onSave={async (richText) => {
            await saveHighlights({
              organizationId: activeOrganization.id,
              richText,
              testimonialId: highlightTarget.testimonialId,
            });
            setError(null);
            setMessage(
              highlightTarget.moderationStatus === "published"
                ? `${highlightTarget.submitterName}'s highlighted phrase is live on your Public Wall.`
                : `${highlightTarget.submitterName}'s Testimonial now has a highlighted phrase.`,
            );
          }}
          submitterName={highlightTarget.submitterName}
          testimonial={highlightTarget.card}
        />
      ) : null}
      <TestimonialDeleteDialog
        onDelete={() => void confirmDelete()}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        pending={pendingId !== null}
        target={deleteTarget}
      />
    </>
  );
}
