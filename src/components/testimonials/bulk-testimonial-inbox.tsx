"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { IconDots, IconChevronDown, IconX } from "@tabler/icons-react";
import { importAttestationText } from "@convex/domain/testimonialImport";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { convexErrorMessage } from "@/lib/convex-error-message";
import {
  TestimonialInboxView,
  type InboxCategory,
  type InboxTestimonial,
} from "./testimonial-inbox";

export type BulkInboxAction =
  "publish" | "archive" | "unpublish" | "spam" | "undo-spam" | "delete";
const actionLabels: Record<BulkInboxAction, string> = {
  publish: "Publish",
  archive: "Archive",
  unpublish: "Unpublish",
  spam: "Mark as Spam",
  "undo-spam": "Not Spam",
  delete: "Delete permanently",
};
const resultLabels: Record<BulkInboxAction, string> = {
  publish: "published",
  archive: "archived",
  unpublish: "unpublished",
  spam: "marked as Spam",
  "undo-spam": "restored",
  delete: "deleted",
};
const primaryActions: Record<InboxCategory, BulkInboxAction[]> = {
  pending: ["publish", "archive"],
  published: ["unpublish"],
  archived: ["publish"],
  spam: ["undo-spam"],
};
type InboxPage = {
  page: InboxTestimonial[];
  isDone: boolean;
  continueCursor: string;
};
type Failure = { item: InboxTestimonial; message: string };

/** Freeze the explicit selection before writes. Never mutate a status index while paging it. */
export async function collectInboxSelection(
  loadPage: (cursor: string | null) => Promise<InboxPage>,
  cancelled: () => boolean,
) {
  const items = new Map<string, InboxTestimonial>();
  let cursor: string | null = null;
  const startedAt = Date.now();
  do {
    if (cancelled()) return null;
    const result = await loadPage(cursor);
    if (cancelled()) return null;
    for (const item of result.page) {
      if (item.createdAt <= startedAt) items.set(item.testimonialId, item);
    }
    if (result.isDone) return items;
    if (result.continueCursor === cursor)
      throw new Error("The list changed. Please select all again.");
    cursor = result.continueCursor;
  } while (true);
}

function canPublish(item: InboxTestimonial) {
  return (
    item.submissionType === "text" ||
    (item.videoStatus === "ready" && item.card !== null)
  );
}

