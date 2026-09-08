"use client";

import { type ReactNode, useState } from "react";
import { IconPhotoUp } from "@tabler/icons-react";

import type { TestimonialCardVideoValue } from "@convex/testimonialCardValue";
import { Sparkle } from "@/components/doodles";
import { WallCardMiniature } from "@/components/testimonials/wall-card-miniature";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cardDesignSamples } from "@/lib/card-design-samples";
import { cn } from "@/lib/utils";

/**
 * Development review of the thumbnail dialog (DESIGN.md section 7): six ways
 * to keep the eight moments and the preview from reading as one grid of nine.
 * Every variant is the real dialog frame, copy and controls; only the body
 * changes. Pick one here, then port it into
 * `src/components/testimonials/video-thumbnail-dialog.tsx`.
 */

const sampleAccent = "#0f766e";
const playbackId = "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y";
const duration = 96;
const frames = Array.from(
  { length: 8 },
  (_, index) => Math.round((((index + 0.5) / 8) * duration) / 0.5) * 0.5,
);
const video = cardDesignSamples
  .map((sample) => sample.testimonial)
  .find(
    (testimonial): testimonial is TestimonialCardVideoValue =>
      testimonial.type === "video",
  )!;

function frameUrl(timeSeconds: number, width = 240) {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}&time=${timeSeconds}`;
}

function formatTime(seconds: number) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The dialog as it really is: surface, hairline, float shadow, 24px, 576px. */
function DialogShell({
  body,
  wide = false,
}: {
  body: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-surface text-foreground shadow-float w-full space-y-4 rounded-lg border p-6",
        wide ? "max-w-2xl" : "max-w-xl",
      )}
    >
      <div className="space-y-1.5">
        <h3 className="type-heading">Choose a thumbnail</h3>
        <p className="type-body text-ink-2">
          What a visitor sees before they press play on Maya Chen&apos;s video.
          Pick a moment of the video, or upload an image.
        </p>
      </div>
      {body}
      <div className="flex items-center gap-2 pt-1">
        <p className="text-ink-2 type-small mr-auto">
          Saving updates your Public Wall right away.
        </p>
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </div>
    </div>
  );
}

function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("type-ui", className)}>{children}</p>;
}

function Moments({
  columns = 4,
  onSelect,
  selected,
}: {
  columns?: 4 | 8;
  onSelect: (timeSeconds: number) => void;
  selected: number;
}) {
  return (
    <div
      aria-label="Moments of the video"
      className={cn(
        "grid gap-2",
        columns === 8 ? "grid-cols-8" : "grid-cols-4",
      )}
      role="radiogroup"
    >
      {frames.map((frameTime) => {
        const active = frameTime === selected;
        return (
          <button
            aria-checked={active}
            aria-label={`Moment at ${formatTime(frameTime)}`}
            className={cn(
              "focus-visible:ring-ring relative aspect-[9/16] cursor-pointer overflow-hidden rounded-md border bg-black transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-[3px]",
              active
                ? "border-brand ring-brand-ring ring-[3px]"
                : "border-line hover:border-line-2",
            )}
            key={frameTime}
            onClick={() => onSelect(frameTime)}
            role="radio"
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              src={frameUrl(frameTime)}
            />
          </button>
        );
      })}
    </div>
  );
}

function Still({
  className,
  timeSeconds,
}: {
  className?: string;
  timeSeconds: number;
}) {
  return (
    <div
      aria-label="Chosen thumbnail"
      className={cn(
        "relative aspect-[9/16] overflow-hidden rounded-md border bg-black",
        className,
      )}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        src={frameUrl(timeSeconds, 960)}
      />
    </div>
  );
}

function UploadRow({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}
    >
      <Button size="sm" variant="outline">
        <IconPhotoUp aria-hidden="true" />
        Upload an image
      </Button>
      <p className="type-small text-ink-2">JPEG, PNG or WebP, 5 MB max.</p>
    </div>
  );
}

function Caption({
  className,
  timeSeconds,
}: {
  className?: string;
  timeSeconds: number;
}) {
  return (
    <p className={cn("type-small text-ink-2", className)}>
      Moment at {formatTime(timeSeconds)}
    </p>
  );
}

function useChoice() {
  return useState(frames[3]!);
}

/** A. A hairline rules the preview off, with 24px of air on each side. */
function RuleBetween() {
  const [selected, setSelected] = useChoice();
  return (
    <DialogShell
      body={
        <div className="flex gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Moment of the video</Label>
            <Moments onSelect={setSelected} selected={selected} />
            <UploadRow className="pt-2" />
          </div>
          <div
            aria-hidden="true"
            className="border-line self-stretch border-l"
          />
          <div className="w-36 shrink-0 space-y-2">
            <Label>Preview</Label>
            <Still timeSeconds={selected} />
            <Caption timeSeconds={selected} />
          </div>
        </div>
      }
    />
  );
}

/** B. Two steps, stacked: choose above the rule, check below it. */
function TwoSteps() {
  const [selected, setSelected] = useChoice();
  return (
    <DialogShell
      body={
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>1. Pick a moment of the video</Label>
            <Moments columns={8} onSelect={setSelected} selected={selected} />
            <UploadRow className="pt-1" />
          </div>
          <hr className="border-line" />
          <div className="flex items-start gap-4">
            <Still className="w-24 shrink-0" timeSeconds={selected} />
            <div className="space-y-1 pt-1">
              <Label>2. Check the thumbnail</Label>
              <Caption timeSeconds={selected} />
              <p className="type-small text-ink-2">
                This is the still a visitor sees on your Public Wall.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}

/** C. The preview is the real card: stars, name, play button. Not a tile. */
function OnTheCard() {
  const [selected, setSelected] = useChoice();
  return (
    <DialogShell
      body={
        <div className="flex gap-8">
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Moment of the video</Label>
            <Moments onSelect={setSelected} selected={selected} />
            <UploadRow className="pt-2" />
          </div>
          <div className="w-52 shrink-0 space-y-2">
            <Label>On your Public Wall</Label>
            <WallCardMiniature
              accentColor={sampleAccent}
              testimonial={{ ...video, posterTimeSeconds: selected }}
              width={208}
            />
          </div>
        </div>
      }
      wide
    />
  );
}

/** D. One quiet inset: the preview sits on paper tint, the choices on white. */
function InsetPreview() {
  const [selected, setSelected] = useChoice();
  return (
    <DialogShell
      body={
        <div className="flex gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Moment of the video</Label>
            <Moments onSelect={setSelected} selected={selected} />
            <UploadRow className="pt-2" />
          </div>
          <div className="bg-surface-2 w-44 shrink-0 space-y-2 self-start rounded-lg p-3">
            <Label>Preview</Label>
            <Still timeSeconds={selected} />
            <Caption timeSeconds={selected} />
          </div>
        </div>
      }
    />
  );
}

/** E. Numbered, and nothing but whitespace between the two: 40px of air. */
function NumberedAir() {
  const [selected, setSelected] = useChoice();
  return (
    <DialogShell
      body={
        <div className="flex gap-10">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2">
              <Label>
                <span className="text-ink-3 mr-2 font-mono">1</span>Pick a
                moment
              </Label>
              <Moments onSelect={setSelected} selected={selected} />
            </div>
            <div className="space-y-2">
              <Label>
                <span className="text-ink-3 mr-2 font-mono">2</span>Or upload an
                image
              </Label>
              <UploadRow />
            </div>
          </div>
          <div className="w-32 shrink-0 space-y-2">
            <Label>How it will look</Label>
            <Still timeSeconds={selected} />
            <Caption timeSeconds={selected} />
          </div>
        </div>
      }
    />
  );
}

/** F. The current thumbnail first and large; the choices to its right. */
function PreviewFirst() {
  const [selected, setSelected] = useChoice();
  return (
    <DialogShell
      body={
        <div className="flex gap-6">
          <div className="w-44 shrink-0 space-y-2">
            <Label>Current thumbnail</Label>
            <Still timeSeconds={selected} />
            <Caption timeSeconds={selected} />
          </div>
          <div
            aria-hidden="true"
            className="border-line self-stretch border-l"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Pick another moment</Label>
            <Moments onSelect={setSelected} selected={selected} />
            <UploadRow className="pt-2" />
          </div>
        </div>
      }
    />
  );
}

const variants = [
  {
    Render: RuleBetween,
    key: "rule",
    name: "A · Rule between",
    note: "A vertical hairline and 24px on each side. The lightest separation the system has; the labels stay where they are.",
  },
  {
    Render: TwoSteps,
    key: "steps",
    name: "B · Two steps",
    note: "Stacked: the eight moments in one row, a rule, then the preview as a second step with its own sentence. Reads top to bottom like a form.",
  },
  {
    Render: OnTheCard,
    key: "card",
    name: "C · On the real card — shipped",
    note: "The preview is the published card itself — stars, name, play button — so it cannot be mistaken for a ninth tile. Needs the wider dialog (672px).",
  },
  {
    Render: InsetPreview,
    key: "inset",
    name: "D · Inset preview",
    note: "One quiet panel on paper tint for the preview only, the choices stay on white. The one place DESIGN.md allows a muted fill.",
  },
  {
    Render: NumberedAir,
    key: "air",
    name: "E · Numbered, whitespace",
    note: "Steps 1 and 2 on the left, the preview on the right, and 40px of nothing between them. No rule, no fill: the numbering does the work.",
  },
  {
    Render: PreviewFirst,
    key: "first",
    name: "F · Preview first",
    note: "What you have on the left, large; what you can pick on the right. The eye lands on the current thumbnail before the choices.",
  },
] as const;

export function ThumbnailDialogVariants() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading flex items-center gap-2">
              Thumbnail dialog
              <Sparkle className="text-brand size-5" />
            </h1>
            <p className="text-muted-foreground type-small">
              {variants.length} ways to keep the moments and the preview apart.
              Development only.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/kit">Kit</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/kit/testimonials">Testimonial card</a>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-14 px-6 py-10">
        {variants.map((variant) => (
          <section className="space-y-5" key={variant.key}>
            <div className="max-w-prose space-y-1">
              <h2 className="type-heading">{variant.name}</h2>
              <p className="type-body text-ink-2">{variant.note}</p>
            </div>
            <div className="bg-surface-2 rounded-lg border p-8">
              <variant.Render />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
