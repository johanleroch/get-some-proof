/**
 * Picks the readable text color for a customer Brand accent. Amber, pastel
 * and light accents get dark ink; deep accents get white. Mirrors the rule
 * in DESIGN.md section 2.5 so public surfaces never ship white-on-light.
 */

const darkInk = "#2e2a25";
const lightInk = "#ffffff";

function channel(value: number) {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1]!;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return null;
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
}

/** Dark ink or white, whichever reads better on the accent. */
export function accentInk(accentHex: string): string {
  const luminance = relativeLuminance(accentHex);
  if (luminance === null) return darkInk;
  const darkContrast = (luminance + 0.05) / (0.033 + 0.05);
  const lightContrast = (1 + 0.05) / (luminance + 0.05);
  return darkContrast >= lightContrast ? darkInk : lightInk;
}
