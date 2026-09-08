"use client";

import {
  IconDots,
  IconHighlight,
  IconListDetails,
  IconPhoto,
  IconShieldX,
  IconTrash,
} from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type InboxTestimonialAction =
  | "archive"
  | "delete"
  | "highlight"
  | "preview"
  | "publish"
  | "spam"
  | "thumbnail"
  | "undo-spam"
  | "unpublish"
  | "wall-display";

export type InboxTestimonialMenuValue = {
  moderationStatus: "pending" | "published" | "archived" | "spam";
  submissionType: "text" | "video";
  submitterName: string;
  videoStatus?: "awaiting_upload" | "processing" | "ready" | "failed";
};

/**
 * Everything about one Testimonial that is not the decision. The row keeps
 * the decision its category allows (Publish, Archive, Unpublish, Not Spam);
 * the tools that shape the card (the highlighted phrase, the video still,
 * the details shown on the Wall) wait here, and the two rare, hard-to-undo
 * acts sit last behind a rule (DESIGN.md section 7 keeps destructive actions
 * apart).
 */
export function InboxTestimonialMenu({
  className,
  disabled = false,
  onAction,
  testimonial,
}: {
  className?: string;
  disabled?: boolean;
  onAction: (action: InboxTestimonialAction) => void;
  testimonial: InboxTestimonialMenuValue;
}) {
  const isSpam = testimonial.moderationStatus === "spam";
  const tools = isSpam
    ? []
    : [
        ...(testimonial.submissionType === "text"
          ? [
              {
                action: "highlight" as const,
                icon: IconHighlight,
                label: "Highlight a phrase",
              },
            ]
          : []),
        ...(testimonial.submissionType === "video" &&
        testimonial.videoStatus === "ready"
          ? [
              {
                action: "thumbnail" as const,
                icon: IconPhoto,
                label: "Change thumbnail",
              },
            ]
          : []),
        ...(testimonial.moderationStatus === "published"
          ? [
              {
                action: "wall-display" as const,
                icon: IconListDetails,
                label: "Show or hide details",
              },
            ]
          : []),
      ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`More actions for ${testimonial.submitterName}'s Testimonial`}
          className={className}
          disabled={disabled}
          size="icon-sm"
          variant="ghost"
        >
          <IconDots aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {tools.map((tool) => (
          <DropdownMenuItem
            key={tool.action}
            onSelect={() => onAction(tool.action)}
          >
            <tool.icon aria-hidden="true" />
            {tool.label}
          </DropdownMenuItem>
        ))}
        {tools.length ? <DropdownMenuSeparator /> : null}
        {isSpam ? null : (
          <DropdownMenuItem onSelect={() => onAction("spam")}>
            <IconShieldX aria-hidden="true" />
            Mark as Spam
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => onAction("delete")}
          variant="destructive"
        >
          <IconTrash aria-hidden="true" />
          Delete permanently
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
