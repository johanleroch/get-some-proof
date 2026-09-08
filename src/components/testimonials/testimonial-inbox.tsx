"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowBackUp,
  IconArrowDown,
  IconArrowUp,
  IconExternalLink,
  IconEyeOff,
  IconGripVertical,
  IconPlayerPlayFilled,
  IconSend,
  IconVideoOff,
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
import { VideoPreviewDialog } from "./video-preview-dialog";
import { VideoThumbnailDialog } from "./video-thumbnail-dialog";
import {
  WallDisplayDialog,
  type WallVisibility,
  type WallVisibilityOverrides,
} from "./wall-display-dialog";

import { api } from "@convex/_generated/api";
import { defaultPrimaryColor } from "@convex/domain/brand";
import type { Id } from "@convex/_generated/dataModel";
import type {
  TestimonialCardTextValue,
  TestimonialCardVideoValue,
} from "@convex/testimonialCardValue";
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
import { BlobLoader } from "@/components/brand/blob-loader";
import { SpeechBubbleStars } from "@/components/doodles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatShortDate } from "@/lib/format-date";
import { uploadProfileImage } from "@/lib/upload-profile-image";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import { cn } from "@/lib/utils";
import { OverviewPageSkeleton } from "@/components/ui/page-skeletons";
import type { TestimonialCardValue } from "@/components/testimonials/testimonial-card";
import { DesignQuote } from "@/components/testimonials/designs/design-parts";
import { videoAspect } from "@/components/testimonials/testimonial-card-markup";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/templates/template-primitives";
import {
  InboxTestimonialMenu,
  type InboxTestimonialAction,
} from "@/components/testimonials/inbox-testimonial-menu";

type InboxTestimonialIdentity = {
  card: TestimonialCardValue | null;
  consentAcceptedAt: number;
  createdAt: number;
  moderationStatus: "pending" | "published" | "archived" | "spam";
  publicVisibilityOverrides?: WallVisibilityOverrides;
  quarantineExpiresAt?: number;
  spamCreditRestored?: boolean;
  submitterEmail: string;
  submitterName: string;
  testimonialId: Id<"testimonials">;
};

export type InboxTestimonial =
  | (InboxTestimonialIdentity & {
      card: TestimonialCardTextValue;
      submissionType: "text";
    })
  | (InboxTestimonialIdentity & {
      aspectRatio?: string;
      captionsStatus: "requested" | "ready" | "failed";
      submissionType: "video";
      videoDurationSeconds?: number;
      videoStatus: "awaiting_upload" | "processing" | "ready" | "failed";
    });

type VideoInboxTestimonial = Extract<
  InboxTestimonial,
  { submissionType: "video" }
>;

/**
 * The four categories a Testimonial can be in, in CONTEXT.md's own nouns and
 * in the order an Owner meets them. Pending is first and is the default,
 * because it is the only one that is a queue. Published is the Public Wall
 * itself, in its Curated Order. The Video Asset's own states (Processing,
 * Ready, Failed) are a separate axis and never a category here.
 */
export const inboxCategories = [
  {
    empty: {
      description: "Nothing is waiting for your decision right now.",
      title: "Nothing Pending",
    },
    key: "pending",
    label: "Pending",
  },
  {
    empty: {
      description:
        "Publish a Pending Testimonial and it appears here, in the order visitors see it.",
      title: "Nothing on your Public Wall yet",
    },
    key: "published",
    label: "Published",
  },
  {
    empty: {
      description: "Testimonials you keep but hide from the public land here.",
      title: "Nothing Archived",
    },
    key: "archived",
    label: "Archived",
  },
  {
    empty: {
      description:
        "Testimonials you report as Spam wait here for seven days before they are deleted.",
      title: "No Spam quarantined",
    },
    key: "spam",
    label: "Spam",
  },
] as const;

export type InboxCategory = (typeof inboxCategories)[number]["key"];
export type InboxCounts = Record<InboxCategory, number>;

function categoryOf(key: InboxCategory) {
  return inboxCategories.find((category) => category.key === key)!;
}

/** The order the arrows and the drag handle write: who sits above and below. */
export type InboxMove = (
  testimonialId: Id<"testimonials">,
  beforeTestimonialId: Id<"testimonials"> | undefined,
  afterTestimonialId: Id<"testimonials"> | undefined,
) => Promise<unknown>;

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A small still for the list: the Owner's own thumbnail, or a frame. */
function stillUrl(card: TestimonialCardVideoValue) {
  if (card.posterUrl) return card.posterUrl;
  return `https://image.mux.com/${encodeURIComponent(card.playbackId)}/thumbnail.webp?width=192&time=${card.posterTimeSeconds ?? 0.5}`;
}

