import {
  Archive,
  Download,
  Ellipsis,
  EyeOff,
  Send,
  ShieldAlert,
  Trash2,
  Undo2,
} from "lucide-react";

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
  | "archive"
  | "delete"
  | "download"
  | "publish"
  | "spam"
  | "undo-spam"
  | "unpublish";

export type InboxTestimonialMenuValue = {
  canDownload?: boolean;
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
          className="bg-background/90 shadow-sm backdrop-blur-sm"
          disabled={disabled}
          size="icon"
          variant="outline"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="capitalize">
          {testimonial.moderationStatus}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isSpam ? (
          <DropdownMenuItem onSelect={() => onAction("undo-spam")}>
            <Undo2 aria-hidden="true" />
            Undo Spam
          </DropdownMenuItem>
        ) : (
          <>
            {testimonial.moderationStatus === "published" ? (
              <DropdownMenuItem onSelect={() => onAction("unpublish")}>
                <EyeOff aria-hidden="true" />
                Unpublish
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={!videoReady}
                onSelect={() => onAction("publish")}
              >
                <Send aria-hidden="true" />
                Publish
              </DropdownMenuItem>
            )}
            {testimonial.moderationStatus === "pending" ? (
              <DropdownMenuItem onSelect={() => onAction("archive")}>
                <Archive aria-hidden="true" />
                Archive
              </DropdownMenuItem>
            ) : null}
            {testimonial.submissionType === "video" &&
            testimonial.videoStatus === "ready" &&
            testimonial.canDownload ? (
              <DropdownMenuItem onSelect={() => onAction("download")}>
                <Download aria-hidden="true" />
                Download MP4
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => onAction("spam")}>
              <ShieldAlert aria-hidden="true" />
              Mark as Spam
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onAction("delete")}
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
              Delete permanently
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
