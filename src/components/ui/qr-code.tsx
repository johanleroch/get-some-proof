"use client";

import { useMemo } from "react";
import { QrCodeDataType, encode } from "uqr";

import { cn } from "@/lib/utils";

/**
 * A scannable QR code drawn from design tokens rather than an image service:
 * the secret never leaves the browser.
 *
 * The plate is deliberately light in both themes. A QR code read by a phone
 * camera has to be dark modules on a light field, so inverting it in the dark
 * theme would simply stop it scanning. The two values below are the light
 * theme's `--surface` and `--ink` (DESIGN.md 2.1), written out because they
 * must not follow the theme.
 */
const plateField = "oklch(1 0 0)";
const plateInk = "oklch(0.25 0.012 60)";

/** Finder patterns are 7 modules square, one in three corners. */
const finderSize = 7;

export function QrCode({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  const qr = useMemo(() => {
    try {
      /* No quiet zone in the matrix: the plate's padding is the quiet zone,
         and it stays wider than the four modules the format asks for. */
      return encode(value, { ecc: "M", border: 0 });
    } catch {
      return null;
    }
  }, [value]);

  /* An address the encoder refuses would otherwise leave a silent hole where
     the whole instruction should be. */
  if (!qr) {
    return (
      <div
        className={cn(
          "border-line text-ink-2 type-small grid place-items-center rounded-lg border p-5 text-center",
          className,
        )}
        role="alert"
      >
        This code could not be drawn. Add the account with the key instead.
      </div>
    );
  }

  const { data, size, types } = qr;
  const finders = [
    [0, 0],
    [size - finderSize, 0],
    [0, size - finderSize],
  ] as const;

  const modules: { key: string; x: number; y: number }[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!data[row][col]) continue;
      /* The three finders are drawn as whole shapes below, so their own
         modules are skipped here and never doubled. */
      if (types[row][col] === QrCodeDataType.Position) continue;
      modules.push({ key: `${row}-${col}`, x: col, y: row });
    }
  }

  return (
    <div
      className={cn(
        "border-line rounded-lg border p-5",
        // Not `bg-surface`: see the note on `plateField`.
        className,
      )}
      style={{ backgroundColor: plateField }}
    >
      <svg
        aria-label={label}
        className="block h-full w-full"
        role="img"
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="geometricPrecision"
      >
        {modules.map((module) => (
          <rect
            fill={plateInk}
            height={1}
            key={module.key}
            rx={0.3}
            width={1}
            x={module.x}
            y={module.y}
          />
        ))}
        {finders.map(([x, y]) => (
          <g fill={plateInk} key={`finder-${x}-${y}`}>
            {/* The ring: one module thick, stroked down its middle line. */}
            <rect
              fill="none"
              height={finderSize - 1}
              rx={2}
              stroke={plateInk}
              strokeWidth={1}
              width={finderSize - 1}
              x={x + 0.5}
              y={y + 0.5}
            />
            <rect height={3} rx={1} width={3} x={x + 2} y={y + 2} />
          </g>
        ))}
      </svg>
    </div>
  );
}
