// The blob mascot and its expression set.
//
// The body is the official app icon's blob (public/brand/icon.svg), drawn on
// a 1000 x 1000 canvas: amber gradient, two Figma inner shadows, ink pill
// eyes. Every expression keeps the body and swaps only the face layer, so the
// set stays one character. Rendered on /kit/blob and exported to
// public/brand/blob/ by scripts/app-icons/blob-set.mjs.

export const BLOB_VIEWBOX = "212 212 576 576";

export const INK = "#2E2A25";
export const BODY_PATH =
  "M224 552C224 318 348 228 500 228C652 228 776 318 776 552C776 644 740 712 700 742C662 770 618 718 576 746C540 772 460 772 424 746C382 718 338 770 300 742C260 712 224 644 224 552Z";

/** Vertical pill, the official eye: 54 x 126, centred on (cx, cy). */
export function pill(cx: number, cy: number, w = 54, h = 126): string {
  const r = w / 2;
  const x = cx - r;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  return `M${x} ${top + r}A${r} ${r} 0 0 1 ${cx + r} ${top + r}V${bottom - r}A${r} ${r} 0 0 1 ${x} ${bottom - r}Z`;
}

/** Plump five point star with rounded tips, centred on (cx, cy). */
function star(cx: number, cy: number, radius: number, inner = 0.5): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * inner;
    const t = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  const parts: string[] = [];
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const cut = i % 2 === 0 ? radius * 0.2 : radius * 0.12;
    const a = toward(p1, p0, cut);
    const b = toward(p1, p2, cut);
    parts.push(`${i === 0 ? "M" : "L"}${a[0].toFixed(1)} ${a[1].toFixed(1)}`);
    parts.push(
      `Q${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`,
    );
  }
  return `${parts.join("")}Z`;
}

function toward(
  from: [number, number],
  to: [number, number],
  distance: number,
): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const d = Math.min(distance, length / 2);
  return [from[0] + (dx / length) * d, from[1] + (dy / length) * d];
}

/**
 * The rule that keeps the set one character: every eye is the official pill
 * (54 x 126) re-shaped, never re-weighted. A stroke of the pill's width with
 * round caps and a 72 unit centreline has exactly the pill's ink mass, so the
 * dash is the pill lying down. The arch keeps that mass with a thinner stroke
 * (44) on a longer semicircle, because a 54 stroke bent over 72 units cannot
 * leave a visible opening. Hearts and stars share one prop mass (about 1.2
 * pills); the sunglasses are the one prop that covers both eyes and sits
 * outside the mass rule. Two documented exceptions: Wink is the one
 * deliberate asymmetry, and Worried's sweat drop is the one mark that is
 * neither an eye nor ink (without it the drooping eyes read as content).
 */
const PILL_W = 54;
const PILL_H = 126;
const CENTRELINE = PILL_H - PILL_W;

const stroke = (d: string, width = PILL_W) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const fill = (d: string, color = INK) => `<path d="${d}" fill="${color}"/>`;

/** Eye centres of the official face; every eye variant sits on them. */
export const LEFT = 422;
export const RIGHT = 578;
export const EYE_Y = 494;
/** Props are wider than a pill, so they sit a little further out. */
const PROP_LEFT = 408;
const PROP_RIGHT = 592;

const eyes = fill(pill(LEFT, EYE_Y) + pill(RIGHT, EYE_Y));
/** Closed resting eye: the pill lying down. */
const dash = (cx: number, cy = EYE_Y) =>
  stroke(`M${cx - CENTRELINE / 2} ${cy}H${cx + CENTRELINE / 2}`);
/** Closed happy eye: a semicircle of the pill's mass, opening downwards. */
const ARCH_R = 34;
const ARCH_W = 44;
export const arch = (cx: number, cy = EYE_Y) =>
  stroke(
    `M${cx - ARCH_R} ${cy + 17}A${ARCH_R} ${ARCH_R} 0 0 1 ${cx + ARCH_R} ${cy + 17}`,
    ARCH_W,
  );
