/**
 * The motion vocabulary of DESIGN.md section 8, as data, so the development
 * `/kit` page can plot every curve and replay it. The values live in
 * `globals.css`; this file only describes them. Keep the two in step.
 */

export type EaseToken = {
  /** CSS variable, without the leading dashes in the label. */
  variable: string;
  label: string;
  /** The four cubic-bezier control values, for the plot. */
  points: [number, number, number, number];
  /** Where it belongs, one sentence. */
  use: string;
};

export const easeTokens: EaseToken[] = [
  {
    variable: "--ease-out-soft",
    label: "Out soft",
    points: [0.2, 0, 0, 1],
    use: "Colour, opacity, hover and focus rings. Nothing that travels.",
  },
  {
    variable: "--ease-settle",
    label: "Settle",
    points: [0.34, 1.56, 0.64, 1],
    use: "Small things arriving: menus, tooltips, toasts, the switch thumb.",
  },
  {
    variable: "--ease-settle-soft",
    label: "Settle soft",
    points: [0.34, 1.35, 0.64, 1],
    use: "Heavier surfaces: dialogs, sheets, preview frames.",
  },
  {
    variable: "--ease-exit",
    label: "Exit",
    points: [0.4, 0, 0.9, 0.6],
    use: "Anything leaving. It never overshoots and never lingers.",
  },
  {
    variable: "--ease-sine",
    label: "Sine",
    points: [0.45, 0, 0.55, 1],
    use: "The only curve allowed to loop, and only for the mascot.",
  },
];

export type DurationToken = {
  variable: string;
  value: string;
  use: string;
};

export const durationTokens: DurationToken[] = [
  { variable: "--motion-fast", value: "150ms", use: "Colour and opacity" },
  { variable: "--motion-base", value: "200ms", use: "Transforms" },
  {
    variable: "--motion-settle",
    value: "320ms",
    use: "Entrances that overshoot",
  },
  { variable: "--motion-exit", value: "140ms", use: "Exits" },
];

export function easeCss(token: EaseToken): string {
  return `cubic-bezier(${token.points.join(", ")})`;
}

/**
 * How far past its mark the curve travels before settling, as a percentage.
 * Sampled rather than solved: a hundredth of a percent either way changes
 * nothing, and this is the number that decides whether a move reads as alive.
 * Below 3 percent the eye reads the move as linear.
 */
export function easeOvershoot({ points }: EaseToken): number {
  const [, y1, , y2] = points;
  let peak = 1;
  for (let step = 0; step <= 1000; step += 1) {
    const t = step / 1000;
    const y = 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
    if (y > peak) peak = y;
  }
  return Math.round((peak - 1) * 1000) / 10;
}

/**
 * The curve drawn in a 100 x 100 box, y flipped so time runs left to right
 * and progress runs upward. Overshoot leaves the box on purpose: that is the
 * part worth seeing, so the plot's viewBox keeps room above it.
 */
export function easePath({ points }: EaseToken): string {
  const [x1, y1, x2, y2] = points;
  const scale = (value: number) => (value * 100).toFixed(1);
  const flip = (value: number) => (100 - value * 100).toFixed(1);
  return `M0 100 C${scale(x1)} ${flip(y1)} ${scale(x2)} ${flip(y2)} 100 0`;
}
