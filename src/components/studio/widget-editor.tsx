"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  IconArrowLeft,
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconTrash,
} from "@tabler/icons-react";
import type { WidgetConfig } from "@convex/domain/widgets";
import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { WidgetPreview } from "./widget-preview";

import type { StudioDraft, StudioViewProps, StudioWidget } from "./studio-view";

function hasHighlight(card: TestimonialCardValue) {
  return (
    card.type === "text" &&
    card.richText?.some((block) =>
      block.children.some((leaf) => leaf.highlight && leaf.text.trim()),
    )
  );
}
export function WidgetEditor(
  props: StudioViewProps & { widget: StudioWidget },
) {
  const { widget } = props;
  const router = useRouter();
  const leaveHref = useRef<string | null>(null);
  const [draft, setDraft] = useState<StudioDraft>({
    name: widget.name,
    ...widget.draft,
  });
  const revision = useRef(widget.revision);
  const [mobile, setMobile] = useState(false);
  const [panel, setPanel] = useState<"edit" | "preview">(
    props.initialPreview ? "preview" : "edit",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [share, setShare] = useState(false);
  const [leave, setLeave] = useState(false);
  const [search, setSearch] = useState("");
  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify({ name: widget.name, ...widget.draft });
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
  const selectedIds = new Set(draft.testimonialIds);
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
    setNotice("");
  }
  async function save(publish: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await props.onSave(widget._id, draft, revision.current, publish);
      revision.current += 1;
      setDraft((current) => ({
        ...current,
        name: current.name === draft.name ? draft.name.trim() : current.name,
      }));
      setNotice(
        publish ? "Published. Your embed is up to date." : "Draft saved.",
      );
      if (publish) setShare(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, offset: number) {
    const ids = [...draft.testimonialIds];
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    setDraft({ ...draft, testimonialIds: ids });
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied.");
    } catch {
      setError("Could not copy. Select and copy the code below.");
    }
  }
  const url = `${props.origin}/widgets/${widget.publicId}`;
  const snippet = `<div data-gsp-widget="${widget.publicId}"></div>\n<script src="${props.origin}/embed/v2.js" async></script>`;
  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <header className="border-line mb-6 space-y-4 border-b pb-5">
        <div className="flex items-start gap-3">
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
          <h1 className="type-display min-w-0 flex-1 break-words">
            {widget.name}
          </h1>
          <Badge variant={widget.published ? "success" : "neutral"}>
            {widget.published ? "Published" : "Draft"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={busy}
            disabled={busy || !draft.name.trim()}
            onClick={() => void save(false)}
          >
            Save draft
          </Button>
          <Button
            loading={busy}
            disabled={
              busy ||
              !draft.name.trim() ||
              !draft.testimonialIds.length ||
              !!eligibility
            }
            onClick={() => void save(true)}
          >
            {widget.published ? "Publish changes" : "Publish"}
          </Button>
          {widget.published ? (
            <Button variant="ghost" onClick={() => setShare(true)}>
              Share
            </Button>
          ) : null}
        </div>
      </header>
      {error ? (
        <p role="alert" className="text-danger type-small mb-4">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-success type-small mb-4">
          {notice}
        </p>
      ) : null}
      <div
        className="bg-paper sticky top-0 z-10 mb-5 flex gap-2 py-2 lg:hidden"
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
      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <fieldset
          id="widget-edit-panel"
          disabled={busy}
          className={cn(
            "min-w-0 space-y-6 disabled:opacity-70 lg:block",
            panel !== "edit" && "hidden",
          )}
        >
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
                  <SelectItem key={item.layout} value={item.layout}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
          <section className="border-line space-y-4 border-t pt-5">
            <h2 className="type-subheading">Appearance</h2>
            <div className="space-y-2">
              <Label htmlFor="widget-font">Font</Label>
              <Select
                disabled={busy}
                value={draft.config.font}
                onValueChange={(font) =>
                  setConfig({ font: font as WidgetConfig["font"] })
                }
              >
                <SelectTrigger id="widget-font" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Match your website</SelectItem>
                  <SelectItem value="sans">Sans serif</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="mono">Monospace</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          <section className="border-line space-y-3 border-t pt-5">
            <div className="flex items-center justify-between">
              <h2 className="type-subheading">Testimonials</h2>
              <span className="text-ink-2 type-small">
                {draft.testimonialIds.length} / 50
              </span>
            </div>
            <p className="type-small text-ink-2">
              Only published proof appears in widgets.
            </p>
            {eligibility ? (
              <p role="status" className="text-warning type-small">
                {eligibility}
              </p>
            ) : null}
            {draft.testimonialIds.length ? (
              <ol className="space-y-2" aria-label="Selected testimonials">
                {draft.testimonialIds.map((id, index) => (
                  <li
                    className="border-line bg-surface flex items-center gap-1 rounded-md border p-2"
                    key={id}
                  >
                    <span className="type-small min-w-0 flex-1 truncate">
                      {index + 1}.{" "}
                      {byId.get(id)?.name ?? "Unavailable testimonial"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${byId.get(id)?.name ?? "testimonial"} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <IconArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${byId.get(id)?.name ?? "testimonial"} down`}
                      disabled={index === draft.testimonialIds.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <IconArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${byId.get(id)?.name ?? "testimonial"}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          testimonialIds: draft.testimonialIds.filter(
                            (item) => item !== id,
                          ),
                        })
                      }
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            ) : null}
            <Input
              aria-label="Search testimonials"
              placeholder="Search loaded testimonials"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {props.candidates
                .filter(({ card }) =>
                  `${card.name} ${card.type === "text" ? card.text : "video"}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map(({ testimonialId, card }) => {
                  const checked = selectedIds.has(testimonialId);
                  const disabled =
                    !checked &&
                    (draft.testimonialIds.length >= 50 ||
                      (draft.config.layout === "highlights" &&
                        !hasHighlight(card)));
                  return (
                    <label
                      key={testimonialId}
                      className={cn(
                        "hover:bg-surface-2 flex cursor-pointer items-start gap-3 rounded-md p-2",
                        disabled && "opacity-50",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        aria-label={`Select ${card.name}`}
                        onCheckedChange={(checked) =>
                          setDraft({
                            ...draft,
                            testimonialIds: checked
                              ? draft.config.layout === "individual"
                                ? [testimonialId]
                                : [...draft.testimonialIds, testimonialId]
                              : draft.testimonialIds.filter(
                                  (id) => id !== testimonialId,
                                ),
                          })
                        }
                      />
                      <span className="min-w-0">
                        <span className="type-ui block">{card.name}</span>
                        <span className="type-small text-ink-2 line-clamp-2">
                          {card.type === "text"
                            ? card.text
                            : "Video testimonial"}
                        </span>
                      </span>
                    </label>
                  );
                })}
            </div>
            {props.hasMore ? (
              <Button
                variant="outline"
                loading={props.loadingMore}
                onClick={props.onLoadMore}
              >
                Load more testimonials
              </Button>
            ) : null}
            {!props.candidates.length ? (
              <p className="type-small text-ink-2">
                Publish a testimonial in your{" "}
                <a className="underline" href={props.inboxHref}>
                  Inbox
                </a>{" "}
                to add it here.
              </p>
            ) : null}
          </section>
        </fieldset>
        <section
          id="widget-preview-panel"
          className={cn(
            "border-line bg-surface-2 overflow-hidden rounded-lg border lg:sticky lg:top-6 lg:block",
            panel !== "preview" && "hidden",
          )}
          aria-label="Widget preview"
        >
          <div className="border-line bg-surface flex items-center justify-between gap-3 border-b p-3">
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
          <div className="min-h-80 p-3 sm:p-5">
            <div
              className="mx-auto overflow-hidden rounded-lg"
              style={{ maxWidth: mobile ? 390 : "100%" }}
            >
              <WidgetPreview
                value={{
                  config: draft.config,
                  brandName: props.brandName,
                  attributionRequired: props.attributionRequired,
                  testimonials: selected.map(({ card }) => card),
                }}
              />
            </div>
          </div>
          <p className="text-ink-2 type-small px-5 pb-4">
            {dirty
              ? "Previewing your changes. Publish when ready."
              : "Your saved draft. Publish to make it live."}
          </p>
        </section>
      </div>
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
          <Textarea
            id="widget-code"
            readOnly
            value={snippet}
            className="border-line bg-surface-2 min-h-28 w-full rounded-md border p-3 font-mono text-xs"
          />
          <Button onClick={() => void copy(snippet)}>
            <IconCopy className="size-4" />
            Copy embed code
          </Button>
          <Label htmlFor="widget-link">Public link</Label>
          <Input id="widget-link" readOnly value={url} />
          <Button variant="outline" onClick={() => void copy(url)}>
            Copy link
          </Button>
          <p className="type-small text-ink-2">
            Published changes appear on the next load. Your installation code
            stays the same.
          </p>
          {widget.published ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void props
                  .onUnpublish(widget._id)
                  .then((nextRevision) => {
                    revision.current = nextRevision;
                    setShare(false);
                    setNotice("Widget unpublished.");
                  })
                  .catch(() => setError("Could not unpublish. Try again."))
                  .finally(() => setBusy(false));
              }}
            >
              Unpublish widget
            </Button>
          ) : null}
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
