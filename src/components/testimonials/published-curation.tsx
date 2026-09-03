"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useMutation, usePaginatedQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type VisibilityField = "avatar" | "company" | "rating" | "role";
type CuratedTestimonial = {
  overrides?: Partial<Record<VisibilityField, boolean | undefined>>;
  submissionType: "text" | "video";
  submitterName: string;
  testimonialId: Id<"testimonials">;
};

export function PublishedCuration({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const { loadMore, results, status } = usePaginatedQuery(
    api.wallCustomization.listPublished,
    { organizationId },
    { initialNumItems: 50 },
  );
  const movePublished = useMutation(api.wallCustomization.movePublished);
  const setVisibility = useMutation(
    api.wallCustomization.setTestimonialVisibility,
  );

  return (
    <PublishedCurationView
      onMove={(testimonialId, beforeTestimonialId, afterTestimonialId) =>
        movePublished({
          afterTestimonialId,
          beforeTestimonialId,
          organizationId,
          testimonialId,
        })
      }
      onSetVisibility={(testimonialId, overrides) =>
        setVisibility({ organizationId, overrides, testimonialId })
      }
      canLoadMore={status === "CanLoadMore" || status === "LoadingMore"}
      loadingMore={status === "LoadingMore"}
      onLoadMore={() => loadMore(50)}
      testimonials={results}
    />
  );
}

export function PublishedCurationView({
  canLoadMore = false,
  loadingMore = false,
  onMove,
  onLoadMore,
  onSetVisibility,
  testimonials,
}: {
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onMove: (
    testimonialId: Id<"testimonials">,
    beforeTestimonialId: Id<"testimonials"> | undefined,
    afterTestimonialId: Id<"testimonials"> | undefined,
  ) => Promise<unknown>;
  onLoadMore?: () => void;
  onSetVisibility: (
    testimonialId: Id<"testimonials">,
    overrides: Partial<Record<VisibilityField, boolean | undefined>>,
  ) => Promise<unknown>;
  testimonials: CuratedTestimonial[];
}) {
  const draggedId = useRef<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!testimonials || testimonials.length === 0) return null;

  async function saveOrder(
    testimonialId: Id<"testimonials">,
    beforeTestimonialId: Id<"testimonials"> | undefined,
    afterTestimonialId: Id<"testimonials"> | undefined,
  ) {
    setPending(true);
    setMessage(null);
    try {
      await onMove(testimonialId, beforeTestimonialId, afterTestimonialId);
      setMessage("Public Wall order saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reorder failed.");
    } finally {
      setPending(false);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= testimonials!.length || from === to) return;
    const ids = testimonials!.map(({ testimonialId }) => testimonialId);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    void saveOrder(moved!, ids[to - 1], ids[to + 1]);
  }

  async function changeVisibility(
    testimonialId: Id<"testimonials">,
    current: Partial<Record<VisibilityField, boolean | undefined>> | undefined,
    field: VisibilityField,
    value: string,
  ) {
    setPending(true);
    setMessage(null);
    try {
      await onSetVisibility(testimonialId, {
        ...current,
        [field]: value === "inherit" ? undefined : value === "show",
      });
      setMessage("Testimonial visibility saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="published-curation-heading" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" id="published-curation-heading">
          Public Wall curation
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Drag Published Testimonials or use the move buttons. The hosted and
          Embedded Walls share this order.
        </p>
      </div>
      <ol className="space-y-3">
        {testimonials.map((testimonial, index) => (
          <li
            className="bg-card rounded-xl border p-4 shadow-xs"
            draggable={!pending}
            key={testimonial.testimonialId}
            onDragEnd={() => {
              draggedId.current = undefined;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={() => {
              draggedId.current = String(testimonial.testimonialId);
            }}
            onDrop={() => {
              const from = testimonials.findIndex(
                ({ testimonialId }) =>
                  String(testimonialId) === draggedId.current,
              );
              if (from >= 0) move(from, index);
              draggedId.current = undefined;
            }}
          >
            <div className="flex items-start gap-3">
              <GripVertical
                aria-hidden="true"
                className="text-muted-foreground mt-1 size-5"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {testimonial.submitterName}
                </p>
                <p className="text-muted-foreground text-xs capitalize">
                  {testimonial.submissionType} Testimonial
                </p>
              </div>
              <Button
                aria-label={`Move ${testimonial.submitterName} up`}
                disabled={pending || index === 0}
                onClick={() => move(index, index - 1)}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                aria-label={`Move ${testimonial.submitterName} down`}
                disabled={pending || index === testimonials.length - 1}
                onClick={() => move(index, index + 1)}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {(["avatar", "role", "company", "rating"] as const).map(
                (field) => (
                  <label className="space-y-1 text-xs" key={field}>
                    <span className="text-muted-foreground block capitalize">
                      {field === "rating" ? "Stars" : field}
                    </span>
                    <select
                      aria-label={`${testimonial.submitterName} ${field}`}
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      disabled={pending}
                      onChange={(event) =>
                        void changeVisibility(
                          testimonial.testimonialId,
                          testimonial.overrides,
                          field,
                          event.target.value,
                        )
                      }
                      value={
                        testimonial.overrides?.[field] === undefined
                          ? "inherit"
                          : testimonial.overrides[field]
                            ? "show"
                            : "hide"
                      }
                    >
                      <option value="inherit">Wall default</option>
                      <option value="show">Show</option>
                      <option value="hide">Hide</option>
                    </select>
                  </label>
                ),
              )}
            </div>
          </li>
        ))}
      </ol>
      {canLoadMore ? (
        <Button
          disabled={loadingMore}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          {loadingMore ? "Loading…" : "Load more Published Testimonials"}
        </Button>
      ) : null}
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
