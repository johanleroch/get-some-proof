"use client";

import { type CSSProperties, useSyncExternalStore } from "react";
import {
  IconCode,
  IconDots,
  IconExternalLink,
  IconTrash,
} from "@tabler/icons-react";

import { blobToast } from "@/components/brand/blob-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { subscribeToNothing } from "@/lib/just-created";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { widgetTemplates } from "./catalog";
import type { StudioWidget } from "./studio-view";
import { WidgetCardPreview } from "./widget-card-preview";
import { WidgetLayoutSketch } from "./widget-preview-placeholders";

function templateName(layout: StudioWidget["draft"]["config"]["layout"]) {
  if (layout === "wall") return "Masonry grid";
  return (
    widgetTemplates.find((item) => item.layout === layout)?.title ?? layout
  );
}

/**
 * Three states, not two: a widget that is live but carries edits nobody has
 * published yet is the one the Owner actually needs to notice, and the old
 * Draft / Published badge could not say it.
 */
function publicationState(widget: StudioWidget) {
  if (!widget.published) return "draft" as const;
  if (
    widget.updatedAt !== undefined &&
    widget.publishedAt !== undefined &&
    widget.updatedAt > widget.publishedAt
  )
    return "ahead" as const;
  return "live" as const;
}

const stateLabel = {
  ahead: "Unpublished changes",
  draft: "Draft",
  live: "Published",
} as const;

const stateVariant = {
  ahead: "warning",
  draft: "neutral",
  live: "success",
} as const;

/**
 * "Published 3 weeks ago" reads against the reader's own clock and locale, so
 * it can only be written once the browser has one: the server renders the line
 * without it rather than rendering a sentence the client then contradicts.
 */
function useWhen(widget: StudioWidget) {
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  if (!hydrated) return null;
  const state = publicationState(widget);
  if (state === "live" && widget.publishedAt !== undefined)
    return `Published ${relativeTime(widget.publishedAt)}`;
  if (widget.updatedAt !== undefined)
    return `Edited ${relativeTime(widget.updatedAt)}`;
  return null;
}

/**
 * One widget in the Studio grid (DESIGN.md section 6, Studio): the widget's own
 * preview on the editor's grid canvas, then its name, what it is made of and
 * what state it is in. The whole card opens the editor; the menu holds the
 * actions that are not opening it.
 */
export function WidgetCard({
  attributionRequired,
  brandName,
  fontLibrary,
  index,
  onDelete,
  onOpen,
  origin,
  widget,
}: {
  attributionRequired: boolean;
  brandName: string;
  fontLibrary?: {
    canUpload: boolean;
    fonts: Array<{ id: string; name: string; url: string | null }>;
  };
  index: number;
  onDelete: () => void;
  onOpen: () => void;
  origin: string;
  widget: StudioWidget;
}) {
  const state = publicationState(widget);
  const count = widget.draft.testimonialIds.length;
  const moment = useWhen(widget);
  const url = `${origin}/widgets/${widget.publicId}`;
  const snippet = `<div data-gsp-widget="${widget.publicId}"></div>\n<script src="${origin}/embed/v2.js" async></script>`;
  const customFont = fontLibrary?.canUpload
    ? fontLibrary.fonts.find(
        (font) => font.id === widget.draft.config.customFontId,
      )
    : null;

  return (
    <article
      className={cn(
        "group/card border-line bg-surface hover:bg-surface-2 relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border transition-colors duration-(--motion-fast) ease-(--ease-out-soft)",
        index < 12 && "list-enter",
      )}
      style={
        index < 12 ? ({ "--list-index": index } as CSSProperties) : undefined
      }
    >
      <div className="relative min-w-0">
        <Badge
          className="bg-paper border-line absolute top-3 right-3 z-10"
          variant={stateVariant[state]}
        >
          {stateLabel[state]}
        </Badge>
        <WidgetCardPreview
          attributionRequired={attributionRequired}
          brandName={brandName}
          className="border-line h-56 shrink-0 border-b"
          config={widget.draft.config}
          customFont={
            customFont?.url ? { id: customFont.id, url: customFont.url } : null
          }
          fallback={<WidgetLayoutSketch layout={widget.draft.config.layout} />}
          googleFont={
            fontLibrary?.canUpload
              ? (widget.draft.config.googleFont ?? null)
              : null
          }
          testimonials={(widget.cardTestimonials ?? []).map(
            (item) => item.card,
          )}
        />
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']"
          onClick={onOpen}
          type="button"
        >
          <span className="type-ui block truncate font-semibold">
            {widget.name}
          </span>
          <span className="type-small text-ink-2 block truncate">
            {templateName(widget.draft.config.layout)} ·{" "}
            {count === 1 ? "1 testimonial" : `${count} testimonials`}
            {moment ? ` · ${moment}` : ""}
          </span>
        </button>
        <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Actions for ${widget.name}`}
                size="icon"
                variant="ghost"
              >
                <IconDots className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                disabled={!origin || !widget.published}
                onSelect={() => {
                  void navigator.clipboard
                    .writeText(snippet)
                    .then(() =>
                      blobToast.success("Embed code copied.", {
                        id: "studio-widget-card",
                      }),
                    )
                    .catch(() => blobToast.error("Could not copy. Try again."));
                }}
              >
                <IconCode className="size-4" />
                Copy embed code
              </DropdownMenuItem>
              <DropdownMenuItem asChild disabled={!origin || !widget.published}>
                <a href={url} rel="noreferrer" target="_blank">
                  <IconExternalLink className="size-4" />
                  Open widget page
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <IconTrash className="size-4" />
                Delete widget
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
