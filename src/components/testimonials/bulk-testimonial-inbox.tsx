"use client";

import { useState } from "react";
import {
  IconChevronDown,
  IconX,
  IconFilter,
  IconVideo,
  IconPhoto,
  IconAlignLeft,
} from "@tabler/icons-react";
import { importAttestationText } from "@convex/domain/testimonialImport";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TestimonialInboxView,
  type InboxTestimonial,
} from "./testimonial-inbox";
import { useInboxSelection, type BulkInboxProps } from "./use-inbox-selection";
import {
  actionLabels,
  primaryActions,
  type BulkInboxAction,
} from "./inbox-bulk";

function BulkVideoRetryAction({
  asMenuItem = false,
  blocked,
  items,
  onRun,
  perform,
}: {
  asMenuItem?: boolean;
  blocked: boolean;
  items: InboxTestimonial[];
  onRun: (
    items: InboxTestimonial[],
    label: string,
    perform: (item: InboxTestimonial) => Promise<unknown>,
  ) => void;
  perform?: (item: InboxTestimonial) => Promise<unknown>;
}) {
  const videos = items.filter(
    (item) =>
      item.submissionType === "video" &&
      item.videoStatus === "failed" &&
      Boolean(item.videoSourceUrl),
  );
  if (!perform || items.length === 0 || videos.length !== items.length)
    return null;
  const run = () =>
    onRun(
      videos,
      videos.length === 1 ? "video copy restarted" : "video copies restarted",
      perform,
    );
  return asMenuItem ? (
    <DropdownMenuItem onSelect={run}>Retry video copies</DropdownMenuItem>
  ) : (
    <Button disabled={blocked} onClick={run} size="sm">
      Retry video copies
    </Button>
  );
}

