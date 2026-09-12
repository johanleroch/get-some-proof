import type { WidgetConfig } from "@convex/domain/widgets";
import { cn } from "@/lib/utils";

/** Illustrative empty content, not a loading state or fabricated testimonials. */
export function WidgetPreviewPlaceholders({
  layout,
}: {
  layout: WidgetConfig["layout"];
}) {
  if (layout === "avatars") {
    return (
      <div aria-hidden="true" className="flex justify-center -space-x-3 py-4">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="border-paper bg-surface relative grid size-14 place-items-center overflow-hidden rounded-full border-4 sm:size-16"
          >
            <div className="bg-line absolute top-2.5 size-4 rounded-full" />
            <div className="bg-line absolute -bottom-1 h-6 w-9 rounded-t-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "mx-auto grid w-full max-w-2xl items-start gap-4",
        layout === "individual"
          ? "max-w-xs grid-cols-1"
          : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {Array.from({ length: layout === "individual" ? 1 : 3 }, (_, index) => (
        <div
          key={index}
          className={cn(
            "border-line bg-surface rounded-lg border p-4",
            index === 2 && "hidden sm:block",
          )}
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-surface-2 size-8 shrink-0 rounded-full" />
            <div className="bg-surface-2 h-2 w-16 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from(
              { length: layout === "masonry" ? 3 + index : 3 },
              (_, line) => (
                <div
                  key={line}
                  className={cn(
                    "bg-surface-2 h-2 rounded-full",
                    line % 3 === 2 ? "w-2/3" : "w-full",
                  )}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The layout as a miniature, for a widget that has no testimonials yet and for
 * a card that has not come near the viewport. Same grammar as the template
 * chooser's sketch, one size smaller.
 */
export function WidgetLayoutSketch({
  layout,
  tiny = false,
}: {
  layout: WidgetConfig["layout"];
  /** For the 56px thumbnail beside a control rather than a card's canvas. */
  tiny?: boolean;
}) {
  if (layout === "avatars") {
    return (
      <div
        aria-hidden="true"
        className="flex items-center justify-center -space-x-2"
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            className={cn(
              "border-surface-2 bg-paper block rounded-full border-2",
              tiny ? "size-4" : "size-9",
            )}
            key={index}
          />
        ))}
      </div>
    );
  }
  const cells = layout === "individual" ? 1 : layout === "carousel" ? 3 : 4;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid w-full items-center",
        tiny ? "max-w-full gap-1" : "max-w-56 gap-2",
        layout === "individual"
          ? "grid-cols-1"
          : layout === "carousel"
            ? "grid-cols-3"
            : "grid-cols-2",
      )}
    >
      {Array.from({ length: cells }, (_, index) => (
        <div
          className={cn(
            "bg-paper border-line rounded-md border",
            tiny ? "p-1" : "p-2.5",
            layout === "masonry" &&
              index % 2 === 0 &&
              (tiny ? "-translate-y-0.5" : "-translate-y-2"),
          )}
          key={index}
        >
          <div
            className={cn(
              "bg-brand-soft-2 w-2/3 rounded-full",
              tiny ? "mb-1 h-0.5" : "mb-2 h-1.5",
            )}
          />
          <div
            className={cn(
              "bg-line w-full rounded-full",
              tiny ? "h-0.5" : "h-1.5",
            )}
          />
          {tiny ? null : (
            <div className="bg-line mt-1 h-1.5 w-1/2 rounded-full" />
          )}
        </div>
      ))}
    </div>
  );
}
