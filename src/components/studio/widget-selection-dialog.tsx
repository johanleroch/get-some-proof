"use client";

import { useEffect, useState } from "react";
import { IconArrowDown, IconArrowUp, IconTrash } from "@tabler/icons-react";
import type { WidgetConfig } from "@convex/domain/widgets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { hasHighlight } from "./selection-rules";

type SelectionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonialIds: string[];
  onChange: (ids: string[]) => void;
  layout: WidgetConfig["layout"];
  candidates: StudioCandidate[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  inboxHref: string;
};

export function WidgetSelectionDialog(props: SelectionProps) {
  const { testimonialIds, candidates } = props;
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
  function move(index: number, offset: number) {
    const ids = [...testimonialIds];
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    props.onChange(ids);
  }
  function remove(id: string) {
    props.onChange(testimonialIds.filter((item) => item !== id));
  }
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) setSearch("");
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="flex h-[min(44rem,90dvh)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
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
            <div className="space-y-2">
              {matching.map(({ testimonialId, card }) => {
                const checked = selectedIds.has(testimonialId);
                const disabled =
                  !checked &&
                  ((testimonialIds.length >= 50 &&
                    props.layout !== "individual") ||
                    (props.layout === "highlights" && !hasHighlight(card)));
                return (
                  <label
                    key={testimonialId}
                    className={cn(
                      "border-line flex cursor-pointer items-start gap-3 rounded-md border p-4",
                      checked ? "bg-brand-soft" : "hover:bg-surface-2",
                      disabled && "cursor-default opacity-60",
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
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
                    <span className="min-w-0 space-y-1">
                      <span className="type-ui block">{card.name}</span>
                      <span className="type-small text-ink-2 line-clamp-3">
                        {card.type === "text" ? card.text : "Video testimonial"}
                      </span>
                      {props.layout === "highlights" && !hasHighlight(card) ? (
                        <span className="type-small text-ink-2 block">
                          No highlighted phrases
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {searchingMore ? (
              <p role="status" className="type-small text-ink-2 py-4">
                Searching more testimonials…
              </p>
            ) : null}
            {!matching.length && !searchingMore ? (
              <p className="type-small text-ink-2 py-6">
                {search.trim() ? (
                  "No matching testimonials."
                ) : (
                  <>
                    Publish a testimonial in your{" "}
                    <a href={props.inboxHref} className="underline">
                      Inbox
                    </a>{" "}
                    to add it here.
                  </>
                )}
              </p>
            ) : null}
            {props.hasMore && !search.trim() ? (
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
            <ol className="space-y-2" aria-label="Selected testimonials">
              {testimonialIds.map((id, index) => {
                const card = byId.get(id);
                const name = card?.name ?? "Unavailable testimonial";
                return (
                  <li
                    key={id}
                    className="border-line rounded-md border p-3 sm:flex sm:items-center sm:gap-3 sm:p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="type-ui break-words">
                        {index + 1}. {name}
                      </p>
                      <p className="type-small text-ink-2 mt-1 line-clamp-2">
                        {!card
                          ? "No longer available. Remove it from your selection."
                          : card.type === "text"
                            ? card.text
                            : "Video testimonial"}
                      </p>
                    </div>
                    <div className="mt-2 flex shrink-0 justify-end gap-1 sm:mt-0">
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
  );
}
