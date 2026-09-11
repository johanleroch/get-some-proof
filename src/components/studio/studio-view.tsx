"use client";

import { useState } from "react";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import type { WidgetConfig } from "@convex/domain/widgets";
import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { PageHeader } from "@/components/page-header";
import { WallFrames } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  StudioEditorSkeleton,
  StudioWidgetListSkeleton,
} from "@/components/ui/page-skeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { initialWidgetConfig, widgetTemplates } from "./catalog";
import { WidgetEditor } from "./widget-editor";

export type StudioCandidate = {
  testimonialId: string;
  card: TestimonialCardValue;
};
export type StudioWidget = {
  _id: string;
  name: string;
  publicId: string;
  revision: number;
  published?: unknown;
  draft: { config: WidgetConfig; testimonialIds: string[] };
};
export type StudioDraft = {
  name: string;
  config: WidgetConfig;
  testimonialIds: string[];
};
export type StudioViewProps = {
  initialChoosing?: boolean;
  initialPreview?: boolean;
  brandName: string;
  accentColor: string;
  attributionRequired: boolean;
  widgets: StudioWidget[];
  candidates: StudioCandidate[];
  hasMore: boolean;
  loadingMore: boolean;
  loading?: boolean;
  loadingCandidates?: boolean;
  onLoadMore: () => void;
  onCreate: (name: string, config: WidgetConfig) => Promise<string>;
  onSave: (
    id: string,
    draft: StudioDraft,
    revision: number,
    publish: boolean,
  ) => Promise<void>;
  onUnpublish: (id: string) => Promise<number>;
  onRemove: (id: string) => Promise<void>;
  onOpen: (id: string | null) => void;
  active: StudioWidget | null;
  loadingActive?: boolean;
  origin: string;
  inboxHref: string;
};

function templateName(layout: WidgetConfig["layout"]) {
  return (
    widgetTemplates.find((item) => item.layout === layout)?.title ?? layout
  );
}
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

export function StudioView(props: StudioViewProps) {
  const [choosing, setChoosing] = useState(props.initialChoosing ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<StudioWidget | null>(null);
  async function performAction(template?: (typeof widgetTemplates)[number]) {
    setBusy(true);
    setError("");
    try {
      if (template) {
        const id = await props.onCreate(template.title, {
          ...initialWidgetConfig,
          accentColor: props.accentColor,
          layout: template.layout,
        });
        props.onOpen(id);
        setChoosing(false);
      } else if (deleting) {
        await props.onRemove(deleting._id);
        setDeleting(null);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (props.active)
    return (
      <WidgetEditor key={props.active._id} {...props} widget={props.active} />
    );
  if (props.loadingActive) return <StudioEditorSkeleton />;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-5 sm:p-8">
      <PageHeader
        title={choosing ? "Choose a template" : "Studio"}
        description={
          choosing
            ? "Start with a layout. Make it yours next."
            : "Your best proof, ready for every page."
        }
        actions={
          choosing ? (
            <Button variant="ghost" onClick={() => setChoosing(false)}>
              <IconArrowLeft className="size-4" />
              Your widgets
            </Button>
          ) : (
            <Button onClick={() => setChoosing(true)}>
              <IconPlus className="size-4" />
              Create widget
            </Button>
          )
        }
      />
      {error ? (
        <p role="alert" className="text-danger type-small">
          {error}
        </p>
      ) : null}
      {choosing ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {widgetTemplates.map((template) => (
            <button
              key={template.layout}
              disabled={busy || props.loading}
              className="border-line bg-surface hover:border-line-2 focus-visible:ring-brand-ring overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-3 disabled:opacity-50"
              onClick={() => void performAction(template)}
            >
              <TemplateSketch layout={template.layout} />
              <div className="space-y-1 p-5">
                <h2 className="type-subheading">{template.title}</h2>
                <p className="type-small text-ink-2">{template.description}</p>
              </div>
            </button>
          ))}
        </div>
      ) : props.loading ? (
        <StudioWidgetListSkeleton />
      ) : props.widgets.length ? (
        <div className="border-line bg-surface divide-line divide-y rounded-lg border">
          {props.widgets.map((widget) => (
            <div
              key={widget._id}
              className="flex items-center gap-3 p-4 sm:p-5"
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => props.onOpen(widget._id)}
              >
                <span className="type-ui block truncate font-semibold">
                  {widget.name}
                </span>
                <span className="type-small text-ink-2">
                  {templateName(widget.draft.config.layout)} ·{" "}
                  {widget.draft.testimonialIds.length} selected
                </span>
              </button>
              <Badge variant={widget.published ? "success" : "neutral"}>
                {widget.published ? "Published" : "Draft"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${widget.name}`}
                onClick={() => setDeleting(widget)}
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          illustration={<WallFrames />}
          title="Give your proof a place."
          description="Create a widget, choose your testimonials and add it to your site."
          action={
            <Button onClick={() => setChoosing(true)}>Choose a template</Button>
          }
        />
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this widget?</AlertDialogTitle>
            <AlertDialogDescription>
              Its link and embed will stop working. Your testimonials stay in
              your Inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep widget</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void performAction()}
            >
              Delete widget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
