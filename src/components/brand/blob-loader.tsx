import { AnimatedBlob } from "@/components/brand/animated-blob";
import { cn } from "@/lib/utils";

/**
 * The site's loader: the blob looking around, instead of a spinner. Use it
 * for every indeterminate wait that has no skeleton of its own (route
 * transitions, a form submitting, a video processing). Skeletons stay for
 * page structure with a mascot; buttons use a small inline spinner.
 */
export function BlobLoader({
  className,
  label = "Loading",
  size = 64,
  showLabel = false,
}: {
  className?: string;
  /** Read by assistive tech and, when `showLabel`, shown under the blob. */
  label?: string;
  size?: number;
  showLabel?: boolean;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        className,
      )}
      role="status"
    >
      <AnimatedBlob size={size} variant="look" />
      <span className={showLabel ? "text-ink-2 text-sm" : "sr-only"}>
        {label}
      </span>
    </div>
  );
}

/** Full-height variant for route transitions and blocking loads. */
export function BlobLoaderScreen({ label }: { label?: string }) {
  return (
    <main className="bg-paper grid min-h-svh place-items-center px-5">
      <BlobLoader label={label ?? "Loading…"} size={72} showLabel />
    </main>
  );
}

/** Compact wait status for labels, menus, and progress details. */
export function BlobLoadingText({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-sm", className)}
      role="status"
    >
      <AnimatedBlob size={24} variant="look" />
      <span>{label}</span>
    </span>
  );
}
