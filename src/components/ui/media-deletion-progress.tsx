import { IconPhoto, IconVideo, IconUpload } from "@tabler/icons-react";
import type { Infer } from "convex/values";
import type { mediaDeletionProgress } from "@convex/domain/mediaDeletionProgress";

export type MediaDeletionCounts = Infer<typeof mediaDeletionProgress>;

export function MediaDeletionProgress({
  progress,
  status,
}: {
  progress?: MediaDeletionCounts;
  status: "requested" | "failed" | "deleted";
}) {
  const total =
    (progress?.imagesTotal ?? 0) +
    (progress?.videosTotal ?? 0) +
    (progress?.uploadsTotal ?? 0);
  const deleted =
    (progress?.imagesDeleted ?? 0) +
    (progress?.videosDeleted ?? 0) +
    (progress?.uploadsDeleted ?? 0);
  const known = progress?.inventoryComplete === true;
  const percent = known
    ? total
      ? Math.min(100, Math.round((deleted / total) * 100))
      : 100
    : undefined;
  const label =
    status === "deleted"
      ? "Deletion complete"
      : status === "failed"
        ? "Cleanup needs another attempt"
        : !known
          ? "Counting images and videos"
          : deleted === total
            ? "Media cleaned up. Finishing deletion"
            : "Deleting images and videos";
  const rows = [
    {
      label: "Images",
      icon: IconPhoto,
      done: progress?.imagesDeleted ?? 0,
      total: progress?.imagesTotal ?? 0,
    },
    {
      label: "Videos",
      icon: IconVideo,
      done: progress?.videosDeleted ?? 0,
      total: progress?.videosTotal ?? 0,
    },
    ...(progress?.uploadsTotal
      ? [
          {
            label: "Pending uploads",
            icon: IconUpload,
            done: progress.uploadsDeleted,
            total: progress.uploadsTotal,
          },
        ]
      : []),
  ];
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="type-ui" role="status">
        {label}
      </p>
      <div
        role="progressbar"
        aria-label="Media cleanup"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={
          known ? `${deleted} of ${total} media cleaned up` : "Counting media"
        }
        className="bg-surface-2 h-2 overflow-hidden rounded-full"
      >
        <div
          className="bg-brand h-full origin-left transition-transform duration-200 motion-reduce:transition-none"
          style={{ transform: `scaleX(${(percent ?? 0) / 100})` }}
        />
      </div>
      <dl className="space-y-3">
        {rows.map(({ label, icon: Icon, done, total: count }) => (
          <div className="flex items-center justify-between gap-6" key={label}>
            <dt className="text-ink-2 type-small flex items-center gap-2">
              <Icon className="size-4" stroke={1.75} aria-hidden="true" />
              {label}
            </dt>
            <dd className="type-ui tabular-nums">
              {done} / {known ? count : "…"}
            </dd>
          </div>
        ))}
      </dl>
      {progress?.imagesShared ? (
        <p className="type-small text-ink-2">
          {progress.imagesShared} shared image
          {progress.imagesShared === 1 ? "" : "s"} kept because they are used
          elsewhere.
        </p>
      ) : null}
      <p className="type-small text-ink-2">
        {status === "failed"
          ? "Deletion is not complete yet. Your data stays unavailable while cleanup is retried."
          : status === "deleted"
            ? "The media and the item have been deleted."
            : "The item is deleted only after its media has been cleaned up. You can leave this page."}
      </p>
    </div>
  );
}
