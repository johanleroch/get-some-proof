"use client";

import { useState } from "react";
import { blobToast } from "@/components/brand/blob-toast";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import type { WidgetConfig } from "@convex/domain/widgets";
import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { PageHeader } from "@/components/page-header";
import { WallFrames } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { initialWidgetConfig } from "./catalog";
import { WidgetCard } from "./widget-card";
import {
  StudioTemplateChooser,
  type StudioTemplate,
} from "./studio-template-chooser";
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
  publishedAt?: number;
  updatedAt?: number;
  /** The first testimonials of the draft, so the grid can render the widget. */
  cardTestimonials?: StudioCandidate[];
  draft: { config: WidgetConfig; testimonialIds: string[] };
};
export type StudioDraft = {
  name: string;
  config: WidgetConfig;
  testimonialIds: string[];
};
export type StudioViewProps = {
  fontLibrary?: {
    canUpload: boolean;
    fonts: Array<{ id: string; name: string; url: string | null }>;
  };
  onUploadFont?: (file: File) => Promise<string>;
  onRemoveFont?: (id: string) => Promise<void>;
  initialChoosing?: boolean;
  onChoosingChange?: (choosing: boolean) => void;
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
  projectHref?: string;
};

export function StudioView(props: StudioViewProps) {
  const [choosing, setChoosing] = useState(props.initialChoosing ?? false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<StudioWidget | null>(null);
  function setTemplateChoice(next: boolean) {
    setChoosing(next);
    props.onChoosingChange?.(next);
  }
  async function performAction(template?: StudioTemplate) {
    setBusy(true);
    try {
      if (template) {
        const id = await props.onCreate(template.title, {
          ...initialWidgetConfig,
          accentColor: props.accentColor,
          layout: template.layout,
        });
        props.onOpen(id);
        setTemplateChoice(false);
      } else if (deleting) {
        await props.onRemove(deleting._id);
        setDeleting(null);
        blobToast.success("Widget deleted.");
      }
    } catch (error) {
      blobToast.error(
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
  if (props.loadingActive)
    return <StudioEditorSkeleton onBack={() => props.onOpen(null)} />;
  return (
    <div className="space-y-8">
      <PageHeader
        title={choosing ? "Choose a template" : "Studio"}
        description={
          choosing
            ? "Start with a layout. Make it yours next."
            : "Your best proof, ready for every page."
        }
        actions={
          choosing ? (
            <Button variant="ghost" onClick={() => setTemplateChoice(false)}>
              <IconArrowLeft className="size-4" />
              Your widgets
            </Button>
          ) : (
            <Button onClick={() => setTemplateChoice(true)}>
              <IconPlus className="size-4" />
              Create widget
            </Button>
          )
        }
      />
      {choosing ? (
        <>
          {props.loading ? (
            <p className="sr-only" role="status">
              Loading Studio. Templates will be available shortly.
            </p>
          ) : null}
          <StudioTemplateChooser
            freePlan={props.attributionRequired}
            disabled={busy || !!props.loading}
            onSelect={(template) => void performAction(template)}
          />
        </>
      ) : props.loading ? (
        <StudioWidgetListSkeleton />
      ) : props.widgets.length ? (
        <ul className="grid list-none gap-4 sm:grid-cols-2">
          {props.widgets.map((widget, index) => (
            <li className="min-w-0" key={widget._id}>
              <WidgetCard
                attributionRequired={props.attributionRequired}
                brandName={props.brandName}
                fontLibrary={props.fontLibrary}
                index={index}
                onDelete={() => setDeleting(widget)}
                onOpen={() => props.onOpen(widget._id)}
                origin={props.origin}
                widget={widget}
              />
            </li>
          ))}
        </ul>
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
              variant="destructive"
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
