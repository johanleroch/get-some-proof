import { Button } from "@/components/ui/button";

import type { VideoUploadPhase } from "@/hooks/use-video-upload";

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

  return (
    <div className="bg-surface-2 space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <p className="font-medium" role={uploading ? undefined : "status"}>
          {uploading
            ? `Uploading video — ${percentage}%`
            : "Video uploaded — processing…"}
        </p>
        {uploading && onCancel ? (
          <Button onClick={onCancel} size="sm" type="button" variant="ghost">
            Cancel upload
          </Button>
        ) : null}
      </div>
      <div
        aria-label="Video upload progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={uploading ? percentage : 100}
        className="bg-line h-2 overflow-hidden rounded-full"
        role="progressbar"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            uploading ? "bg-(--brand-accent)" : "bg-success"
          }`}
          style={{ width: `${uploading ? percentage : 100}%` }}
        />
      </div>
      <p className="text-ink-2 text-xs">
        {uploading
          ? "Keep this page open until the upload reaches 100%."
          : "Processing and captions continue in the background."}
      </p>
    </div>
  );
}
