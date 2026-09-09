"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useId, useState } from "react";
import { IconCheck, IconColorPicker } from "@tabler/icons-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { accentInk } from "@/lib/color-contrast";
import { type Hsv, hexToHsv, hsvToHex, normalizeHex } from "@/lib/color-hsv";
import { cn } from "@/lib/utils";

export type ColorPreset = { label: string; value: string };

function clamp(value: number, max: number) {
  return Math.min(max, Math.max(0, value));
}

function fraction(event: PointerEvent<HTMLElement>, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 1),
  };
}

/**
 * The panel behind the custom well: a square for how vivid and how bright, a
 * slider for which colour, and the hex itself for anyone who already knows the
 * value. Our own surface and type rather than the operating system's dark
 * panel, which arrived in the OS font, in the OS blue, and told the customer
 * they had left the product (DESIGN.md sections 7 and 10).
 */
function ColorPanel({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const hexId = useId();
  const [hsv, setHsv] = useState<Hsv>(
    () => hexToHsv(value) ?? { h: 0, s: 0, v: 0 },
  );
  const [lastHex, setLastHex] = useState(value);
  const [typed, setTyped] = useState<string | null>(null);

  // A value arriving from outside — a preset, a reset — re-seeds the square.
  // The hue is kept when the new colour has none of its own, so landing on
  // white or black does not throw the slider back to red.
  if (value.toLowerCase() !== lastHex.toLowerCase()) {
    setLastHex(value);
    setTyped(null);
    const next = hexToHsv(value);
    if (next) {
      setHsv((current) => ({
        ...next,
        h: next.s === 0 || next.v === 0 ? current.h : next.h,
      }));
    }
  }

  function commit(next: Hsv) {
    const hex = hsvToHex(next);
    setHsv(next);
    setLastHex(hex);
    setTyped(null);
    onChange(hex);
  }

  function pick(event: PointerEvent<HTMLDivElement>) {
    const { x, y } = fraction(event, event.currentTarget);
    commit({ ...hsv, s: x * 100, v: (1 - y) * 100 });
  }

  const hex = hsvToHex(hsv);

  return (
    <div className="space-y-3">
      {/* Pointer users choose both axes together. Native ranges below expose
          each axis and its value to keyboard and assistive technology users. */}
      <div
        aria-hidden="true"
        className="border-line relative h-36 w-full cursor-crosshair touch-none rounded-md border"
        role="presentation"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            pick(event);
          }
        }}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)`,
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
          style={{
            background: hex,
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
          }}
        />
      </div>

      {/* Reveal both controls when either receives focus, keeping keyboard
          focus visible without changing the pointer-oriented panel layout. */}
      <div className="sr-only focus-within:not-sr-only focus-within:space-y-2">
        {(
          [
            { axis: "s", label: "Saturation" },
            { axis: "v", label: "Brightness" },
          ] as const
        ).map(({ axis, label }) => (
          <label className="type-small block" key={axis}>
            <span>{label}</span>
            <input
              aria-valuetext={`${Math.round(hsv[axis])}%`}
              className="focus-visible:ring-ring accent-ink block h-11 w-full outline-none focus-visible:ring-[3px]"
              max={100}
              min={0}
              onChange={(event) =>
                commit({ ...hsv, [axis]: Number(event.target.value) })
              }
              step={1}
              type="range"
              value={Math.round(hsv[axis])}
            />
          </label>
        ))}
      </div>

      {/* A real range input: the hue is one axis, so the accessible control
          for it already exists and only wants our paint. The 44px height is
          the touch target; the visible track stays 12px. */}
      <input
        aria-label="Hue"
        className={cn(
          "-my-4 h-11 w-full cursor-pointer appearance-none bg-transparent outline-none",
          "[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-(image:--hue)",
          "[&::-webkit-slider-thumb]:-mt-0.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.45)]",
          "[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-(image:--hue)",
          "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent",
          "focus-visible:[&::-webkit-slider-thumb]:ring-ring focus-visible:[&::-webkit-slider-thumb]:ring-[3px]",
        )}
        max={360}
        min={0}
        onChange={(event) =>
          commit({ ...hsv, h: Number(event.target.value) % 360 })
        }
        step={1}
        style={
          {
            "--hue":
              "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          } as CSSProperties
        }
        type="range"
        value={Math.round(hsv.h)}
      />

      <div className="space-y-1.5">
        <Label className="type-small" htmlFor={hexId}>
          Hex
        </Label>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-line size-9 shrink-0 rounded-md border"
            style={{ background: hex }}
          />
          <Input
            autoComplete="off"
            className="font-mono"
            id={hexId}
            onChange={(event) => {
              setTyped(event.target.value);
              const normalized = normalizeHex(event.target.value);
              if (!normalized) return;
              const next = hexToHsv(normalized);
              if (!next) return;
              setHsv((current) => ({
                ...next,
                h: next.s === 0 || next.v === 0 ? current.h : next.h,
              }));
              setLastHex(normalized);
              onChange(normalized);
            }}
            spellCheck={false}
            value={typed ?? hex}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The accent chooser (DESIGN.md section 7): the presets as swatches plus one
 * custom well that opens our own panel. Each swatch keeps a 44px touch target
 * around its 28px dot, and the chosen one carries a ring and a check in
 * whichever ink reads on it.
 */
export function ColorPicker({
  className,
  labelledBy,
  legend,
  onChange,
  presets,
  value,
}: {
  className?: string;
  /**
   * Id of the visible label naming this row. A `fieldset` cannot be the
   * target of `label for`, so the association goes the other way round.
   */
  labelledBy?: string;
  /** Names the group when there is no visible label to point at. */
  legend: string;
  onChange: (value: string) => void;
  presets: readonly ColorPreset[];
  value: string;
}) {
  const custom = !presets.some(
    (preset) => preset.value.toLowerCase() === value.toLowerCase(),
  );

  return (
    <fieldset
      aria-labelledby={labelledBy}
      className={cn("flex items-center", className)}
    >
      <legend className="sr-only">{legend}</legend>
      {presets.map((preset) => {
        const active = preset.value.toLowerCase() === value.toLowerCase();
        return (
          <button
            aria-label={preset.label}
            aria-pressed={active}
            className="focus-visible:ring-ring grid size-11 cursor-pointer place-items-center rounded-md outline-none focus-visible:ring-[3px]"
            key={preset.value}
            onClick={() => onChange(preset.value)}
            type="button"
          >
            <span
              className={cn(
                "border-line-2 ring-offset-background grid size-7 place-items-center rounded-sm border ring-2 ring-offset-2 transition-transform duration-150",
                active ? "ring-ink" : "ring-transparent hover:scale-110",
              )}
              style={{ background: preset.value }}
            >
              {active ? (
                <IconCheck
                  aria-hidden="true"
                  className="size-4"
                  style={{ color: accentInk(preset.value) }}
                />
              ) : null}
            </span>
          </button>
        );
      })}
      <Popover>
        <PopoverTrigger
          aria-label="Custom color"
          aria-pressed={custom}
          className="focus-visible:ring-ring grid size-11 cursor-pointer place-items-center rounded-md outline-none focus-visible:ring-[3px]"
        >
          <span
            aria-hidden="true"
            className={cn(
              "border-line-2 ring-offset-background grid size-7 place-items-center rounded-sm border-2 transition-transform duration-150",
              custom ? "ring-ink ring-2 ring-offset-2" : "hover:scale-110",
            )}
            style={
              custom ? { background: value, borderColor: value } : undefined
            }
          >
            <IconColorPicker
              className="size-4"
              style={{ color: custom ? accentInk(value) : undefined }}
            />
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <ColorPanel onChange={onChange} value={value} />
        </PopoverContent>
      </Popover>
    </fieldset>
  );
}