/**
 * The Video Asset's state while it is not yet Ready: a Badge in the status
 * vocabulary of DESIGN.md section 7 and one sentence. The sentence carries
 * the reason Publish is disabled, so the button needs no note of its own. A
 * Ready video says nothing here; its still and its duration speak for it.
 */
function videoState(testimonial: VideoInboxTestimonial) {
  switch (testimonial.videoStatus) {
    case "ready":
      return null;
    case "failed":
      return {
        badge: "danger" as const,
        label: "Failed",
        note: "The Submitter received a link to replace the video.",
      };
    case "processing":
      return {
        badge: "warning" as const,
        label: "Processing",
        note: "Publish once the video is Ready.",
      };
    case "awaiting_upload":
      return {
        badge: "neutral" as const,
        label: "Uploading",
        note: "Publish once the video is Ready.",
      };
  }
}

/**
 * The still keeps the video's own shape, never a landscape crop of a portrait
 * clip: 48px wide when the video is portrait (what a phone records for the
 * Collection Form, 9:16 by default), 64px wide when it is not. The same box
 * stands in while the Video Asset is processing or failed, so a row keeps
 * its shape the moment the video becomes Ready.
 */
function stillBox(aspectRatio?: string): CSSProperties {
  const [width, height] = videoAspect(aspectRatio);
  return {
    aspectRatio: `${width} / ${height}`,
    width: width < height ? 48 : 64,
  };
}

/**
 * The first thing in a row: the Customer's face when they sent one, the
 * display quote mark in the Brand accent otherwise (never initials), or the
 * video still that opens the playable card. A video that is not Ready shows
 * the blob looking around, or the failed state.
 */
function InboxFace({
  onPreview,
  testimonial,
}: {
  onPreview: () => void;
  testimonial: InboxTestimonial;
}) {
  if (testimonial.submissionType === "text") {
    return testimonial.card.avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="size-12 shrink-0 rounded-full object-cover"
        height={48}
        loading="lazy"
        src={testimonial.card.avatarUrl}
        width={48}
      />
    ) : (
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center"
      >
        <span className="font-display translate-y-[0.3em] text-[44px] leading-none font-bold text-(--wall-accent) select-none">
          &ldquo;
        </span>
      </span>
    );
  }
  if (testimonial.card?.type === "video") {
    return (
      <button
        aria-label={`Preview ${testimonial.submitterName}'s video`}
        className="group/still bg-ink focus-visible:ring-ring relative block shrink-0 cursor-pointer overflow-hidden rounded-md outline-none focus-visible:ring-[3px]"
        onClick={onPreview}
        style={stillBox(testimonial.aspectRatio)}
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="size-full object-cover transition-transform duration-[var(--motion-base)] ease-[var(--ease-settle-soft)] group-hover/still:scale-105 motion-reduce:transition-none"
          loading="lazy"
          src={stillUrl(testimonial.card)}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-black/25 text-white"
        >
          <IconPlayerPlayFilled className="size-4" />
        </span>
        {testimonial.videoDurationSeconds ? (
          <span
            aria-hidden="true"
            className="absolute right-1 bottom-1 rounded-sm bg-black/70 px-1 font-mono text-[11px] leading-4 text-white tabular-nums"
          >
            {formatDuration(testimonial.videoDurationSeconds)}
          </span>
        ) : null}
      </button>
    );
  }
  if (testimonial.videoStatus === "failed") {
    return (
      <span
        aria-hidden="true"
        className="bg-surface-2 text-danger grid shrink-0 place-items-center rounded-md"
        data-testid="failed-video-placeholder"
        style={stillBox(testimonial.aspectRatio)}
      >
        <IconVideoOff className="size-5" />
      </span>
    );
  }
  return (
    <span
      className="bg-surface-2 grid shrink-0 place-items-center rounded-md"
      data-testid="processing-video-placeholder"
      style={stillBox(testimonial.aspectRatio)}
    >
      <BlobLoader
        label={`${testimonial.submitterName}'s video is processing`}
        size={32}
      />
    </span>
  );
}

