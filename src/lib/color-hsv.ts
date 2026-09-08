import { hexToRgb } from "@/lib/color-contrast";

/**
 * Hue in degrees (0 to 360), saturation and value as percentages (0 to 100).
 * The picker works in HSV because that is the shape of the controls a person
 * expects: one square for how vivid and how bright, one slider for which
 * colour. Hex stays the value the product stores and the customer can paste.
 */
export type Hsv = { h: number; s: number; v: number };

function clamp(value: number, max: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

/** Rounds to whole percent and degrees, so a round trip does not drift. */
export function roundHsv({ h, s, v }: Hsv): Hsv {
  return {
    h: Math.round(clamp(h, 360)) % 360,
    s: Math.round(clamp(s, 100)),
    v: Math.round(clamp(v, 100)),
  };
}

export function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [red, green, blue] = rgb.map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const span = max - min;

  let h = 0;
  if (span !== 0) {
    if (max === red) h = ((green - blue) / span) % 6;
    else if (max === green) h = (blue - red) / span + 2;
    else h = (red - green) / span + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: max === 0 ? 0 : (span / max) * 100,
    v: max * 100,
  };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 100) / 100;
  const value = clamp(v, 100) / 100;
  const chroma = value * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;
  const sector = Math.floor(hue / 60) % 6;
  const [red, green, blue] = (
    [
      [chroma, second, 0],
      [second, chroma, 0],
      [0, chroma, second],
      [0, second, chroma],
      [second, 0, chroma],
      [chroma, 0, second],
    ] as const
  )[sector];

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * Accepts what a person actually types or pastes: with or without the hash,
 * three digits or six, any case. Returns the canonical six-digit lowercase
 * form, or null when it is not a colour yet.
 */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed
      .split("")
      .map((digit) => digit + digit)
      .join("")}`;
  }
  return /^[0-9a-f]{6}$/.test(trimmed) ? `#${trimmed}` : null;
}