/** Closed drooping eye: the same semicircle, opening upwards. */
const droop = (cx: number, cy = EYE_Y) =>
  stroke(
    `M${cx - ARCH_R} ${cy - 17}A${ARCH_R} ${ARCH_R} 0 0 0 ${cx + ARCH_R} ${cy - 17}`,
    ARCH_W,
  );
/** A pill leaning by `angle` degrees around its own centre. */
const tilted = (cx: number, cy: number, angle: number) =>
  `<path d="${pill(cx, cy)}" fill="${INK}" transform="rotate(${angle} ${cx} ${cy})"/>`;
/** Wide open eye: the pill's mass as a disc. */
const ROUND_R = Math.round(
  Math.sqrt((PILL_W * CENTRELINE + Math.PI * (PILL_W / 2) ** 2) / Math.PI),
);
const round = (cx: number, cy = EYE_Y) =>
  `<circle cx="${cx}" cy="${cy}" r="${ROUND_R}" fill="${INK}"/>`;

/** Classic heart (the sin cubed curve), `width` wide, centred on (cx, cy). */
function heart(cx: number, cy: number, width: number): string {
  const k = width / 32;
  const points: [number, number][] = [];
  for (let i = 0; i < 96; i += 1) {
    const t = (i / 96) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    points.push([x * k, -y * k]);
  }
  const ys = points.map((point) => point[1]);
  const shift = (Math.min(...ys) + Math.max(...ys)) / 2;
  return `${points
    .map(
      ([x, y], i) =>
        `${i === 0 ? "M" : "L"}${(cx + x).toFixed(1)} ${(cy + y - shift).toFixed(1)}`,
    )
    .join("")}Z`;
}

export type BlobExpression = {
  /** File and id-safe name. */
  name: string;
  label: string;
  /** Where the product would use it. */
  use: string;
  /** How the eyes say it, for whoever adds the next one. */
  how: string;
  /**
   * Whether the eyes are open pills or discs that can blink at rest. Closed
   * eyes, arches, glasses and prop eyes never blink: a closed eye blinking
   * looks like a glitch.
   */
  blinks?: boolean;
  /** SVG fragment drawn over the body, in canvas units. */
  face: string;
};

