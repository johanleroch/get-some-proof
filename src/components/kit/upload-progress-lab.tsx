"use client";

import { useEffect, useState } from "react";

import { AnimatedBlob } from "@/components/brand/animated-blob";
import { SegmentedControl } from "@/components/dev/dev-controls";
import { Button } from "@/components/ui/button";
import { VideoUploadProgress } from "@/components/collection/video-upload-progress";
import { cn } from "@/lib/utils";

/**
 * Development lab for the video upload wait (DESIGN.md sections 4, 7 and 8):
 * four takes on the same moment, played side by side on the same progress so
 * the founder can compare them moving, not as stills. Throwaway: once a
 * direction is picked, it moves into `video-upload-progress.tsx` and this
 * file goes.
 */

type Phase = "uploading" | "processing";

const UPLOADING_HELP = "Keep this page open until the upload reaches 100%.";
const PROCESSING_HELP = "Processing and captions continue in the background.";

/** The shared bar: scaleX rather than width, so only transforms animate. */
function Track({
  className,
  done,
  height = "h-2",
  percentage,
}: {
  className?: string;
  done: boolean;
  height?: string;
  percentage: number;
}) {
  const value = done ? 100 : percentage;
  return (
    <div
      aria-label="Video upload progress"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className={cn("bg-line overflow-hidden rounded-full", height, className)}
      role="progressbar"
    >
      <div
        className={cn(
          "h-full origin-left rounded-full transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
          done ? "bg-success" : "bg-(--brand-accent)",
        )}
        style={{ transform: `scaleX(${value / 100})` }}
      />
    </div>
  );
}

/**
 * A. The line. The mascot stops floating and joins the text: one left edge,
 * the percentage on the label's baseline, the helper line indented to the
 * same column. Nothing new, everything aligned.
 */
