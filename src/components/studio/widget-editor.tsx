"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  IconArrowLeft,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDots,
  IconSend,
  IconShare,
  IconDeviceFloppy,
  IconEyeOff,
} from "@tabler/icons-react";
import type { WidgetConfig } from "@convex/domain/widgets";
import { SketchArrow } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CopyButton } from "@/components/ui/copy-button";
import { ColorPicker } from "@/components/ui/color-picker";
import { EmbedCode } from "@/components/ui/embed-code";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { widgetTemplates } from "./catalog";
import { blobToast } from "@/components/brand/blob-toast";
import { WidgetPreview } from "./widget-preview";
import { WidgetPreviewPlaceholders } from "./widget-preview-placeholders";
import { WidgetFontControl } from "./widget-font-control";
import { WidgetSelectionDialog } from "./widget-selection-dialog";
import { hasHighlight } from "./selection-rules";

import type { StudioDraft, StudioViewProps, StudioWidget } from "./studio-view";

export function WidgetEditor(
  props: StudioViewProps & { widget: StudioWidget },
) {
  const { widget } = props;
  const router = useRouter();
  const leaveHref = useRef<string | null>(null);
  const manageSelection = useRef<HTMLButtonElement>(null);
  const initialDraft: StudioDraft = {
    name: widget.name,
    ...widget.draft,
    config: {
      ...widget.draft.config,
      layout:
        widget.draft.config.layout === "wall"
          ? "masonry"
          : widget.draft.config.layout,
    },
  };
  const [draft, setDraft] = useState<StudioDraft>(initialDraft);
  const revision = useRef(widget.revision);
  const [mobile, setMobile] = useState(false);
  const [panel, setPanel] = useState<"edit" | "preview">(
    props.initialPreview || !widget.draft.testimonialIds.length
      ? "preview"
      : "edit",
  );
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(false);
  const [leave, setLeave] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!busy && !dirty) return;
    const guardNavigation = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !link ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === "_blank"
      )
        return;
      if (
        !busy &&
        (link.origin !== window.location.origin ||
          link.pathname === window.location.pathname)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) {
        leaveHref.current = link.pathname + link.search + link.hash;
        setLeave(true);
      }
    };
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [busy, dirty]);
  const byId = new Map(
    props.candidates.map((item) => [item.testimonialId, item.card]),
  );
  const selected = draft.testimonialIds.flatMap((id) => {
    const card = byId.get(id);
    return card ? [{ testimonialId: id, card }] : [];
  });
  const invalidIndividual =
    draft.config.layout === "individual" && draft.testimonialIds.length !== 1;
  const invalidHighlights =
    draft.config.layout === "highlights" &&
    selected.some(({ card }) => !hasHighlight(card));
  const eligibility = invalidIndividual
    ? "Choose exactly one testimonial for this template."
    : invalidHighlights
      ? "Select testimonials with highlighted phrases. Add highlights from the Inbox."
      : "";
  function setConfig(patch: Partial<WidgetConfig>) {
    if (busy) return;
    setDraft((current) => ({
      ...current,
      config: { ...current.config, ...patch },
    }));
  }
  async function save(publish: boolean) {
    if (publish && eligibility) {
      blobToast.error(eligibility);
      return;
    }
    setBusy(true);
    try {
      await props.onSave(widget._id, draft, revision.current, publish);
      revision.current += 1;
      setDraft((current) => ({
        ...current,
        name: current.name === draft.name ? draft.name.trim() : current.name,
      }));
      blobToast.success(
        publish ? "Published. Your embed is up to date." : "Draft saved.",
        { id: "studio-widget-action" },
      );
      if (publish) setShare(true);
    } catch (error) {
      blobToast.error(
        error instanceof Error ? error.message : "Could not save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const url = `${props.origin}/widgets/${widget.publicId}`;
  const snippet = `<div data-gsp-widget="${widget.publicId}"></div>\n<script src="${props.origin}/embed/v2.js" async></script>`;
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col"
      data-slot="studio-editor"
    >
      <header className="border-line bg-surface flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label="Back to Studio"
            onClick={() => {
              leaveHref.current = null;
              if (dirty) setLeave(true);
              else props.onOpen(null);
            }}
          >
            <IconArrowLeft className="size-5" />
          </Button>
          <h1 className="type-heading min-w-0 truncate">{widget.name}</h1>
          <Badge variant={widget.published ? "success" : "neutral"}>
            {widget.published ? "Published" : "Draft"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            loading={busy}
            disabled={
              busy || !draft.name.trim() || !draft.testimonialIds.length
            }
            onClick={() => void save(true)}
          >
            <IconSend className="size-4" />
            {widget.published ? "Publish changes" : "Publish"}
          </Button>
          {widget.published ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setShare(true)}
            >
              <IconShare className="size-4" />
              Share
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Widget actions"
                disabled={busy}
              >
                <IconDots className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                disabled={busy || !draft.name.trim()}
                onSelect={() => void save(false)}
              >
                <IconDeviceFloppy className="size-4" />
                Save draft
              </DropdownMenuItem>
              {widget.published ? <DropdownMenuSeparator /> : null}
              {widget.published ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busy}
                  onSelect={() => {
                    setBusy(true);
                    void props
                      .onUnpublish(widget._id)
                      .then((nextRevision) => {
                        revision.current = nextRevision;
                        setShare(false);
                        blobToast.success("Widget unpublished.", {
                          id: "studio-widget-action",
                        });
                      })
                      .catch(() =>
                        blobToast.error("Could not unpublish. Try again."),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  <IconEyeOff className="size-4" />
                  Unpublish widget
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div
        className="bg-surface border-line flex shrink-0 gap-2 border-b px-4 py-2 lg:hidden"
        role="group"
        aria-label="Studio editor view"
      >
        <Button
          variant={panel === "edit" ? "secondary" : "ghost"}
          aria-pressed={panel === "edit"}
          aria-controls="widget-edit-panel"
          onClick={() => setPanel("edit")}
        >
          Edit widget
        </Button>
        <Button
          variant={panel === "preview" ? "secondary" : "ghost"}
          aria-pressed={panel === "preview"}
          aria-controls="widget-preview-panel"
          onClick={() => setPanel("preview")}
        >
          Preview widget
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <fieldset
          id="widget-edit-panel"
          disabled={busy}
          className={cn(
            "border-line bg-surface min-h-0 min-w-0 space-y-6 overflow-y-auto p-5 disabled:opacity-70 lg:block lg:border-r",
            panel !== "edit" && "hidden",
          )}
        >
          <section
            className="border-line space-y-3 border-b pb-5"
            aria-label="Testimonial selection"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="type-subheading">Testimonials</h2>
              <span className="text-ink-2 type-small">
                {draft.testimonialIds.length} selected
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSelectionOpen(true)}
              ref={manageSelection}
            >
              Manage selection
            </Button>
          </section>
          <section className="space-y-3">
            <Label htmlFor="widget-name">Widget name</Label>
            <Input
              id="widget-name"
              value={draft.name}
              maxLength={80}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
            <Label htmlFor="widget-template">Template</Label>
            <Select
              disabled={busy}
              value={draft.config.layout}
              onValueChange={(layout) =>
                setConfig({ layout: layout as WidgetConfig["layout"] })
              }
            >
              <SelectTrigger id="widget-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {widgetTemplates.map((item) => (
                  <SelectItem
                    key={item.layout}
                    value={item.layout}
                    disabled={
                      props.attributionRequired && item.layout !== "masonry"
                    }
                  >
                    {item.title}
                    {item.layout !== "masonry" ? " · Pro" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
          <section className="border-line space-y-4 border-t pt-5">
            <h2 className="type-subheading">Appearance</h2>
            {draft.config.layout !== "avatars" ? (
              <div className="space-y-2">
                <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                  <span>Allow links in testimonials</span>
                  <Switch
                    checked={draft.config.testimonialLinksEnabled ?? true}
                    onCheckedChange={(enabled) =>
                      setConfig({ testimonialLinksEnabled: enabled })
                    }
                  />
                </label>
                <p className="text-ink-2 type-small">
                  Make mentions and links clickable in this widget. When
                  disabled, the words stay visible.
                </p>
              </div>
            ) : null}
            <WidgetFontControl
              config={draft.config}
              onChange={setConfig}
              library={props.fontLibrary}
              onUpload={props.onUploadFont}
              onRemove={props.onRemoveFont}
            />
            {(
              [
                ["accentColor", "Accent"],
                ["backgroundColor", "Background"],
                ["textColor", "Text"],
              ] as const
            ).map(([key, label]) => (
              <div
                className="flex items-center justify-between gap-3"
                key={key}
              >
                <Label id={`widget-${key}`}>{label}</Label>
                <div className="flex items-center gap-2">
                  <ColorPicker
                    legend={label}
                    labelledBy={`widget-${key}`}
                    presets={[]}
                    value={draft.config[key]}
                    onChange={(value) => setConfig({ [key]: value })}
                  />
                  <span className="text-ink-2 font-mono text-xs">
                    {draft.config[key]}
                  </span>
                </div>
              </div>
            ))}
          </section>
        </fieldset>
        <section
          id="widget-preview-panel"
          className={cn(
            "bg-surface-2 min-h-0 min-w-0 flex-col overflow-hidden lg:flex",
            panel !== "preview" && "hidden",
            panel === "preview" && "flex",
          )}
          aria-label="Widget preview"
        >
          <div className="border-line bg-paper flex shrink-0 items-center justify-between gap-3 border-b px-5 py-2">
            <span className="type-ui">Live preview</span>
            <div className="flex gap-1">
              <Button
                variant={mobile ? "ghost" : "secondary"}
                size="icon"
                aria-label="Desktop preview"
                aria-pressed={!mobile}
                onClick={() => setMobile(false)}
              >
                <IconDeviceDesktop className="size-4" />
              </Button>
              <Button
                variant={mobile ? "secondary" : "ghost"}
                size="icon"
                aria-label="Mobile preview"
                aria-pressed={mobile}
                onClick={() => setMobile(true)}
              >
                <IconDeviceMobile className="size-4" />
              </Button>
            </div>
          </div>
          <div
            className="studio-preview-canvas min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
            tabIndex={0}
            aria-label="Preview canvas"
            role="region"
          >
            {!draft.testimonialIds.length ? (
              <div className="flex min-h-full flex-col items-center justify-center gap-6 py-6">
                <WidgetPreviewPlaceholders layout={draft.config.layout} />
                <div
                  className="bg-brand-soft w-full max-w-sm space-y-3 rounded-xl p-8"
                  aria-label="Add testimonials"
                  role="region"
                >
                  <h2 className="type-subheading text-center">
                    {draft.config.layout === "avatars"
                      ? "Put faces to your proof"
                      : "Your testimonials go here"}
                  </h2>
                  <p className="type-small text-ink-2 text-center">
                    {draft.config.layout === "avatars"
                      ? "Select testimonials to show your customers’ faces."
                      : "Select testimonials to see them in this layout."}
                  </p>
                  <div
                    className="studio-selection-hint pointer-events-none ml-[50%] w-14"
                    aria-hidden="true"
                  >
                    <SketchArrow
                      shape="curve"
                      className="text-brand-text h-10 w-14 -scale-x-100"
                    />
                  </div>
                  <Button
                    className="cta-shine relative w-full overflow-hidden"
                    size="lg"
                    disabled={busy}
                    onClick={() => setSelectionOpen(true)}
                  >
                    Add testimonials
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="mx-auto overflow-hidden rounded-lg"
                style={{ maxWidth: mobile ? 390 : "100%" }}
              >
                <WidgetPreview
                  value={{
                    config: draft.config,
                    googleFont: props.fontLibrary?.canUpload
                      ? (draft.config.googleFont ?? null)
                      : null,
                    customFont: (() => {
                      const font = props.fontLibrary?.canUpload
                        ? props.fontLibrary.fonts.find(
                            (font) => font.id === draft.config.customFontId,
                          )
                        : null;
                      return font?.url ? { id: font.id, url: font.url } : null;
                    })(),
                    brandName: props.brandName,
                    attributionRequired: props.attributionRequired,
                    testimonials: selected.map(({ card }) => card),
                  }}
                />
              </div>
            )}
          </div>
        </section>
      </div>
      <WidgetSelectionDialog
        accentColor={draft.config.accentColor}
        returnFocusTo={manageSelection}
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        testimonialIds={draft.testimonialIds}
        layout={draft.config.layout}
        candidates={props.candidates}
        hasMore={props.hasMore}
        loadingMore={props.loadingMore}
        loadingCandidates={props.loadingCandidates}
        onLoadMore={props.onLoadMore}
        inboxHref={props.inboxHref}
        onChange={(testimonialIds) => {
          if (!busy) {
            setDraft((current) => ({ ...current, testimonialIds }));
          }
        }}
      />
      <Dialog open={share} onOpenChange={setShare}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Your widget is ready.</DialogTitle>
            <DialogDescription>
              Add the code to a custom HTML block on your website. Include the
              script once per page.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="widget-code">Embed code</Label>
          <EmbedCode id="widget-code" code={snippet} />
          <CopyButton value={snippet}>Copy embed code</CopyButton>
          <Label htmlFor="widget-link">Public link</Label>
          <Input id="widget-link" readOnly value={url} />
          <CopyButton variant="outline" value={url}>
            Copy link
          </CopyButton>
          <p className="type-small text-ink-2">
            Published changes appear on the next load. Your installation code
            stays the same.
          </p>
        </DialogContent>
      </Dialog>
      <AlertDialog open={leave} onOpenChange={setLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your latest changes will be lost. Your published widget stays as
              it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leaveHref.current) router.push(leaveHref.current as Route);
                else props.onOpen(null);
              }}
            >
              Leave editor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
