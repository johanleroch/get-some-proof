"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { TestimonialCardVideoValue } from "@convex/testimonialCardValue";
import {
  TestimonialListFace,
  TestimonialListIdentity,
  TestimonialListWords,
} from "@/components/testimonials/testimonial-list-presentation";
import { VideoPreviewDialog } from "@/components/testimonials/video-preview-dialog";
import { IconArrowDown, IconArrowUp, IconTrash } from "@tabler/icons-react";
import type { WidgetConfig } from "@convex/domain/widgets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StudioCandidateListSkeleton } from "@/components/ui/page-skeletons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { StudioCandidate } from "./studio-view";
import { hasHighlight, selectAllWithinLimit } from "./selection-rules";

type SelectionProps = {
  accentColor: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  testimonialIds: string[];
  onChange: (ids: string[]) => void;
  layout: WidgetConfig["layout"];
  candidates: StudioCandidate[];
  hasMore: boolean;
  loadingMore: boolean;
  loadingCandidates?: boolean;
  onLoadMore: () => void;
  inboxHref: string;
};

function BulkSelectionControl({
  candidateIds,
  shownCount,
  testimonialIds,
  onChange,
}: {
  candidateIds: string[];
  shownCount: number;
  testimonialIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const selectedIds = new Set(testimonialIds);
  const selectedCount = candidateIds.filter((id) => selectedIds.has(id)).length;
  const allSelected =
    candidateIds.length > 0 &&
    candidateIds.length <= 50 &&
    selectedCount === candidateIds.length;
  const state = allSelected
    ? true
    : selectedCount > 0
      ? "indeterminate"
      : false;
  const selectionLimitReached = testimonialIds.length >= 50 && !allSelected;

  return (
    <div className="mb-3 flex min-h-10 items-center justify-between gap-4">
      <label className="flex cursor-pointer items-center gap-3 font-medium">
        <Checkbox
          checked={state}
          disabled={!candidateIds.length || selectionLimitReached}
          title={
            selectionLimitReached
              ? "Clear selected testimonials to make room."
              : undefined
          }
          onCheckedChange={(checked) => {
            if (checked) {
              onChange(selectAllWithinLimit(testimonialIds, candidateIds));
            } else {
              const bulkIds = new Set(candidateIds);
              onChange(testimonialIds.filter((id) => !bulkIds.has(id)));
            }
          }}
        />
        <span className="type-small">Select all</span>
      </label>
      <div className="flex items-center gap-2">
        {selectedCount > 0 && selectionLimitReached ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const bulkIds = new Set(candidateIds);
              onChange(testimonialIds.filter((id) => !bulkIds.has(id)));
            }}
          >
            Clear shown
          </Button>
        ) : null}
        <span className="type-small text-ink-2">{shownCount} shown</span>
      </div>
    </div>
  );
}

