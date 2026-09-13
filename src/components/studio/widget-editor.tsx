"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  IconArrowLeft,
  IconCode,
  IconChevronDown,
  IconDeviceDesktop,
  IconDeviceIpad,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconLink,
  IconPencil,
  IconDots,
  IconSend,
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
} from "@/components/ui/dropdown-menu";
import { CopyButton } from "@/components/ui/copy-button";
import { ColorPicker } from "@/components/ui/color-picker";
import { EmbedCode } from "@/components/ui/embed-code";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CanvasGrid } from "./canvas-grid";
import {
  StudioTemplateChooser,
  type StudioTemplate,
} from "./studio-template-chooser";
import { WidgetLayoutSketch } from "./widget-preview-placeholders";
import { WidgetPreview } from "./widget-preview";
import { WidgetPreviewPlaceholders } from "./widget-preview-placeholders";
import { WidgetFontControl } from "./widget-font-control";
import { WidgetSelectionDialog } from "./widget-selection-dialog";
import { hasHighlight } from "./selection-rules";

import type { StudioDraft, StudioViewProps, StudioWidget } from "./studio-view";

/** How many chosen testimonials the column names before it counts the rest. */
const SHOWN_PROOF = 5;

/**
 * The page sheet is a whole number of canvas cells wide, so both of its
 * vertical edges fall on a grid line rather than across one.
 */
const CANVAS_CELL = 56;
function snapToCells(width: number) {
  return Math.round(width / CANVAS_CELL) * CANVAS_CELL - GRID_INSET * 2;
}
/** The sheet's own padding and hairlines, outside the widget it holds. */
const SHEET_FRAME = 58;
/**
 * The gap the sheet keeps from the grid lines on every side, so its edges read
 * as sitting inside a cell rather than drawn on the rule.
 */
const GRID_INSET = 8;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function templateTitle(layout: WidgetConfig["layout"]) {
  if (layout === "wall") return "Masonry grid";
  return (
    widgetTemplates.find((item) => item.layout === layout)?.title ?? layout
  );
}

/**
 * One named group of settings (DESIGN.md section 6, Studio editor). The column
 * used to run three groups together with only one of them titled, so the
 * middle one — the widget's own name and its template — belonged to nothing.
 */
function StudioGroup({
  children,
  last = false,
  title,
}: {
  children: ReactNode;
  last?: boolean;
  title: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "space-y-3 py-5 first:pt-0",
        !last && "border-line border-b",
      )}
    >
      <h2 className="type-micro text-ink-2">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The page widths the canvas offers (DESIGN.md section 6, Studio canvas). Real
 * page widths, not "desktop or mobile": the editor used to render the widget
 * across the whole panel, some 1400px, which is the width of no site anyone
 * embeds it in.
 */
const previewWidths = [
  { key: "desktop", label: "Desktop", width: 1280, icon: IconDeviceDesktop },
  { key: "laptop", label: "Laptop", width: 1024, icon: IconDeviceLaptop },
  { key: "tablet", label: "Tablet", width: 768, icon: IconDeviceIpad },
  { key: "phone", label: "Phone", width: 390, icon: IconDeviceMobile },
] as const;
type PreviewWidth = (typeof previewWidths)[number];