/** Shared by the live Inbox and interactive synthetic fixtures. Key by project/import/category. */
export function BulkTestimonialInbox({
  totalCount,
  hasMore,
  loadPage,
  perform,
  performVideoRetry,
  ...view
}: BulkInboxProps & {
  performVideoRetry?: (item: InboxTestimonial) => Promise<unknown>;
}) {
  const [filters, setFilters] = useState<string[]>([]);
  const visibleTestimonials = view.testimonials.filter((item) => {
    const kind =
      item.submissionType === "video"
        ? "video"
        : item.card?.type === "text" && item.card.images?.length
          ? "image"
          : "text";
    return filters.length === 0 || filters.includes(kind);
  });
  const {
    selected,
    setSelected,
    phase,
    confirmation,
    setConfirmation,
    attested,
    setAttested,
    outcome,
    failures,
    setFailures,
    setOutcome,
    progress,
    toolbar,
    items,
    ready,
    imports,
    blocked,
    checked,
    countLabel,
    clear,
    selectAll,
    run,
    runCustom,
    request,
    toggle,
  } = useInboxSelection({
    totalCount,
    hasMore,
    loadPage,
    perform,
    ...view,
    testimonials: visibleTestimonials,
  });
  const retrySelected = (
    videos: InboxTestimonial[],
    label: string,
    retry: (item: InboxTestimonial) => Promise<unknown>,
  ) => void runCustom(videos, label, retry);
  function actionItem(action: BulkInboxAction) {
    return (
      <DropdownMenuItem
        key={action}
        disabled={blocked || (action === "publish" && ready.length === 0)}
        variant={action === "delete" ? "destructive" : "default"}
        onSelect={() => request(action)}
      >
        {actionLabels[action]}
      </DropdownMenuItem>
    );
  }
  const rare: BulkInboxAction[] =
    view.category === "spam" ? ["delete"] : ["spam", "delete"];
  const filterControls = (
    <div className="ml-auto shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={blocked}
          >
            <IconFilter aria-hidden="true" />
            Filter{filters.length > 0 ? ` (${filters.length})` : ""}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 space-y-1 p-1.5">
          {[
            { value: "video", label: "Video", Icon: IconVideo },
            { value: "image", label: "Text with image", Icon: IconPhoto },
            { value: "text", label: "Text without image", Icon: IconAlignLeft },
          ].map(({ value, label, Icon }) => (
            <DropdownMenuCheckboxItem
              key={value}
              className="data-[state=checked]:bg-brand-soft data-[state=checked]:text-brand-text min-h-10 gap-3 py-2 pr-8 pl-3 data-[state=checked]:font-medium [&>span.absolute]:right-3 [&>span.absolute]:left-auto"
              checked={filters.includes(value!)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => {
                clear();
                setFilters((previous) =>
                  checked
                    ? [...previous, value!]
                    : previous.filter((item) => item !== value),
                );
              }}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator className="mx-0 my-1.5" />
          <DropdownMenuItem
            className="text-ink-2 min-h-10 gap-3 px-3 py-2"
            disabled={!filters.length}
            onSelect={() => {
              clear();
              setFilters([]);
            }}
          >
            <IconX aria-hidden="true" className="size-4" />
            Clear filters
          </DropdownMenuItem>
          {filters.length > 0 ? (
            <p
              className="type-small text-ink-2 max-w-64 px-2 py-2"
              role="status"
            >
              {visibleTestimonials.length} matching
              {hasMore
                ? " among loaded testimonials. Load more to see more results."
                : " testimonials"}
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  return (
    <div className="space-y-3">
      {(view.testimonials.length > 0 ||
        filters.length > 0 ||
        selected.size > 0 ||
        outcome ||
        phase !== "idle") && (
        <div
          ref={toolbar}
          tabIndex={-1}
          aria-label="Bulk testimonial actions"
          className="bg-surface border-line focus-visible:outline-ring sticky top-0 z-20 rounded-lg border p-3 focus-visible:outline-2"
        >
          <div className="flex min-h-11 flex-wrap items-center gap-2">
            <label className="type-ui flex min-h-11 cursor-pointer items-center gap-3 pr-2">
              <Checkbox
                aria-label="Select displayed testimonials"
                checked={checked}
                disabled={blocked || visibleTestimonials.length === 0}
                onCheckedChange={(value) => {
                  setSelected((previous) => {
                    const next = new Map(previous);
                    for (const item of visibleTestimonials) {
                      if (value === true) next.set(item.testimonialId, item);
                      else next.delete(item.testimonialId);
                    }
                    return next;
                  });
                  setFailures([]);
                  setOutcome("");
                }}
              />
              <span>
                {selected.size
                  ? `${selected.size} selected`
                  : "Select testimonials"}
              </span>
            </label>
            {selected.size > 0 && (
              <>
                <div className="shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" disabled={blocked}>
                        Actions
                        <IconChevronDown aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <BulkVideoRetryAction
                        asMenuItem
                        blocked={blocked}
                        items={items}
                        onRun={retrySelected}
                        perform={performVideoRetry}
                      />
                      {primaryActions[view.category].map(actionItem)}
                      <DropdownMenuSeparator />
                      {rare.map(actionItem)}
                      {items.length > ready.length &&
                      primaryActions[view.category].includes("publish") ? (
                        <>
                          <DropdownMenuSeparator />
                          <p className="type-small text-ink-2 max-w-64 px-2 py-2">
                            {ready.length} ready to publish ·{" "}
                            {items.length - ready.length} videos not ready will
                            stay selected.
                          </p>
                          <DropdownMenuItem
                            onSelect={() => void selectAll(true)}
                          >
                            Refresh selected testimonials
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button
                  aria-label="Clear selection"
                  className="size-9 shrink-0 p-0"
                  size="sm"
                  variant="ghost"
                  disabled={phase === "running"}
                  onClick={clear}
                >
                  <IconX aria-hidden="true" />
                </Button>
              </>
            )}
            {filterControls}
          </div>
          {phase === "selecting" ? (
            <p role="status" className="type-small text-ink-2 mt-2">
              Selecting every matching testimonial…
            </p>
          ) : phase === "running" ? (
            <p role="status" className="type-small text-ink-2 mt-2">
              {progress.done} of {progress.total} processed. Keep this page
              open.
            </p>
          ) : (
            <>
              {hasMore && filters.length === 0 && selected.size > 0 && (
                <Button
                  className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
                  variant="link"
                  disabled={blocked}
                  onClick={() => void selectAll()}
                >
                  Select {countLabel}
                </Button>
              )}
            </>
          )}
          {outcome && (
            <p role="status" className="type-small mt-2">
              {outcome}
            </p>
          )}
          {failures.length > 0 && (
            <ul
              aria-label="Failed testimonials"
              className="type-small text-danger mt-2 max-h-32 overflow-y-auto"
            >
              {failures.map(({ item, message }) => (
                <li key={item.testimonialId}>
                  {item.submitterName}: {message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {filters.length > 0 && visibleTestimonials.length === 0 ? null : (
        <TestimonialInboxView
          {...view}
          testimonials={visibleTestimonials}
          actionsDisabled={blocked || selected.size > 0}
          onMove={
            selected.size > 0 || filters.length > 0 ? undefined : view.onMove
          }
          selection={{
            ids: new Set(selected.keys()),
            disabled: blocked,
            onToggle: toggle,
          }}
        />
      )}
      {filters.length > 0 && visibleTestimonials.length === 0 ? (
        <div className="space-y-3">
          <p className="type-body text-ink-2">
            No testimonials match these filters.
          </p>
          {view.footer}
        </div>
      ) : null}
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            toolbar.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {confirmation === "delete"
                ? `Permanently delete ${items.length} testimonials?`
                : `Publish ${ready.length} testimonials?`}
            </DialogTitle>
            <DialogDescription>
              {confirmation === "delete"
                ? "Their content and media will be permanently removed, including from your Public Wall and embeds. This cannot be undone."
                : `${imports} imported testimonials need your permission before appearing on your Public Wall and embeds.`}
            </DialogDescription>
          </DialogHeader>
          {confirmation === "publish" && (
            <label className="type-body flex cursor-pointer items-start gap-3 py-2">
              <Checkbox
                className="mt-1"
                checked={attested}
                onCheckedChange={(value) => setAttested(value === true)}
              />
              <span>{importAttestationText}</span>
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmation === "delete" ? "destructive" : "default"}
              disabled={confirmation === "publish" && !attested}
              onClick={() => {
                if (confirmation) void run(confirmation);
              }}
            >
              {confirmation === "delete"
                ? `Delete ${items.length} testimonials`
                : `Publish ${ready.length} testimonials`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