export function WidgetSelectionDialog(props: SelectionProps) {
  const { testimonialIds, candidates } = props;
  const [preview, setPreview] = useState<TestimonialCardVideoValue | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const searchingMore = !!search.trim() && (props.hasMore || props.loadingMore);
  useEffect(() => {
    if (!props.open || !searchingMore || props.loadingMore) return;
    // The existing bounded pagination keeps each request small. Continue across
    // pages while searching, and cancel when the dialog closes or input changes.
    const timer = window.setTimeout(props.onLoadMore, 250);
    return () => window.clearTimeout(timer);
  }, [props.open, searchingMore, props.loadingMore, props.onLoadMore, search]);
  const selectedIds = new Set(testimonialIds);
  const byId = new Map(
    candidates.map((item) => [item.testimonialId, item.card]),
  );
  const matching = candidates.filter(({ card }) =>
    `${card.name} ${card.type === "text" ? card.text : "video"}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const bulkCandidateIds = matching.flatMap(({ testimonialId, card }) =>
    props.layout !== "highlights" || hasHighlight(card) ? [testimonialId] : [],
  );
  function move(index: number, offset: number) {
    const ids = [...testimonialIds];
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    props.onChange(ids);
  }
  function remove(id: string) {
    props.onChange(testimonialIds.filter((item) => item !== id));
  }
  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={(open) => {
          if (!open) {
            setSearch("");
            setPreview(null);
          }
          props.onOpenChange(open);
        }}
      >
        <DialogContent
          onCloseAutoFocus={props.onCloseAutoFocus}
          zoom={false}
          className="flex h-[min(44rem,90dvh)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
          style={{ "--wall-accent": props.accentColor } as CSSProperties}
        >
          <DialogHeader className="shrink-0 px-5 pt-6 pr-12 pb-4 sm:px-6">
            <DialogTitle>Manage testimonials</DialogTitle>
            <DialogDescription>
              Choose your published proof, then arrange its order.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            defaultValue="all"
            onValueChange={(value) => {
              if (value !== "all") setSearch("");
            }}
            className="min-h-0 flex-1 gap-0"
          >
            <TabsList
              className="mx-5 shrink-0 sm:mx-6"
              aria-label="Testimonial selection"
            >
              <TabsTrigger value="all">All testimonials</TabsTrigger>
              <TabsTrigger value="selected">
                Selected ({testimonialIds.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="all"
              className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6"
            >
              <Input
                aria-label="Search testimonials"
                disabled={props.loadingCandidates}
                placeholder="Search by name or words…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <p className="type-small text-ink-2 mt-3 mb-4">
                {props.layout === "individual"
                  ? "Choose one testimonial. Selecting another replaces it."
                  : props.layout === "highlights"
                    ? "Choose testimonials with highlighted phrases. Add highlights from the Inbox."
                    : "Choose up to 50 testimonials for this widget."}
              </p>
              {props.loadingCandidates ? (
                <StudioCandidateListSkeleton />
              ) : (
                <>
                  {props.layout !== "individual" ? (
                    <BulkSelectionControl
                      candidateIds={bulkCandidateIds}
                      shownCount={matching.length}
                      testimonialIds={testimonialIds}
                      onChange={props.onChange}
                    />
                  ) : null}
                  <div className="border-line divide-line divide-y overflow-hidden rounded-lg border">
                    {matching.map(({ testimonialId, card }) => {
                      const checked = selectedIds.has(testimonialId);
                      const disabled =
                        !checked &&
                        ((testimonialIds.length >= 50 &&
                          props.layout !== "individual") ||
                          (props.layout === "highlights" &&
                            !hasHighlight(card)));
                      return (
                        <div
                          key={testimonialId}
                          data-studio-testimonial={testimonialId}
                          className={cn(
                            "has-focus-visible:ring-ring relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 has-focus-visible:ring-2 has-focus-visible:ring-inset",
                            checked ? "bg-brand-soft/30" : "hover:bg-surface-2",
                            disabled && "cursor-default opacity-60",
                          )}
                        >
                          {/* A click surface over the whole card, nothing more:
                              the checkbox carries the name, and an aria-label
                              on a label is prohibited (axe
                              aria-prohibited-attr). */}
                          <label
                            aria-hidden="true"
                            htmlFor={`studio-select-${testimonialId}`}
                            className={cn(
                              "absolute inset-0 z-10",
                              disabled ? "cursor-default" : "cursor-pointer",
                            )}
                          >
                            <span className="sr-only">Select {card.name}</span>
                          </label>
                          <div className="flex items-center gap-3 [&_button]:z-20 [&_button:not([role=checkbox])]:relative">
                            <Checkbox
                              id={`studio-select-${testimonialId}`}
                              className="absolute top-4 right-4 z-20 size-6 sm:static"
                              checked={checked}
                              disabled={disabled}
                              aria-label={`Select ${card.name}`}
                              onCheckedChange={(checked) =>
                                checked
                                  ? props.onChange(
                                      props.layout === "individual"
                                        ? [testimonialId]
                                        : [...testimonialIds, testimonialId],
                                    )
                                  : remove(testimonialId)
                              }
                            />
                            <TestimonialListFace
                              testimonial={card}
                              showAvatar={card.avatarVisible !== false}
                              onPreview={() => {
                                if (card.type === "video") setPreview(card);
                              }}
                            />
                          </div>
                          <div className="min-w-0 self-center">
                            <div className="pr-8 sm:pr-0">
                              <TestimonialListIdentity
                                name={card.name}
                                testimonial={card}
                              />
                            </div>
                            {card.type === "text" ? (
                              <TestimonialListWords
                                accentColor={props.accentColor}
                                testimonial={card}
                              />
                            ) : (
                              <p className="type-small text-ink-2 mt-1">
                                Video testimonial
                              </p>
                            )}
                            {props.layout === "highlights" &&
                            !hasHighlight(card) ? (
                              <p className="type-small text-ink-2 mt-2">
                                No highlighted phrases
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {searchingMore ? (
                <p role="status" className="type-small text-ink-2 py-4">
                  Searching more testimonials…
                </p>
              ) : null}
              {!props.loadingCandidates &&
              !matching.length &&
              !searchingMore ? (
                <p className="type-small text-ink-2 py-6">
                  {search.trim() ? (
                    "No matching testimonials."
                  ) : (
                    <>
                      Publish a testimonial in your{" "}
                      <Link
                        href={props.inboxHref as Route}
                        className="underline"
                      >
                        Inbox
                      </Link>{" "}
                      to add it here.
                    </>
                  )}
                </p>
              ) : null}
              {!props.loadingCandidates && props.hasMore && !search.trim() ? (
                <Button
                  className="mt-4"
                  variant="outline"
                  loading={props.loadingMore}
                  disabled={props.loadingMore}
                  onClick={props.onLoadMore}
                >
                  Load more testimonials
                </Button>
              ) : null}
            </TabsContent>
            <TabsContent
              value="selected"
              className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6"
            >
              <p className="type-small text-ink-2 mb-4">
                Use the arrows to set the order in your widget.
              </p>
              <ol
                className="border-line divide-line divide-y overflow-hidden rounded-lg border"
                aria-label="Selected testimonials"
              >
                {testimonialIds.map((id, index) => {
                  const card = byId.get(id);
                  const name = card?.name ?? "Unavailable testimonial";
                  return (
                    <li
                      key={id}
                      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto]"
                    >
                      <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-3">
                        <span className="type-small text-ink-2">
                          {index + 1}.
                        </span>
                        {card ? (
                          <TestimonialListFace
                            testimonial={card}
                            showAvatar={card.avatarVisible !== false}
                            onPreview={() => {
                              if (card.type === "video") setPreview(card);
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 self-center">
                        <TestimonialListIdentity
                          name={name}
                          testimonial={card ?? null}
                        />
                        {!card ? (
                          <p className="type-small text-ink-2 mt-1">
                            No longer available. Remove it from your selection.
                          </p>
                        ) : card.type === "text" ? (
                          <TestimonialListWords
                            accentColor={props.accentColor}
                            testimonial={card}
                          />
                        ) : (
                          <p className="type-small text-ink-2 mt-1">
                            Video testimonial
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-end gap-1 md:col-span-1 md:self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ${name} up`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <IconArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ${name} down`}
                          disabled={index === testimonialIds.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <IconArrowDown className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${name}`}
                          onClick={() => remove(id)}
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {!testimonialIds.length ? (
                <p className="type-small text-ink-2 py-6">
                  Your selection is empty. Choose proof from All testimonials.
                </p>
              ) : null}
            </TabsContent>
          </Tabs>
          <footer className="border-line flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
            <span className="type-small text-ink-2" role="status">
              {testimonialIds.length} / {props.layout === "individual" ? 1 : 50}{" "}
              selected
            </span>
            <Button
              onClick={() => {
                setSearch("");
                props.onOpenChange(false);
              }}
            >
              Done
            </Button>
          </footer>
        </DialogContent>
      </Dialog>
      {preview ? (
        <VideoPreviewDialog
          accentColor={props.accentColor}
          testimonial={preview}
          submitterName={preview.name}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
