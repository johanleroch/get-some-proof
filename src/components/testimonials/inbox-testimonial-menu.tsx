"use client";

import { IconDots, IconShieldX, IconTrash } from "@tabler/icons-react";

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
  | "publish"
  | "spam"
  | "undo-spam"
  | "unpublish";

export type InboxTestimonialMenuValue = {
  moderationStatus: "pending" | "published" | "archived" | "spam";
  submissionType: "text" | "video";
  submitterName: string;
  videoStatus?: "awaiting_upload" | "processing" | "ready" | "failed";
};

/**
 * What is left in the "..." menu once the routine work moved onto the card:
 * only the two acts an Owner should have to look for. Marking abuse and
 * deleting for good are rare and hard to take back, so they do not sit next
 * to Publish (DESIGN.md section 7 keeps destructive actions apart).
 */
export function InboxTestimonialMenu({
  disabled = false,
  onAction,
  testimonial,
}: {
  disabled?: boolean;
  onAction: (action: InboxTestimonialAction) => void;
  testimonial: InboxTestimonialMenuValue;
}) {
  const isSpam = testimonial.moderationStatus === "spam";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`More actions for ${testimonial.submitterName}'s Testimonial`}
          disabled={disabled}
          size="icon-sm"
          variant="ghost"
        >
          <IconDots aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {isSpam ? null : (
          <>
            <DropdownMenuItem onSelect={() => onAction("spam")}>
              <IconShieldX aria-hidden="true" />
              Mark as Spam
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
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
