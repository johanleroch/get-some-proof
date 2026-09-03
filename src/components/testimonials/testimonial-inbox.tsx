"use client";

import { useState } from "react";
import { Archive, ExternalLink, Send, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";

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

type InboxTestimonial = {
  avatarUrl: string | null;
  company?: string;
  consentAcceptedAt: number;
  createdAt: number;
  moderationStatus: "pending" | "published" | "archived";
  rating?: number;
  role?: string;
  submissionType: "text";
  submitterEmail: string;
  submitterName: string;
  testimonialId: Id<"testimonials"> | string;
  text: string;
};

export function TestimonialInboxView({
  actionsDisabled = false,
  onArchive,
  onDeleteRequest,
  onPublish,
  testimonials,
}: {
  actionsDisabled?: boolean;
  onArchive: (testimonial: InboxTestimonial) => void;
  onDeleteRequest: (testimonial: InboxTestimonial) => void;
  onPublish: (testimonial: InboxTestimonial) => void;
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
              <span>{testimonial.submissionType}</span>
              <span>{formatShortDate(testimonial.createdAt)}</span>
              <span>Consent recorded</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <blockquote className="bg-muted/30 rounded-xl border p-4 text-sm leading-6">
              “{testimonial.text}”
            </blockquote>
            {testimonial.role || testimonial.company || testimonial.rating ? (
              <p className="text-muted-foreground text-sm">
                {[testimonial.role, testimonial.company]
                  .filter(Boolean)
                  .join(" · ")}
                {testimonial.rating ? ` · ${testimonial.rating}/5` : ""}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {testimonial.moderationStatus !== "published" ? (
                <Button
                  disabled={actionsDisabled}
                  onClick={() => onPublish(testimonial)}
                  size="sm"
                >
                  <Send aria-hidden="true" />
                  Publish
                </Button>
              ) : null}
              {testimonial.moderationStatus !== "archived" ? (
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
              <Button
                disabled={actionsDisabled}
                onClick={() => onDeleteRequest(testimonial)}
                size="sm"
                variant="outline"
              >
                <Trash2 aria-hidden="true" />
                Delete permanently
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function actionError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The Testimonial action could not be completed.";
}

export function TestimonialInbox({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const [moderationStatus, setModerationStatusFilter] = useState<
    "all" | "pending" | "published" | "archived"
  >("all");
  const [submissionType, setSubmissionType] = useState<"all" | "text">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
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
  const remove = useMutation(api.testimonialModeration.remove);
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
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await setModerationStatus({
        organizationId: activeOrganization.id,
        status: nextStatus,
        testimonialId: testimonial.testimonialId as Id<"testimonials">,
      });
      setMessage(
        `${testimonial.submitterName}'s Testimonial is now ${nextStatus}.`,
      );
    } catch (caught) {
      setError(actionError(caught));
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await remove({
        organizationId: activeOrganization.id,
        testimonialId: deleteTarget.testimonialId as Id<"testimonials">,
      });
      setMessage("Testimonial permanently deleted.");
      setDeleteTarget(null);
    } catch (caught) {
      setError(actionError(caught));
    } finally {
      setPending(false);
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

      <div className="flex flex-wrap gap-3" aria-label="Inbox filters">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Status</span>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
            onChange={(event) =>
              setModerationStatusFilter(
                event.target.value as typeof moderationStatus,
              )
            }
            value={moderationStatus}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Type</span>
          <select
            aria-label="Type"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
            onChange={(event) =>
              setSubmissionType(event.target.value as typeof submissionType)
            }
            value={submissionType}
          >
            <option value="all">All types</option>
            <option value="text">Text</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Sort</span>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
            onChange={(event) => setSort(event.target.value as typeof sort)}
            value={sort}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

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

      <div aria-busy={pending} className={pending ? "opacity-70" : undefined}>
        <TestimonialInboxView
          actionsDisabled={pending}
          onArchive={(testimonial) =>
            void changeStatus(testimonial, "archived")
          }
          onDeleteRequest={setDeleteTarget}
          onPublish={(testimonial) =>
            void changeStatus(testimonial, "published")
          }
          testimonials={testimonials}
        />
      </div>

      {paginationStatus === "CanLoadMore" ||
      paginationStatus === "LoadingMore" ? (
        <Button
          disabled={paginationStatus === "LoadingMore" || pending}
          onClick={() => loadMore(20)}
          type="button"
          variant="outline"
        >
          {paginationStatus === "LoadingMore"
            ? "Loading…"
            : "Load more Testimonials"}
        </Button>
      ) : null}

      <AlertDialog
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete Testimonial?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately removes it from the Public Wall and deletes its
              private content, consent record, email history, and avatar. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button disabled={pending} variant="outline">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={pending}
                onClick={() => void confirmDelete()}
                variant="destructive"
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