function VariantLine({
  onCancel,
  percentage,
  phase,
}: {
  onCancel?: () => void;
  percentage: number;
  phase: Phase;
}) {
  const uploading = phase === "uploading";
  return (
    <div className="bg-surface-2 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <AnimatedBlob size={36} variant={uploading ? "look" : "breathe"} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">
              {uploading ? "Uploading your video" : "Video uploaded"}
            </p>
            <span className="text-ink-2 text-sm tabular-nums">
              {uploading ? `${percentage}%` : "Processing…"}
            </span>
          </div>
          <Track done={!uploading} percentage={percentage} />
        </div>
      </div>
      <div className="mt-3 flex flex-col items-start gap-2 pl-12 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-ink-2 text-xs">
          {uploading ? UPLOADING_HELP : PROCESSING_HELP}
        </p>
        {uploading && onCancel ? (
          <Button onClick={onCancel} size="xs" type="button" variant="ghost">
            Cancel upload
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * B. The blob pulls the bar. The mascot rides the head of the fill and lands
 * on the end: the wait is told by the character, not by a number. It travels
 * on a transform, so the move stays on the compositor and freezes flat under
 * reduced motion.
 */
function VariantRider({
  onCancel,
  percentage,
  phase,
}: {
  onCancel?: () => void;
  percentage: number;
  phase: Phase;
}) {
  const uploading = phase === "uploading";
  const position = uploading ? percentage : 100;
  return (
    <div className="bg-surface-2 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">
          {uploading ? "Uploading your video" : "Video uploaded"}
        </p>
        <span className="text-ink-2 text-sm tabular-nums">
          {uploading ? `${percentage}%` : "Processing…"}
        </span>
      </div>
      {/* Clipped at the lane, which is exactly where the blob stops. */}
      <div className="relative mt-3 h-9 overflow-hidden">
        {/* Runs on (100% − blob width), so the blob lands flush at 100%. */}
        <div className="absolute inset-y-0 right-7 left-0">
          <div
            className="h-full w-full transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)] motion-reduce:transition-none"
            style={{ transform: `translateX(${position}%)` }}
          >
            <AnimatedBlob
              className="absolute bottom-0 left-0"
              size={28}
              variant={uploading ? "bounce" : "breathe"}
            />
          </div>
        </div>
      </div>
      <Track className="mt-1" done={!uploading} percentage={percentage} />
      <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-ink-2 text-xs">
          {uploading ? UPLOADING_HELP : PROCESSING_HELP}
        </p>
        {uploading && onCancel ? (
          <Button onClick={onCancel} size="xs" type="button" variant="ghost">
            Cancel upload
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * C. The counter. No mascot at all: the number carries the wait, set in
 * Gelica at KPI size with tabular figures so it never jiggles, over a
 * hairline track. The quiet one, for a Submitter who just wants it done.
 */
function VariantCounter({
  onCancel,
  percentage,
  phase,
}: {
  onCancel?: () => void;
  percentage: number;
  phase: Phase;
}) {
  const uploading = phase === "uploading";
  return (
    <div className="bg-surface-2 rounded-lg border p-5">
      <p className="text-ink-2 text-sm">
        {uploading ? "Uploading your video" : "Video uploaded"}
      </p>
      <p className="type-kpi text-ink mt-1">{uploading ? percentage : 100}%</p>
      <Track
        className="mt-4"
        done={!uploading}
        height="h-1"
        percentage={percentage}
      />
      <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-ink-2 text-xs">
          {uploading ? UPLOADING_HELP : PROCESSING_HELP}
        </p>
        {uploading && onCancel ? (
          <Button onClick={onCancel} size="xs" type="button" variant="ghost">
            Cancel upload
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * D. The steps. Borrows the Collection Form's own language (section 6:
 * progress is a row of pills, not a percentage line): upload, processing,
 * ready. It answers the question the percentage never does — what happens
 * after 100 percent.
 */
function VariantSteps({
  onCancel,
  percentage,
  phase,
}: {
  onCancel?: () => void;
  percentage: number;
  phase: Phase;
}) {
  const uploading = phase === "uploading";
  const steps = [
    { fill: uploading ? percentage : 100, label: "Upload", waiting: false },
    { fill: 0, label: "Processing", waiting: !uploading },
    { fill: 0, label: "Ready", waiting: false },
  ];
  const current = uploading ? 0 : 1;
  return (
    <div className="bg-surface-2 space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <AnimatedBlob size={24} variant={uploading ? "look" : "breathe"} />
        <p className="text-sm font-medium">
          {uploading ? "Uploading your video" : "Processing your video"}
        </p>
        <span className="text-ink-2 ml-auto text-sm tabular-nums">
          {uploading ? `${percentage}%` : "Almost there"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step, index) => (
          <div className="space-y-2" key={step.label}>
            <div
              className={cn(
                "h-1.5 overflow-hidden rounded-full",
                step.waiting ? "bg-brand-soft" : "bg-line",
              )}
            >
              <div
                className={cn(
                  "h-full origin-left rounded-full transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                  index < current ? "bg-success" : "bg-(--brand-accent)",
                )}
                style={{ transform: `scaleX(${step.fill / 100})` }}
              />
            </div>
            <p
              className={cn(
                "type-micro",
                index === current ? "text-ink" : "text-ink-3",
              )}
            >
              {step.label}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-ink-2 text-xs">
          {uploading ? UPLOADING_HELP : PROCESSING_HELP}
        </p>
        {uploading && onCancel ? (
          <Button onClick={onCancel} size="xs" type="button" variant="ghost">
            Cancel upload
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const variants = [
  {
    Component: VariantLine,
    id: "line",
    note: "The mascot joins the text instead of floating above it: one left edge, the percentage on the baseline, the helper line in the same column.",
    title: "A · The line",
  },
  {
    Component: VariantRider,
    id: "rider",
    note: "The blob rides the head of the fill and lands on the end. The character tells the wait; the number only confirms it.",
    title: "B · The blob pulls the bar",
  },
  {
    Component: VariantCounter,
    id: "counter",
    note: "No mascot. The percentage in Gelica carries the moment over a hairline track — the quiet one.",
    title: "C · The counter",
  },
  {
    Component: VariantSteps,
    id: "steps",
    note: "The Collection Form's own pills: upload, processing, ready. Answers what happens after 100 percent.",
    title: "D · The steps",
  },
] as const;

export function UploadProgressLab() {
  const [phase, setPhase] = useState<Phase>("uploading");
  const [percentage, setPercentage] = useState(46);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPercentage((value) => {
        if (value >= 100) {
          setPhase("processing");
          setPlaying(false);
          return 100;
        }
        return Math.min(100, value + 2);
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <main className="bg-paper min-h-svh px-5 py-10 [--brand-accent:var(--brand)] sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <h1 className="type-display">The upload wait, four ways</h1>
          <p className="type-body text-ink-2 max-w-2xl">
            The Submitter has just recorded a Testimonial and is watching this
            block. Same progress in all four, played together. Development page.
          </p>
        </header>

        <div className="bg-surface flex flex-wrap items-center gap-4 rounded-lg border p-4">
          <SegmentedControl
            ariaLabel="Phase"
            onChange={(value: Phase) => setPhase(value)}
            options={[
              { label: "Uploading", value: "uploading" },
              { label: "Processing", value: "processing" },
            ]}
            value={phase}
          />
          <label className="flex flex-1 items-center gap-3 text-sm">
            <span className="text-ink-2">Progress</span>
            <input
              className="accent-brand h-1 flex-1"
              max={100}
              min={0}
              onChange={(event) => {
                setPlaying(false);
                setPercentage(Number(event.target.value));
              }}
              type="range"
              value={percentage}
            />
            <span className="w-10 tabular-nums">{percentage}%</span>
          </label>
          <Button
            onClick={() => {
              if (playing) {
                setPlaying(false);
                return;
              }
              setPhase("uploading");
              setPercentage(0);
              setPlaying(true);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {playing ? "Stop" : "Play an upload"}
          </Button>
        </div>

        <section className="space-y-4">
          <h2 className="type-subheading text-ink-2">Today</h2>
          <div className="max-w-[520px]">
            <VideoUploadProgress
              onCancel={() => undefined}
              phase={phase}
              progress={percentage}
            />
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {variants.map(({ Component, id, note, title }) => (
            <section className="space-y-3" key={id}>
              <div className="space-y-1">
                <h2 className="type-subheading">{title}</h2>
                <p className="text-ink-2 max-w-[520px] text-sm">{note}</p>
              </div>
              <div className="max-w-[520px]">
                <Component
                  onCancel={() => undefined}
                  percentage={percentage}
                  phase={phase}
                />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