/** The words in full, with the marker swash on a highlighted phrase. */
function InboxWords({
  accentColor,
  testimonial,
}: {
  accentColor: string;
  testimonial: TestimonialCardTextValue;
}) {
  return (
    <>
      <DesignQuote
        accentColor={accentColor}
        className="type-body text-ink mt-1 max-w-prose"
        testimonial={testimonial}
      />
      {testimonial.images?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {testimonial.images.map((image, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`Image ${index + 1} from ${testimonial.name}`}
              className="size-14 rounded-md object-cover"
              height={56}
              key={image.id}
              loading="lazy"
              src={image.url}
              width={56}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

const rowButton = "h-10 md:h-9";
const rowIconButton = "size-10 md:size-9";

/**
 * One Testimonial as a row: the face, then who said it and what, then one
 * private line (when it arrived, and the email only the Owner sees), and on
 * the right the one decision the category allows. Everything else waits in
 * the menu. A Published row also carries its place on the Public Wall.
 */
function InboxRow({
  accentColor,
  busy,
  disabled,
  drag,
  onAction,
  onMove,
  position,
  testimonial,
}: {
  accentColor: string;
  busy: boolean;
  disabled: boolean;
  /** Pointer reordering, on Published rows only. */
  drag?: {
    onDrop: () => void;
    onEnd: () => void;
    onStart: () => void;
  };
  onAction: (action: InboxTestimonialAction) => void;
  /** Arrow reordering, on Published rows only. */
  onMove?: (direction: -1 | 1) => void;
  position?: { index: number; count: number };
  testimonial: InboxTestimonial;
}) {
  const isSpam = testimonial.moderationStatus === "spam";
  const ordering = Boolean(onMove && position);
  const videoReady =
    testimonial.submissionType !== "video" ||
    testimonial.videoStatus === "ready";
  const identity = testimonial.card
    ? [testimonial.card.role, testimonial.card.company]
        .filter(Boolean)
        .join(" · ")
    : "";
  const rating = testimonial.card?.rating;
  const video =
    testimonial.submissionType === "video" ? videoState(testimonial) : null;

  return (
    <li
      aria-busy={busy || undefined}
      className="hover:bg-surface-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-150 md:grid-cols-[auto_minmax(0,1fr)_auto] md:px-5"
      data-testid={`inbox-testimonial-${testimonial.testimonialId}`}
      draggable={ordering && !disabled ? true : undefined}
      onDragEnd={drag?.onEnd}
      onDragOver={drag ? (event) => event.preventDefault() : undefined}
      onDragStart={drag?.onStart}
      onDrop={drag?.onDrop}
    >
      {/*
        The face is a column of its own: centred on the row like the actions,
        and always 64px wide so the words start on the same line whatever
        stands in it (a 48px photo, the quote mark, a portrait still).
      */}
      <div className="flex items-center gap-2 md:gap-3">
        {ordering ? (
          <IconGripVertical
            aria-hidden="true"
            className="text-ink-3 hidden size-5 shrink-0 cursor-grab md:block"
          />
        ) : null}
        <div className="grid w-16 shrink-0 place-items-center">
          <InboxFace
            onPreview={() => onAction("preview")}
            testimonial={testimonial}
          />
        </div>
      </div>

      <div className="min-w-0 self-center">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="type-ui text-ink font-semibold">
            {testimonial.submitterName}
          </span>
          {identity ? (
            <span className="type-small text-ink-2 truncate">{identity}</span>
          ) : null}
          {rating ? (
            <Stars className="shrink-0" rating={rating} size={14} />
          ) : null}
        </div>

        {testimonial.submissionType === "text" ? (
          <InboxWords
            accentColor={accentColor}
            testimonial={testimonial.card}
          />
        ) : null}

        {video ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={video.badge}>{video.label}</Badge>
            <span className="type-small text-ink-2">{video.note}</span>
          </p>
        ) : null}

        <p className="type-small text-ink-2 mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>Received {formatShortDate(testimonial.createdAt)}</span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="w-full truncate sm:w-auto">
            {testimonial.submitterEmail}
          </span>
          {isSpam && testimonial.quarantineExpiresAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-danger">
                Deleted on {formatShortDate(testimonial.quarantineExpiresAt)}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:justify-end md:self-center">
        {ordering && onMove && position ? (
          <>
            <Button
              aria-label={`Move ${testimonial.submitterName} up`}
              className={rowIconButton}
              disabled={disabled || position.index === 0}
              onClick={() => onMove(-1)}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <IconArrowUp aria-hidden="true" />
            </Button>
            <Button
              aria-label={`Move ${testimonial.submitterName} down`}
              className={rowIconButton}
              disabled={disabled || position.index === position.count - 1}
              onClick={() => onMove(1)}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <IconArrowDown aria-hidden="true" />
            </Button>
          </>
        ) : null}

        {isSpam ? (
          <Button
            className={rowButton}
            disabled={disabled}
            loading={busy}
            onClick={() => onAction("undo-spam")}
            size="sm"
            type="button"
          >
            <IconArrowBackUp aria-hidden="true" />
            Not Spam
          </Button>
        ) : testimonial.moderationStatus === "published" ? (
          <Button
            className={rowButton}
            disabled={disabled}
            loading={busy}
            onClick={() => onAction("unpublish")}
            size="sm"
            type="button"
            variant="outline"
          >
            <IconEyeOff aria-hidden="true" />
            Unpublish
          </Button>
        ) : (
          <>
            <Button
              className={rowButton}
              disabled={disabled || !videoReady}
              loading={busy}
              onClick={() => onAction("publish")}
              size="sm"
              type="button"
            >
              <IconSend aria-hidden="true" />
              Publish
            </Button>
            {testimonial.moderationStatus === "pending" ? (
              <Button
                className={rowButton}
                disabled={disabled}
                onClick={() => onAction("archive")}
                size="sm"
                type="button"
                variant="outline"
              >
                <IconArchive aria-hidden="true" />
                Archive
              </Button>
            ) : null}
          </>
        )}

        <InboxTestimonialMenu
          className={cn(rowIconButton, "ml-auto md:ml-0")}
          disabled={disabled}
          onAction={onAction}
          testimonial={testimonial}
        />
      </div>
    </li>
  );
}

/**
 * The list for one category: rows with dividers in a single panel, never a
 * wall of cards. The Wall is where cards are judged; the Inbox is where
 * decisions are made. In Published the rows are the Public Wall in its
 * Curated Order and can be moved.
 */
export function TestimonialInboxView({
  accentColor = defaultPrimaryColor,
  actionsDisabled = false,
  category,
  emptyAction,
  footer,
  onAction,
  onMove,
  pendingId,
  testimonials,
}: {
  accentColor?: string;
  actionsDisabled?: boolean;
  category: InboxCategory;
  emptyAction?: ReactNode;
  /** Rendered inside the panel after the rows: the Load more control. */
  footer?: ReactNode;
  onAction: (
    testimonial: InboxTestimonial,
    action: InboxTestimonialAction,
  ) => void;
  /** Present in Published, where the list is the Public Wall's order. */
  onMove?: InboxMove;
  pendingId: Id<"testimonials"> | null;
  testimonials: InboxTestimonial[];
}) {
  const draggedId = useRef<string | undefined>(undefined);
  const ordering = category === "published" && onMove !== undefined;

  function move(from: number, to: number) {
    if (!onMove || to < 0 || to >= testimonials.length || from === to) return;
    const ids = testimonials.map(({ testimonialId }) => testimonialId);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    void onMove(moved!, ids[to - 1], ids[to + 1]);
  }

  if (testimonials.length === 0) {
    return (
      <section className="bg-surface border-line rounded-lg border">
        <EmptyState
          action={emptyAction}
          description={categoryOf(category).empty.description}
          illustration={<SpeechBubbleStars className="h-28" />}
          title={categoryOf(category).empty.title}
        />
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {ordering ? (
        <p className="type-small text-ink-2">
          Visitors see your Public Wall in this order. Drag a row, or use the
          arrows.
        </p>
      ) : null}
      <section
        className="bg-surface border-line overflow-hidden rounded-lg border"
        style={{ "--wall-accent": accentColor } as CSSProperties}
      >
        <ol className="divide-line divide-y">
          {testimonials.map((testimonial, index) => (
            <InboxRow
              accentColor={accentColor}
              busy={pendingId === testimonial.testimonialId}
              disabled={actionsDisabled}
              drag={
                ordering
                  ? {
                      onDrop: () => {
                        const from = testimonials.findIndex(
                          ({ testimonialId }) =>
                            String(testimonialId) === draggedId.current,
                        );
                        if (from >= 0) move(from, index);
                        draggedId.current = undefined;
                      },
                      onEnd: () => {
                        draggedId.current = undefined;
                      },
                      onStart: () => {
                        draggedId.current = String(testimonial.testimonialId);
                      },
                    }
                  : undefined
              }
              key={testimonial.testimonialId}
              onAction={(action) => onAction(testimonial, action)}
              onMove={
                ordering
                  ? (direction) => move(index, index + direction)
                  : undefined
              }
              position={
                ordering ? { count: testimonials.length, index } : undefined
              }
              testimonial={testimonial}
            />
          ))}
        </ol>
        {footer}
      </section>
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
 * The four categories as tabs, each with how many Testimonials wait in it.
 * A category is where you are, not a filter you set; nothing else cuts
 * across them, so the tabs are the whole navigation of the page.
 */
export function InboxCategoryTabs({
  children,
  counts,
  moderationStatus,
  onModerationStatusChange,
}: {
  /** The category's own panel: only the open one is rendered. */
  children: ReactNode;
  counts?: InboxCounts;
  moderationStatus: InboxCategory;
  onModerationStatusChange: (value: InboxCategory) => void;
}) {
  return (
    <Tabs
      className="gap-6"
      onValueChange={(value) =>
        onModerationStatusChange(value as InboxCategory)
      }
      value={moderationStatus}
    >
      <TabsList aria-label="Testimonial categories">
        {inboxCategories.map((category) => {
          const count = counts?.[category.key] ?? 0;
          return (
            <TabsTrigger key={category.key} value={category.key}>
              {category.label}{" "}
              {count > 0 ? (
                <span className="text-ink-3 [[data-state=active]_&]:text-ink-2 font-medium tabular-nums">
                  {count}
                </span>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent className="space-y-6" value={moderationStatus}>
        {children}
      </TabsContent>
    </Tabs>
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
    <div className="border-line border-t p-2">
      <Button
        className="w-full"
        disabled={pending}
        loading={paginationStatus === "LoadingMore"}
        onClick={onLoadMore}
        type="button"
        variant="ghost"
      >
        Load more Testimonials
      </Button>
    </div>
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
    useState<InboxCategory>("pending");
  const counts = useQuery(
    api.testimonialModeration.countInbox,
    organization ? { organizationId: organization.id } : "skip",
  );
  const {
    loadMore,
    results: testimonials,
    status: paginationStatus,
  } = usePaginatedQuery(
    api.testimonialModeration.listInbox,
    organization
      ? {
          organizationId: organization.id,
          sort: moderationStatus === "published" ? "wall" : "newest",
          status: moderationStatus,
        }
      : "skip",
    { initialNumItems: 20 },
  );
  const setModerationStatus = useMutation(api.testimonialModeration.setStatus);
  const saveHighlights = useMutation(api.testimonialModeration.setHighlights);
  const [highlightTarget, setHighlightTarget] =
    useState<InboxTestimonial | null>(null);
  const savePoster = useMutation(api.testimonialModeration.setPoster);
  const generatePosterUploadUrl = useMutation(
    api.testimonialModeration.generatePosterUploadUrl,
  );
  const [thumbnailTarget, setThumbnailTarget] =
    useState<InboxTestimonial | null>(null);
  const [previewTarget, setPreviewTarget] = useState<InboxTestimonial | null>(
    null,
  );
  const wallSettings = useQuery(
    api.wallCustomization.getSettings,
    organization ? { organizationId: organization.id } : "skip",
  );
  const movePublished = useMutation(api.wallCustomization.movePublished);
  const setVisibility = useMutation(
    api.wallCustomization.setTestimonialVisibility,
  );
  const [wallDisplayTarget, setWallDisplayTarget] =
    useState<InboxTestimonial | null>(null);
  const markSpam = useMutation(api.testimonialModeration.markSpam);
  const undoSpam = useMutation(api.testimonialModeration.undoSpam);
  const removeText = useMutation(api.testimonialModeration.remove);
  const removeVideo = useAction(api.videoMedia.remove);
  const [deleteTarget, setDeleteTarget] = useState<InboxTestimonial | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One Testimonial at a time, so the list never dims as a whole and the
  // Owner can see which record is being acted on.
  const [pendingId, setPendingId] = useState<Id<"testimonials"> | null>(null);

  if (organization === undefined || paginationStatus === "LoadingFirstPage") {
    return <OverviewPageSkeleton />;
  }
  if (organization === null) {
    return <p className="text-muted-foreground text-sm">Brand unavailable.</p>;
  }
  const activeOrganization = organization;
  const wallVisibility: WallVisibility | undefined = wallSettings?.visibility;

  function startAction(testimonialId: Id<"testimonials">) {
    setPendingId(testimonialId);
    setError(null);
    setMessage(null);
  }

  async function changeStatus(
    testimonial: InboxTestimonial,
    nextStatus: "published" | "archived",
  ) {
    await runInboxAction({
      onError: setError,
      onFinish: () => setPendingId(null),
      onStart: () => startAction(testimonial.testimonialId),
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
      onStart: () => startAction(deleteTarget.testimonialId),
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
      onStart: () => startAction(testimonial.testimonialId),
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

  async function moveOnWall(
    testimonialId: Id<"testimonials">,
    beforeTestimonialId: Id<"testimonials"> | undefined,
    afterTestimonialId: Id<"testimonials"> | undefined,
  ) {
    await runInboxAction({
      onError: setError,
      onFinish: () => setPendingId(null),
      onStart: () => startAction(testimonialId),
      onSuccess: () => setMessage("Public Wall order saved."),
      run: () =>
        movePublished({
          afterTestimonialId,
          beforeTestimonialId,
          organizationId: activeOrganization.id,
          testimonialId,
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
      case "thumbnail":
        setThumbnailTarget(testimonial);
        return;
      case "preview":
        setPreviewTarget(testimonial);
        return;
      case "wall-display":
        setWallDisplayTarget(testimonial);
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
        counts={counts}
        moderationStatus={moderationStatus}
        onModerationStatusChange={setModerationStatusFilter}
      >
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
          footer={
            <InboxLoadMore
              onLoadMore={() => loadMore(20)}
              paginationStatus={paginationStatus}
              pending={pendingId !== null}
            />
          }
          onAction={handleInboxAction}
          onMove={moderationStatus === "published" ? moveOnWall : undefined}
          pendingId={pendingId}
          testimonials={testimonials}
        />
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

      {thumbnailTarget?.submissionType === "video" &&
      thumbnailTarget.card?.type === "video" ? (
        <VideoThumbnailDialog
          accentColor={wallSettings?.accentColor}
          durationSeconds={thumbnailTarget.videoDurationSeconds}
          isPublished={thumbnailTarget.moderationStatus === "published"}
          key={thumbnailTarget.testimonialId}
          onClose={() => setThumbnailTarget(null)}
          onSave={async (choice) => {
            const target = {
              organizationId: activeOrganization.id,
              testimonialId: thumbnailTarget.testimonialId,
            };
            if (choice.kind === "image") {
              const uploadUrl = await generatePosterUploadUrl(target);
              const storageId = await uploadProfileImage(
                choice.file,
                uploadUrl,
              );
              await savePoster({
                ...target,
                poster: { kind: "image", storageId },
              });
            } else {
              await savePoster({
                ...target,
                poster: { kind: "frame", timeSeconds: choice.timeSeconds },
              });
            }
            setError(null);
            setMessage(
              thumbnailTarget.moderationStatus === "published"
                ? `${thumbnailTarget.submitterName}'s new thumbnail is live on your Public Wall.`
                : `${thumbnailTarget.submitterName}'s video has a new thumbnail.`,
            );
          }}
          submitterName={thumbnailTarget.submitterName}
          testimonial={thumbnailTarget.card}
        />
      ) : null}

      {previewTarget?.card?.type === "video" ? (
        <VideoPreviewDialog
          accentColor={wallSettings?.accentColor}
          key={previewTarget.testimonialId}
          onClose={() => setPreviewTarget(null)}
          submitterName={previewTarget.submitterName}
          testimonial={previewTarget.card}
        />
      ) : null}

      {wallDisplayTarget?.card ? (
        <WallDisplayDialog
          accentColor={wallSettings?.accentColor}
          key={wallDisplayTarget.testimonialId}
          onClose={() => setWallDisplayTarget(null)}
          onSave={async (overrides) => {
            await setVisibility({
              organizationId: activeOrganization.id,
              overrides,
              testimonialId: wallDisplayTarget.testimonialId,
            });
            setError(null);
            setMessage(
              `What ${wallDisplayTarget.submitterName}'s card shows is live on your Public Wall.`,
            );
          }}
          overrides={wallDisplayTarget.publicVisibilityOverrides}
          submitterName={wallDisplayTarget.submitterName}
          testimonial={wallDisplayTarget.card}
          wallVisibility={wallVisibility}
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
