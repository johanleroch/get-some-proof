import { AnimatedBlob } from "@/components/brand/animated-blob";
import { cn } from "@/lib/utils";

/**
 * The site's loader: the blob looking around, instead of a spinner. Use it
 * for every indeterminate wait that has no skeleton of its own (route
 * transitions, a form submitting, a video processing). Skeletons stay for
 * page structure; the inline button spinner stays in buttons.
 */
export function BlobLoader({
  className,
  label = "Loading",
  size = 64,
}: {
  className?: string;
  /** Read by assistive tech and, when `showLabel`, shown under the blob. */
  label?: string;
  size?: number;
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
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Full-height variant for route transitions and blocking loads. */
export function BlobLoaderScreen({ label }: { label?: string }) {
  return <BlobLoader className="min-h-svh w-full" label={label} size={72} />;
}
