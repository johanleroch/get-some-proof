"use client";

import { IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AnimatedBlob } from "@/components/brand/animated-blob";
import { Blob, type BlobExpressionName } from "@/components/brand/blob";
import { cn } from "@/lib/utils";

export type BlobToastType =
  "success" | "info" | "warning" | "error" | "loading";

/** The face each kind of message gets. Loading uses the site loader. */
const faces: Record<Exclude<BlobToastType, "loading">, BlobExpressionName> = {
  success: "happy",
  info: "neutral",
  warning: "worried",
  error: "sad",
};

/**
 * The status colors the title and the action, the way it colors a badge
 * label: the bubble itself stays `--surface` so the message keeps its
 * contrast on any screen, and an error reads as an error at a glance.
 */
const titleColors: Record<BlobToastType, string> = {
  error: "text-danger",
  info: "text-info",
  loading: "text-ink",
  success: "text-success",
  warning: "text-warning",
};

const actionColors: Record<BlobToastType, string> = {
  error: "text-danger",
  info: "text-info",
  loading: "text-brand-text",
  success: "text-success",
  warning: "text-warning",
};

export type BlobToastProps = {
  type: BlobToastType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
};

/**
 * A notification told by the mascot: the blob on the left, its message in a
 * speech bubble. The bubble arrives first and squashes as it lands, the blob
 * hops in a beat later (`.toast-bubble` and `.toast-mascot` in globals.css),
 * then blinks from neutral into the expression of the message, so every toast
 * starts with a small sign of life. The status colors the title and the
 * action; the bubble stays `--surface`.
 */
export function BlobToast({
  action,
  className,
  description,
  onDismiss,
  title,
  type,
}: BlobToastProps) {
  const target = type === "loading" ? "neutral" : faces[type];
  const [expression, setExpression] = useState<BlobExpressionName>("neutral");

  useEffect(() => {
    const timer = window.setTimeout(() => setExpression(target), 380);
    return () => window.clearTimeout(timer);
  }, [target]);

  return (
    <div
      className={cn(
        "flex w-[min(360px,calc(100vw-2rem))] items-end gap-2.5 pb-1.5",
        className,
      )}
      role="status"
    >
      {type === "loading" ? (
        <AnimatedBlob
          className="toast-mascot mb-0.5"
          size={48}
          variant="look"
        />
      ) : (
        <Blob
          className="toast-mascot mb-0.5"
          expression={expression}
          size={48}
        />
      )}
      <div className="toast-bubble bg-card shadow-float relative min-w-0 flex-1 rounded-lg border px-3.5 py-3">
        <span
          aria-hidden="true"
          className="bg-card absolute bottom-[18px] -left-[7px] size-3 rotate-45 border-b border-l"
        />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn("type-ui font-semibold", titleColors[type])}>
              {title}
            </p>
            {description ? (
              <p className="text-muted-foreground type-small mt-0.5">
                {description}
              </p>
            ) : null}
            {action ? (
              <button
                className={cn(
                  "type-ui mt-2 cursor-pointer font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none",
                  actionColors[type],
                )}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            ) : null}
          </div>
          {onDismiss ? (
            <button
              aria-label="Dismiss"
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring -mt-1 -mr-1.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors duration-150 outline-none focus-visible:ring-[3px]"
              onClick={onDismiss}
              type="button"
            >
              <IconX aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Options = Omit<BlobToastProps, "type" | "title" | "onDismiss"> & {
  /** Milliseconds before it leaves; loading toasts stay until dismissed. */
  duration?: number;
  /** Reuse an id so the same message replaces itself instead of stacking. */
  id?: string;
};

function show(type: BlobToastType, title: string, options: Options = {}) {
  const { duration, id, ...rest } = options;
  return toast.custom(
    (id) => (
      <BlobToast
        {...rest}
        onDismiss={() => toast.dismiss(id)}
        title={title}
        type={type}
      />
    ),
    {
      // Sonner's wrapper must stay invisible and never clip the mascot: no
      // shadow or background of its own, overflow visible, natural height.
      className: "!bg-transparent !shadow-none !overflow-visible !h-auto",
      duration: type === "loading" ? Number.POSITIVE_INFINITY : duration,
      id,
      unstyled: true,
    },
  );
}

/**
 * Drop-in for sonner's `toast.*`: same call shape, the mascot's rendering.
 * `blobToast.dismiss(id)` closes one (for example a loading toast once the
 * work is done).
 */
export const blobToast = {
  success: (title: string, options?: Options) =>
    show("success", title, options),
  info: (title: string, options?: Options) => show("info", title, options),
  warning: (title: string, options?: Options) =>
    show("warning", title, options),
  error: (title: string, options?: Options) => show("error", title, options),
  loading: (title: string, options?: Options) =>
    show("loading", title, options),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
