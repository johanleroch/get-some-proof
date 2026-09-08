"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  type Icon,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";

import { ArrowNote } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { sampleBrandName, sampleTestimonials } from "@/lib/template-samples";
import {
  accentPresets,
  defaultAccent,
  type TemplateDefinition,
  templateCategories,
  type WallTheme,
} from "@/lib/templates-catalog";
import { cn } from "@/lib/utils";

import { TemplateRender } from "./template-registry";
import { TemplateStage } from "./template-stage";

export type TemplatesGalleryMode = "kit" | "public";

type Segment<T extends string> = { icon: Icon; key: T; label: string };

const devices = [
  {
    icon: IconDeviceDesktop,
    key: "desktop",
    label: "Desktop",
    width: undefined,
  },
  { icon: IconDeviceTablet, key: "tablet", label: "Tablet", width: 768 },
  { icon: IconDeviceMobile, key: "phone", label: "Phone", width: 390 },
] as const;

type DeviceKey = (typeof devices)[number]["key"];

const themes: ReadonlyArray<Segment<WallTheme>> = [
  { icon: IconSun, key: "light", label: "Light" },
  { icon: IconMoon, key: "dark", label: "Dark" },
];

/** The selected template travels in the URL so a link opens on it. */
const queryKey = "template";

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function readRequestedSlug() {
  return new URLSearchParams(window.location.search).get(queryKey);
}

/**
 * A browser, not a wall of cards: the templates listed by family on the
 * left, one template rendered live on the right with a single action. The
 * stage takes the Brand accent, the wall theme and a preview width; the
 * arrow keys move through the list. `kit` adds every draft, the file and
 * status of each template, and the full-page link for the designer.
 */
