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

/** Preserve warm ink where readable, with black as an AA fallback. */
export function accentInk(accentHex: string): string {
  const luminance = relativeLuminance(accentHex);
  if (luminance === null) return darkInk;
  const darkContrast =
    (luminance + 0.05) / (relativeLuminance(darkInk)! + 0.05);
  const lightContrast = (1 + 0.05) / (luminance + 0.05);
  if (darkContrast >= 4.5) return darkInk;
  if (lightContrast >= 4.5) return lightInk;
  return "#000000";
}

/**
 * The Brand accent at low opacity, for the highlight behind a marked phrase.
 * Returned as `rgba()` rather than `color-mix()` so it also paints inside the
 * embed's shadow DOM on older browsers, and over any surface in either theme.
 */
export function accentSoft(accentHex: string, alpha = 0.3): string {
  const rgb = hexToRgb(accentHex);
  if (!rgb) return `rgba(255, 187, 22, ${alpha})`;
  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Opacity for the marker swash behind a highlighted phrase. A pale accent
 * needs more paint to register; a deep one would swallow the words, so the
 * alpha follows the accent's luminance and the ink stays readable either way.
 */
export function accentHighlight(accentHex: string): string {
  const luminance = relativeLuminance(accentHex) ?? 0.5;
  return accentSoft(accentHex, Math.round((0.3 + 0.3 * luminance) * 100) / 100);
}
