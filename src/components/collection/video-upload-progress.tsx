import { AnimatedBlob } from "@/components/brand/animated-blob";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { VideoUploadPhase } from "@/hooks/use-video-upload";

/**
 * The wait a Submitter watches once their video leaves the browser. The
 * mascot sits on the line it belongs to rather than floating centred above
 * left-aligned text, the percentage rides the label's baseline, and the
 * helper line keeps the same column (DESIGN.md sections 4 and 5). The fill
 * slides behind a clipped track, so the only thing animating is a transform
 * and the pill keeps its own cap (section 8).
 * The landing gets its own beat: the mascot hops once and the new label rises
 * behind it (`.upload-status-cheer`, `.upload-status-label` in globals.css),
 * which is what turns "Uploading your video…" into "Video uploaded !"
 * (the space before the mark is non-breaking, so it never wraps alone).
 */
export function VideoUploadProgress({
  onCancel,
  phase,
  progress,
}: {
  onCancel?: () => void;
  phase: VideoUploadPhase;
  progress: number;
}) {
  if (phase === "idle") return null;
  const percentage = Math.max(0, Math.min(100, Math.round(progress)));
  const uploading = phase === "uploading";
  const value = uploading ? percentage : 100;

  return (
    <div className="bg-surface-2 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <span
          className={uploading ? undefined : "upload-status-cheer"}
          key={phase}
        >
          <AnimatedBlob size={36} variant="look" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <p className="upload-status-label font-medium" key={phase}>
              {uploading ? "Uploading your video…" : "Video uploaded !"}
            </p>
            <span className="text-ink-2 tabular-nums">
              {uploading ? `${percentage}%` : "Processing…"}
            </span>
          </div>
          <div
            aria-label="Video upload progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={value}
            className="bg-line h-2 overflow-hidden rounded-full"
            role="progressbar"
          >
            {/* Slid, not stretched: scaling the fill would flatten the
                pill's own cap into an ellipse. */}
            <div
              className={cn(
                "h-full w-full rounded-full transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                uploading ? "bg-(--brand-accent)" : "bg-success",
              )}
              style={{ transform: `translateX(${value - 100}%)` }}
            />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">
        {uploading
          ? ""
          : "Video uploaded. Processing and captions continue in the background."}
      </span>
      <div className="mt-3 flex flex-col items-start gap-2 pl-12 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-ink-2 text-xs">
          {uploading
            ? "Keep this page open until the upload reaches 100%."
            : "Processing and captions continue in the background."}
        </p>
        {uploading && onCancel ? (
          <Button
            className="-ml-3 sm:ml-0"
            onClick={onCancel}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancel upload
          </Button>
        ) : null}
      </div>
    </div>
  );
}
