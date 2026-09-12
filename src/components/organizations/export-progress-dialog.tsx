"use client";
import type { ExportProgress } from "@/lib/export-progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function ExportProgressDialog({
  open,
  pending,
  progress,
  error,
  onClose,
  onRetry,
}: {
  open: boolean;
  pending: boolean;
  progress: ExportProgress;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  const known = progress.phase !== "preparing";
  const percent = progress.total
    ? Math.round((progress.processed / progress.total) * 100)
    : known
      ? 100
      : 0;
  const labels = {
    preparing: "Collecting your data…",
    media: progress.current ?? "Collecting media…",
    finalizing: "Building your ZIP…",
    saving: "Saving your ZIP…",
    done: "ZIP prepared",
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {error
              ? "Backup needs attention"
              : progress.phase === "done"
                ? "Your backup is ready"
                : "Preparing your backup"}
          </DialogTitle>
          <DialogDescription>
            {pending
              ? "Keep this page open while we collect your images, videos and data."
              : "Check the ZIP and its export report before deleting your project."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium">
              {known
                ? `${progress.processed} of ${progress.total} media processed`
                : "Preparing the file list"}
            </span>
            {known ? (
              <span className="text-ink-2 tabular-nums">{percent}%</span>
            ) : null}
          </div>
          <div
            role="progressbar"
            aria-label="Media processed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={known ? percent : undefined}
            className="bg-surface-2 h-2 overflow-hidden rounded-full"
          >
            <div
              className={`bg-brand h-full rounded-full ${known ? "transition-[width] duration-200 motion-reduce:transition-none" : "w-1/3 animate-pulse motion-reduce:animate-none"}`}
              style={known ? { width: `${percent}%` } : undefined}
            />
          </div>
          <p className="text-ink-2 min-h-5 text-sm" role="status">
            {error ? "Export stopped" : labels[progress.phase]}
          </p>
          {progress.failed ? (
            <p className="text-warning text-sm">
              {progress.failed} media could not be included. Details are in
              export-report.json.
            </p>
          ) : null}
          {error ? (
            <p className="text-danger text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          {error ? (
            <Button variant="outline" onClick={onRetry}>
              Retry export
            </Button>
          ) : null}
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