/** Shared by the live Inbox and interactive synthetic fixtures. Key by project/import/category. */
export function BulkTestimonialInbox({
  totalCount,
  hasMore,
  loadPage,
  perform,
  ...view
}: Omit<ComponentProps<typeof TestimonialInboxView>, "selection"> & {
  totalCount: number;
  hasMore: boolean;
  loadPage: (cursor: string | null) => Promise<InboxPage>;
  perform: (
    item: InboxTestimonial,
    action: BulkInboxAction,
    attested: boolean,
  ) => Promise<void>;
}) {
  const [selected, setSelected] = useState(new Map<string, InboxTestimonial>());
  const [phase, setPhase] = useState<"idle" | "selecting" | "running">("idle");
  const [confirmation, setConfirmation] = useState<BulkInboxAction | null>(
    null,
  );
  const [attested, setAttested] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [failures, setFailures] = useState<Failure[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const operation = useRef(0);
  const locked = useRef(false);
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      operation.current++;
    },
    [],
  );
  // Refresh visible selected records (e.g. a video finishes processing).
  const visible = new Map(
    view.testimonials.map((item) => [String(item.testimonialId), item]),
  );
  const items = [...selected].map(([id, item]) => visible.get(id) ?? item);
  const ready = items.filter(canPublish);
  const imports = ready.filter((item) => item.requiresImportAttestation).length;
  const blocked = phase !== "idle" || Boolean(view.actionsDisabled);
  const displayedSelected = view.testimonials.filter((item) =>
    selected.has(item.testimonialId),
  ).length;
  const checked =
    displayedSelected === 0
      ? false
      : displayedSelected === view.testimonials.length
        ? true
        : "indeterminate";
  const countLabel =
    totalCount > 500
      ? "all testimonials in this tab"
      : `all ${totalCount} testimonials in this tab`;

  function clear() {
    operation.current++;
    locked.current = false;
    setSelected(new Map());
    setPhase("idle");
    setFailures([]);
    setOutcome("");
  }
  function toggle(item: InboxTestimonial) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(item.testimonialId)) next.delete(item.testimonialId);
      else next.set(item.testimonialId, item);
      return next;
    });
    setOutcome("");
    setFailures([]);
  }
  async function selectAll(onlySelected = false) {
    if (locked.current || blocked) return;
    locked.current = true;
    const token = ++operation.current;
    setPhase("selecting");
    setOutcome("");
    setFailures([]);
    try {
      const all = await collectInboxSelection(
        loadPage,
        () => operation.current !== token,
      );
      if (all) {
        setSelected((previous) =>
          onlySelected
            ? new Map(
                [...previous].map(([id, item]) => [id, all.get(id) ?? item]),
              )
            : all,
        );
        if (onlySelected) setOutcome("Selection refreshed.");
      }
    } catch (error) {
      if (operation.current === token)
        setOutcome(
          convexErrorMessage(
            error,
            "Could not select every testimonial. Your previous selection is unchanged.",
          ),
        );
    } finally {
      if (operation.current === token) {
        locked.current = false;
        setPhase("idle");
      }
    }
  }
  async function run(action: BulkInboxAction) {
    if (locked.current || blocked) return;
    locked.current = true;
    const token = ++operation.current;
    const batch = action === "publish" ? ready : items;
    const accepted = attested;
    setConfirmation(null);
    setPhase("running");
    setOutcome("");
    setFailures([]);
    setProgress({ done: 0, total: batch.length });
    let successes = 0;
    const errors: Failure[] = [];
    for (const item of batch) {
      // Leaving this scope stops the unsent remainder, never acts in the next project.
      if (operation.current !== token) return;
      try {
        await perform(item, action, accepted);
        successes++;
        if (operation.current === token)
          setSelected((previous) => {
            const next = new Map(previous);
            next.delete(item.testimonialId);
            return next;
          });
      } catch (error) {
        errors.push({
          item,
          message: convexErrorMessage(
            error,
            "Could not update this testimonial. Please try again.",
          ),
        });
      }
      if (operation.current === token)
        setProgress({ done: successes + errors.length, total: batch.length });
    }
    if (operation.current !== token) return;
    const skipped = items.length - batch.length;
    setOutcome(
      `${successes} ${resultLabels[action]}${errors.length ? ` · ${errors.length} failed` : ""}${skipped ? ` · ${skipped} videos not ready` : ""}.`,
    );
    setFailures(errors);
    setPhase("idle");
    locked.current = false;
    toolbar.current?.focus();
  }
  function request(action: BulkInboxAction) {
    setAttested(false);
    if (action === "delete" || (action === "publish" && imports > 0))
      setConfirmation(action);
    else void run(action);
  }
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
  return (
    <div className="space-y-3">
      {(view.testimonials.length > 0 ||
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
                disabled={blocked || view.testimonials.length === 0}
                onCheckedChange={(value) => {
                  setSelected((previous) => {
                    const next = new Map(previous);
                    for (const item of view.testimonials) {
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
                <div className="hidden items-center gap-2 md:flex">
                  {primaryActions[view.category].map((action, index) => (
                    <Button
                      key={action}
                      size="sm"
                      variant={
                        index === 0 && action === "publish"
                          ? "default"
                          : "outline"
                      }
                      disabled={
                        blocked || (action === "publish" && ready.length === 0)
                      }
                      onClick={() => request(action)}
                    >
                      {actionLabels[action]}
                    </Button>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label="More bulk actions"
                        size="icon-sm"
                        variant="ghost"
                        disabled={blocked}
                      >
                        <IconDots aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {rare.map(actionItem)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="md:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" disabled={blocked}>
                        Actions ({selected.size})
                        <IconChevronDown aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {primaryActions[view.category].map(actionItem)}
                      <DropdownMenuSeparator />
                      {rare.map(actionItem)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button
                  aria-label="Clear selection"
                  className="ml-auto size-9 p-0 md:h-9 md:w-auto md:px-3"
                  size="sm"
                  variant="ghost"
                  disabled={phase === "running"}
                  onClick={clear}
                >
                  <IconX aria-hidden="true" className="md:hidden" />
                  <span className="hidden md:inline">Clear selection</span>
                </Button>
              </>
            )}
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
              {hasMore && selected.size > 0 && (
                <Button
                  className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
                  variant="link"
                  disabled={blocked}
                  onClick={() => void selectAll()}
                >
                  Select {countLabel}
                </Button>
              )}
              {selected.size > 0 &&
                primaryActions[view.category].includes("publish") &&
                ready.length < items.length && (
                  <p className="type-small text-ink-2 mt-2">
                    {ready.length} ready to publish ·{" "}
                    {items.length - ready.length}{" "}
                    {items.length - ready.length === 1 ? "video" : "videos"} not
                    ready will stay selected.
                  </p>
                )}
            </>
          )}
          {phase === "idle" &&
            items.length > ready.length &&
            primaryActions[view.category].includes("publish") && (
              <Button
                variant="link"
                size="sm"
                className="px-0"
                disabled={blocked}
                onClick={() => void selectAll(true)}
              >
                Refresh selected testimonials
              </Button>
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
      <TestimonialInboxView
        {...view}
        actionsDisabled={blocked || selected.size > 0}
        onMove={selected.size > 0 ? undefined : view.onMove}
        selection={{
          ids: new Set(selected.keys()),
          disabled: blocked,
          onToggle: toggle,
        }}
      />
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