export function TemplatesGallery({
  mode,
  templates,
}: {
  mode: TemplatesGalleryMode;
  templates: TemplateDefinition[];
}) {
  const requested = useSyncExternalStore(
    subscribeToLocation,
    readRequestedSlug,
    () => null,
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const [accent, setAccent] = useState<string>(defaultAccent);
  const [theme, setTheme] = useState<WallTheme>("light");
  const [deviceKey, setDeviceKey] = useState<DeviceKey>("desktop");

  const known = (slug: string | null) =>
    slug !== null && templates.some((template) => template.slug === slug);
  const currentSlug =
    (known(chosen) ? chosen : null) ??
    (known(requested) ? requested : null) ??
    templates[0]?.slug;
  const index = Math.max(
    0,
    templates.findIndex((template) => template.slug === currentSlug),
  );
  const template = templates[index];
  const previous = templates[index - 1];
  const next = templates[index + 1];
  const device = devices.find((candidate) => candidate.key === deviceKey);

  const select = useCallback((slug: string) => {
    setChosen(slug);
    const url = new URL(window.location.href);
    url.searchParams.set(queryKey, slug);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("[data-template-stage]"))
      ) {
        return;
      }
      if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        select(next.slug);
      } else if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        select(previous.slug);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, select]);

  if (!template) return null;

  const previewHref = {
    pathname: `/templates/${template.slug}`,
    query: { accent, theme },
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
      <nav
        aria-label="Templates"
        className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)] lg:self-start lg:overflow-y-auto"
      >
        <div className="-mx-5 flex scrollbar-none gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:hidden">
          {templates.map((candidate) => (
            <button
              aria-current={
                candidate.slug === template.slug ? "true" : undefined
              }
              className={cn(
                "focus-visible:ring-ring inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold tracking-[-0.008em] transition-[background-color,border-color,color] duration-150 outline-none focus-visible:ring-[3px]",
                candidate.slug === template.slug
                  ? "bg-ink border-ink text-paper"
                  : "bg-surface border-line-2 text-ink hover:bg-surface-2",
              )}
              key={candidate.slug}
              onClick={() => select(candidate.slug)}
              type="button"
            >
              {candidate.name}
            </button>
          ))}
        </div>
        <div className="hidden space-y-6 lg:block">
          {templateCategories.map((category) => {
            const items = templates.filter(
              (candidate) => candidate.category === category.key,
            );
            if (items.length === 0) return null;
            return (
              <div key={category.key}>
                <p className="type-micro text-ink-2 px-3 pb-2">
                  {category.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((candidate) => (
                    <li key={candidate.slug}>
                      <RailItem
                        active={candidate.slug === template.slug}
                        mode={mode}
                        onSelect={select}
                        template={candidate}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>

      <section aria-labelledby="template-title" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="max-w-prose min-w-0 space-y-1">
            <h2 className="type-heading text-balance" id="template-title">
              {template.name}
            </h2>
            <p className="type-body text-ink-2">{template.description}</p>
            {mode === "kit" ? (
              <p className="text-ink-2 font-mono text-[12px]">
                {template.file} · {template.status}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {mode === "public" ? (
              <Button asChild size="sm">
                <Link href={previewHref}>Open preview</Link>
              </Button>
            ) : (
              <>
                {template.status === "public" ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      href={{
                        pathname: "/templates",
                        query: { template: template.slug },
                      }}
                    >
                      See it on the public page
                    </Link>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={previewHref}>Open full page</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Segmented
            className="hidden lg:inline-flex"
            label="Preview width"
            onChange={setDeviceKey}
            options={devices}
            value={deviceKey}
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center">
              <span className="type-small text-ink-2 mr-1">Accent</span>
              <ColorPicker
                legend="Brand accent for the preview"
                onChange={setAccent}
                presets={accentPresets}
                value={accent}
              />
            </div>
            <Segmented
              label="Wall theme"
              onChange={setTheme}
              options={themes}
              value={theme}
            />
          </div>
        </div>

        <ArrowNote className="-mb-1 hidden md:inline-flex">
          this is what your visitors see
        </ArrowNote>

        {/* The frame takes the device width, not the stage alone: capping
            only the stage left a desktop-wide card with a phone-wide preview
            marooned in the middle of it. The calc gives back the frame's own
            padding and the stage's hairline, so the stage lands exactly on
            the device width and its container queries still see it. Desktop
            is `100%`, never `none`: a keyword has no value to travel from, so
            the frame would jump to the tablet width instead of settling into
            it. Percentages and lengths interpolate, so the width stays free
            and the move keeps its rebound. */}
        <div
          className="bg-surface-2 mx-auto rounded-lg border p-3 transition-[max-width] duration-[var(--motion-settle)] ease-[var(--ease-settle-soft)] [--frame-pad:0.75rem] motion-reduce:transition-none sm:p-5 sm:[--frame-pad:1.25rem]"
          style={{
            maxWidth: device?.width
              ? `calc(${device.width}px + 2 * var(--frame-pad) + 2px)`
              : "100%",
          }}
        >
          <TemplateStage
            accentColor={accent}
            centered={template.preview === "center"}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-lg border duration-[var(--motion-settle)] ease-[var(--ease-settle-soft)]"
            key={template.slug}
            theme={theme}
          >
            <TemplateRender
              accentColor={accent}
              brandName={sampleBrandName}
              slug={template.slug}
              testimonials={sampleTestimonials}
            />
          </TemplateStage>
        </div>
      </section>
    </div>
  );
}

function RailItem({
  active,
  mode,
  onSelect,
  template,
}: {
  active: boolean;
  mode: TemplatesGalleryMode;
  onSelect: (slug: string) => void;
  template: TemplateDefinition;
}) {
  return (
    <button
      aria-current={active ? "true" : undefined}
      className={cn(
        "type-ui focus-visible:ring-ring relative flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px]",
        active
          ? "bg-brand-soft text-ink before:bg-brand font-semibold before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[3px] before:rounded-full"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
      onClick={() => onSelect(template.slug)}
      type="button"
    >
      <span className="truncate">{template.name}</span>
      {mode === "kit" && template.status === "draft" ? (
        <span
          aria-label="Draft"
          className="bg-warning ml-auto size-1.5 shrink-0 rounded-full"
          role="img"
        />
      ) : null}
    </button>
  );
}

function Segmented<T extends string>({
  className,
  label,
  onChange,
  options,
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<Segment<T>>;
  value: T;
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "bg-surface-2 inline-flex h-11 items-center gap-1 rounded-md p-1",
        className,
      )}
      role="group"
    >
      {options.map((option) => {
        const active = option.key === value;
        const OptionIcon = option.icon;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border px-3 text-sm font-semibold tracking-[-0.008em] transition-[background-color,border-color,color] duration-150 outline-none focus-visible:ring-[3px]",
              active
                ? "bg-surface border-line text-ink"
                : "text-ink-2 hover:text-ink border-transparent",
            )}
            key={option.key}
            onClick={() => onChange(option.key)}
            type="button"
          >
            <OptionIcon aria-hidden="true" className="size-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