export const blobExpressions: BlobExpression[] = [
  {
    name: "neutral",
    blinks: true,
    label: "Neutral",
    use: "The official icon. Brand mark, favicon, anywhere the blob is not reacting.",
    how: "The two pills, as drawn.",
    face: eyes,
  },
  {
    name: "happy",
    label: "Happy",
    use: "Something saved or published. The default reaction.",
    how: "Both pills bent into an arch: eyes closed by a smile.",
    face: arch(LEFT) + arch(RIGHT),
  },
  {
    name: "love",
    label: "Love",
    use: "A five-star testimonial, a customer's kind words.",
    how: "Heart eyes, one prop mass, a touch further out than the pills.",
    face: fill(
      heart(PROP_LEFT, EYE_Y + 10, 116) + heart(PROP_RIGHT, EYE_Y + 10, 116),
    ),
  },
  {
    name: "wink",
    label: "Wink",
    use: "Tips, shortcuts, a pro feature revealed.",
    how: "Left pill open, right pill bent into the same arch as Happy.",
    face: fill(pill(LEFT, EYE_Y)) + arch(RIGHT),
  },
  {
    name: "surprised",
    blinks: true,
    label: "Surprised",
    use: "A new testimonial arrived, an unexpected count.",
    how: "The pills become discs of the same mass, wide open.",
    face: round(LEFT) + round(RIGHT),
  },
  {
    name: "curious",
    blinks: true,
    label: "Curious",
    use: "Empty inbox, a search with no result, loading.",
    how: "Both pills, unchanged, glance up and to the right together (64 across, 48 up).",
    face: fill(pill(LEFT + 64, EYE_Y - 48) + pill(RIGHT + 64, EYE_Y - 48)),
  },
  {
    name: "sleepy",
    label: "Sleepy",
    use: "Nothing happened yet, a paused Wall, an idle account.",
    how: "Both pills lying down, a little lower.",
    face: dash(LEFT, EYE_Y + 10) + dash(RIGHT, EYE_Y + 10),
  },
  {
    name: "sad",
    blinks: true,
    label: "Sad",
    use: "An error, a declined testimonial, a deleted workspace.",
    how: "Both pills lean towards each other at the top, a little lower.",
    face: tilted(LEFT, EYE_Y + 14, 22) + tilted(RIGHT, EYE_Y + 14, -22),
  },
  {
    name: "starstruck",
    label: "Starstruck",
    use: "A video testimonial, a featured proof, the wall going live.",
    how: "Star eyes, the same prop mass and placement as the hearts.",
    face: fill(
      star(PROP_LEFT, EYE_Y, 68, 0.55) + star(PROP_RIGHT, EYE_Y, 68, 0.55),
    ),
  },
  {
    name: "cool",
    label: "Cool",
    use: "Verified, upgraded to Pro, a milestone reached.",
    how: "Two wide, slim lenses on the prop centres, joined by a bridge that hides inside them. They fall in from above.",
    face: `<path class="prop" d="${
      roundedRect(PROP_LEFT - 70, EYE_Y - 42, 140, 84, 42) +
      roundedRect(PROP_RIGHT - 70, EYE_Y - 42, 140, 84, 42) +
      roundedRect(
        PROP_LEFT + 40,
        EYE_Y - 11,
        PROP_RIGHT - PROP_LEFT - 80,
        22,
        0,
      )
    }" fill="${INK}"/>`,
  },
  {
    name: "worried",
    label: "Worried",
    use: "A quota almost reached, a payment pending, a slow upload.",
    how: "Both pills bent the other way, eyes closed and downcast, plus one sweat drop that falls in from above.",
    face:
      droop(LEFT, EYE_Y + 6) +
      droop(RIGHT, EYE_Y + 6) +
      `<path class="drop" d="M700 338C700 338 748 408 748 444A48 48 0 0 1 652 444C652 408 700 338 700 338Z" fill="#FFFFFF"/>`,
  },
];

function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/** Filter and gradient of the official body, namespaced by `id`. */
export function blobDefs(id: string): string {
  return `<defs>
<filter id="blob-shade-${id}" x="217" y="212.5" width="574.5" height="563" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="-7" dy="15"/>
<feGaussianBlur stdDeviation="5"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.36 0"/>
<feBlend mode="normal" in2="shape" result="effect1"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="22" dy="-42"/>
<feGaussianBlur stdDeviation="7.75"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.952017 0 0 0 0 0.658791 0 0 0 0 0.0595905 0 0 0 1 0"/>
<feBlend mode="normal" in2="effect1" result="effect2"/>
</filter>
<linearGradient id="blob-fill-${id}" x1="0" y1="194" x2="0" y2="817" gradientUnits="userSpaceOnUse">
<stop stop-color="#FFD24A"/>
<stop offset="1" stop-color="#F2A100"/>
</linearGradient>
</defs>`;
}

/** The body alone: the black base under the shaded gradient fill. */
export function blobBody(id: string): string {
  return `<path d="${BODY_PATH}" fill="black"/>
<g filter="url(#blob-shade-${id})"><path d="${BODY_PATH}" fill="url(#blob-fill-${id})"/></g>`;
}

/**
 * Full SVG for one expression: the official body plus the face layer. `id`
 * namespaces the filter and gradient so several blobs can share a page.
 */
export function blobSvg(
  expression: BlobExpression,
  { id = expression.name, size }: { id?: string; size?: number } = {},
): string {
  const dimensions = size ? ` width="${size}" height="${size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BLOB_VIEWBOX}"${dimensions} fill="none" role="img" aria-label="Get Some Proof mascot, ${expression.label.toLowerCase()}">
${blobBody(id)}
${expression.face}
${blobDefs(id)}
</svg>`;
}
