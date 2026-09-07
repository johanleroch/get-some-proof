import {
  IconArchive,
  IconArrowBackUp,
  IconDots,
  IconEyeOff,
  IconHighlight,
  IconSend,
  IconShieldX,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type InboxTestimonialAction =
  | "highlight"
  | "archive"
  | "delete"
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
  const videoReady =
    testimonial.submissionType !== "video" ||
    testimonial.videoStatus === "ready";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Options for ${testimonial.submitterName}'s Testimonial`}
          className="bg-surface/90 backdrop-blur-sm"
          disabled={disabled}
          size="icon"
          variant="outline"
        >
          <IconDots aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="capitalize">
          {testimonial.moderationStatus}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isSpam ? (
          <DropdownMenuItem onSelect={() => onAction("undo-spam")}>
            <IconArrowBackUp aria-hidden="true" />
            Undo Spam
          </DropdownMenuItem>
        ) : (
          <>
            {testimonial.submissionType === "text" ? (
              <DropdownMenuItem onSelect={() => onAction("highlight")}>
                <IconHighlight aria-hidden="true" /> Highlight a phrase
              </DropdownMenuItem>
            ) : null}
            {testimonial.moderationStatus === "published" ? (
              <DropdownMenuItem onSelect={() => onAction("unpublish")}>
                <IconEyeOff aria-hidden="true" />
                Unpublish
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={!videoReady}
                onSelect={() => onAction("publish")}
              >
                <IconSend aria-hidden="true" />
                Publish
              </DropdownMenuItem>
            )}
            {testimonial.moderationStatus === "pending" ? (
              <DropdownMenuItem onSelect={() => onAction("archive")}>
                <IconArchive aria-hidden="true" />
                Archive
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => onAction("spam")}>
              <IconShieldX aria-hidden="true" />
              Mark as Spam
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onAction("delete")}
              variant="destructive"
            >
              <IconTrash aria-hidden="true" />
              Delete permanently
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
