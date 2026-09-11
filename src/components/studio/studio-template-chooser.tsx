import type { WidgetConfig } from "@convex/domain/widgets";

import { cn } from "@/lib/utils";
import { widgetTemplates } from "./catalog";

export type StudioTemplate = (typeof widgetTemplates)[number];

function TemplateSketch({ layout }: { layout: WidgetConfig["layout"] }) {
  return (
    <div
      aria-hidden="true"
      className="bg-surface-2 flex h-44 items-center justify-center overflow-hidden p-5"
    >
      {layout === "avatars" ? (
        <div className="flex -space-x-3">
          {["ML", "JC", "SR", "AT"].map((name) => (
            <span
              key={name}
              className="border-surface bg-paper text-ink-2 grid size-11 place-items-center rounded-full border-4 text-xs font-semibold"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "grid w-full max-w-56 gap-2",
            layout === "individual"
              ? "grid-cols-1"
              : layout === "carousel"
                ? "grid-cols-3"
                : "grid-cols-2",
          )}
        >
          {Array.from(
            {
              length:
                layout === "individual" ? 1 : layout === "carousel" ? 3 : 4,
            },
            (_, index) => (
              <div
                key={index}
                className={cn(
                  "bg-surface border-line rounded-md border p-2.5",
                  layout === "masonry" && index % 2 === 0
                    ? "-translate-y-2"
                    : "",
                )}
              >
                <div className="bg-brand-soft mb-2 h-1.5 w-9 rounded-full" />
                <div
                  className={cn(
                    "bg-line h-1.5 rounded-full",
                    layout === "highlights" ? "w-full" : "w-4/5",
                  )}
                />
                <div className="bg-line mt-1 h-1 w-3/5 rounded-full" />
                <div className="bg-surface-2 mt-3 size-4 rounded-full" />
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function StudioTemplateChooser({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (template: StudioTemplate) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {widgetTemplates.map((template) => (
        <button
          key={template.layout}
          disabled={disabled}
          className="border-line bg-surface hover:border-line-2 focus-visible:ring-brand-ring overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-3 disabled:opacity-50"
          onClick={() => onSelect(template)}
        >
          <TemplateSketch layout={template.layout} />
          <div className="space-y-1 p-5">
            <h2 className="type-subheading">{template.title}</h2>
            <p className="type-small text-ink-2">{template.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