export function WidgetEditor(
  props: StudioViewProps & { widget: StudioWidget },
) {
  const { widget } = props;
  const router = useRouter();
  const leaveHref = useRef<string | null>(null);
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
  const [deviceKey, setDeviceKey] = useState<PreviewWidth["key"]>("laptop");
  const device =
    previewWidths.find((item) => item.key === deviceKey) ?? previewWidths[1];
  const [panel, setPanel] = useState<"edit" | "preview">(
    props.initialPreview || !widget.draft.testimonialIds.length
      ? "preview"
      : "edit",
  );
  const [busy, setBusy] = useState(false);
  const [embed, setEmbed] = useState(false);
  const [leave, setLeave] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const selectionOpener = useRef<HTMLButtonElement | null>(null);
  const previewFocusTarget = useRef<HTMLButtonElement | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const sheetContent = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState<number | undefined>(undefined);
  // The sheet is a whole number of canvas cells tall, so its lower edge falls
  // on a grid line like the other three. The content is what is measured:
  // reading the sheet's own height back would only ever let it grow.
  useEffect(() => {
    const content = sheetContent.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setSheetHeight(
        Math.ceil(
          (content.getBoundingClientRect().height +
            SHEET_FRAME +
            GRID_INSET * 2) /
            CANVAS_CELL,
        ) *
          CANVAS_CELL -
          GRID_INSET * 2,
      );
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [draft.testimonialIds.length]);
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
      if (publish) setEmbed(true);
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
          {/* Saving is the frequent, harmless gesture and publishing the rare,
              committing one, so they read left to right in that order and
              neither hides in a menu: buried behind the dots, Save draft was
              the one thing nobody would ever find. */}
          <Button
            disabled={busy || !draft.name.trim()}
            onClick={() => void save(false)}
            variant="outline"
          >
            <IconDeviceFloppy className="size-4" />
            Save draft
          </Button>
          {widget.published ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setEmbed(true)}
            >
              <IconCode className="size-4" />
              Embed
            </Button>
          ) : null}
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
                        setEmbed(false);
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
            "border-line bg-surface min-h-0 min-w-0 overflow-y-auto p-5 disabled:opacity-70 lg:block lg:border-r",
            panel !== "edit" && "hidden",
          )}
        >
          <StudioGroup title="Content">
            {selected.length ? (
              <ul className="space-y-2">
                {selected
                  .slice(0, SHOWN_PROOF)
                  .map(({ testimonialId, card }) => (
                    <li
                      className="border-line bg-paper flex items-center gap-2.5 rounded-md border px-2.5 py-2"
                      key={testimonialId}
                    >
                      <Avatar className="size-7 shrink-0">
                        {card.avatarVisible !== false && card.avatarUrl ? (
                          <AvatarImage alt="" src={card.avatarUrl} />
                        ) : null}
                        <AvatarFallback className="bg-brand-soft text-brand-text text-[11px] font-semibold">
                          {initials(card.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="type-small min-w-0 flex-1 truncate">
                        {card.name}
                      </span>
                    </li>
                  ))}
                {selected.length > SHOWN_PROOF ? (
                  <li className="type-small text-ink-2 px-2.5">
                    and {selected.length - SHOWN_PROOF} more
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="type-small text-ink-2">
                No testimonials in this widget yet.
              </p>
            )}
            <Button
              className="w-full"
              onClick={(event) => {
                selectionOpener.current = event.currentTarget;
                setSelectionOpen(true);
              }}
              variant="outline"
            >
              <IconPencil className="size-4" />
              Edit selection
            </Button>
            <div className="space-y-2 pt-1">
              <Label htmlFor="widget-name">Widget name</Label>
              <Input
                id="widget-name"
                maxLength={80}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                value={draft.name}
              />
            </div>
          </StudioGroup>
          <StudioGroup title="Layout">
            <button
              className="border-line hover:bg-surface-2 focus-visible:ring-brand-ring flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors duration-(--motion-fast) ease-(--ease-out-soft) focus-visible:ring-3 focus-visible:outline-none"
              id="widget-template"
              onClick={() => setTemplateOpen(true)}
              type="button"
            >
              <span className="bg-surface-2 border-line grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-sm border p-1.5">
                <WidgetLayoutSketch layout={draft.config.layout} tiny />
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-small block truncate font-semibold">
                  {templateTitle(draft.config.layout)}
                </span>
                <span className="type-small text-ink-2 block truncate">
                  Change template
                </span>
              </span>
              <IconChevronDown className="text-ink-3 size-4 shrink-0" />
            </button>
          </StudioGroup>
          <StudioGroup title="Appearance">
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
          </StudioGroup>
          {draft.config.layout !== "avatars" ? (
            <StudioGroup last title="Behaviour">
              <label className="flex min-h-11 items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="type-small flex items-center gap-2 font-medium">
                    <IconLink className="text-ink-3 size-4" />
                    Clickable links
                  </span>
                  <span className="type-small text-ink-2 mt-0.5 block">
                    Mentions and links open in this widget. Disabled, the words
                    stay visible.
                  </span>
                </span>
                <Switch
                  checked={draft.config.testimonialLinksEnabled ?? true}
                  onCheckedChange={(enabled) =>
                    setConfig({ testimonialLinksEnabled: enabled })
                  }
                />
              </label>
            </StudioGroup>
          ) : null}
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
            <span className="type-small text-ink-2">
              Your page ·{" "}
              <span className="font-mono tabular-nums">{device.width}px</span>
            </span>
            <div className="flex gap-1" role="group" aria-label="Preview width">
              {previewWidths.map((item) => (
                <Button
                  ref={item.key === "phone" ? previewFocusTarget : undefined}
                  aria-label={`${item.label} preview`}
                  aria-pressed={item.key === device.key}
                  key={item.key}
                  onClick={() => setDeviceKey(item.key)}
                  size="icon"
                  variant={item.key === device.key ? "secondary" : "ghost"}
                >
                  <item.icon className="size-4" />
                </Button>
              ))}
            </div>
          </div>
          <div
            className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 lg:p-8"
            tabIndex={0}
            aria-label="Preview canvas"
            role="region"
          >
            <CanvasGrid alignTo={sheet} inset={GRID_INSET} />
            {!draft.testimonialIds.length ? (
              <div className="relative flex min-h-full flex-col items-center justify-center gap-6 py-6">
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
                    onClick={(event) => {
                      selectionOpener.current = event.currentTarget;
                      setSelectionOpen(true);
                    }}
                  >
                    Add testimonials
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-line bg-paper relative mx-auto my-auto w-full overflow-hidden rounded-lg border px-5 py-7 sm:px-7"
                ref={sheet}
                style={{
                  maxWidth: snapToCells(device.width),
                  minHeight: sheetHeight,
                }}
              >
                <div ref={sheetContent}>
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
                        return font?.url
                          ? { id: font.id, url: font.url }
                          : null;
                      })(),
                      brandName: props.brandName,
                      attributionRequired: props.attributionRequired,
                      testimonials: selected.map(({ card }) => card),
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      <WidgetSelectionDialog
        accentColor={draft.config.accentColor}
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = selectionOpener.current?.isConnected
            ? selectionOpener.current
            : previewFocusTarget.current;
          target?.focus();
        }}
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
      <Dialog onOpenChange={setTemplateOpen} open={templateOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a template</DialogTitle>
            <DialogDescription>
              Your testimonials and your colours stay as they are.
            </DialogDescription>
          </DialogHeader>
          <StudioTemplateChooser
            disabled={busy}
            freePlan={props.attributionRequired}
            onSelect={(template: StudioTemplate) => {
              setConfig({ layout: template.layout });
              setTemplateOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={embed} onOpenChange={setEmbed}>
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
