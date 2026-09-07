// Builds the Get Some Proof app icon family as SVG files.
//
// Style reference and rules: docs/design/app-icons/DESIGN.md.
// Output: public/brand/icons/<nn>-<name>.svg (1024 x 1024, squircle-masked).
// Render PNGs and the review sheet with `node scripts/app-icons/render.mjs`.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const S = 1024;
const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public/brand/icons",
);

// Palette. Amber is the brand source token (#FFBB16); the rest are the
// warm neutrals from DESIGN.md, plus the light and shade steps the soft
// plastic shading needs. Nothing else is allowed in an icon.
const C = {
  amber: "#FFBB16",
  amberLight: "#FFD24A",
  amberDeep: "#F2A100",
  amberDark: "#D68A00",
  amberShade: "#8F5A00",
  paper: "#FDFBF7",
  paperDeep: "#F1EBE0",
  paperShade: "#7A6A54",
  ink: "#2E2A25",
  inkLight: "#4A433C",
  inkDeep: "#1B1815",
  inkBg: "#2A2622",
  inkBgDeep: "#17140F",
  white: "#FFFFFF",
  whiteDeep: "#EEE7DA",
};

// Render mode. `flat` drops every filter (Figma and favicons cannot use SVG
// filters), `clip` masks to the squircle, `bare` skips the background, and
// `viewBox` crops the canvas (used by the mark-only export).
let mode = {
  flat: false,
  clip: true,
  bare: false,
  invert: false,
  viewBox: null,
};

function withMode(next, fn) {
  const previous = mode;
  mode = { ...previous, ...next };
  try {
    return fn();
  } finally {
    mode = previous;
  }
}

// ---------------------------------------------------------------- geometry

/** iOS style squircle (superellipse, exponent 5) as a closed path. */
function squircle(size = S, n = 5, steps = 360) {
  const a = size / 2;
  const pts = [];
  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = a + a * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = a + a * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push([x, y]);
  }
  return polyPath(pts);
}

function polyPath(pts) {
  return (
    pts
      .map(
        ([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`,
      )
      .join("") + "Z"
  );
}

/**
 * Polygon with rounded corners. Each corner is cut at `r` from the vertex and
 * replaced with a quadratic curve whose control point is the vertex.
 */
function roundedPolygon(pts, radius) {
  const n = pts.length;
  const parts = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const r = typeof radius === "function" ? radius(i) : radius;
    const a = toward(p1, p0, r);
    const b = toward(p1, p2, r);
    parts.push(`${i === 0 ? "M" : "L"}${f(a[0])} ${f(a[1])}`);
    parts.push(`Q${f(p1[0])} ${f(p1[1])} ${f(b[0])} ${f(b[1])}`);
  }
  return parts.join("") + "Z";
}

function toward(from, to, dist) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const d = Math.min(dist, len / 2);
  return [from[0] + (dx / len) * d, from[1] + (dy / len) * d];
}

const f = (v) => Number(v.toFixed(2));

/** Plump five point star with rounded tips. */
function star(cx, cy, R, { inner = 0.5, round = 0.16, rotate = 0 } = {}) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? R : R * inner;
    const t = -Math.PI / 2 + (i * Math.PI) / 5 + (rotate * Math.PI) / 180;
    pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
  }
  return roundedPolygon(pts, (i) =>
    i % 2 === 0 ? R * round : R * round * 0.6,
  );
}

/** Rounded rectangle path (so it can be combined with other subpaths). */
function rrect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M${f(x + rr)} ${f(y)}`,
    `H${f(x + w - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w)} ${f(y + rr)}`,
    `V${f(y + h - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w - rr)} ${f(y + h)}`,
    `H${f(x + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y + h - rr)}`,
    `V${f(y + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}`,
    "Z",
  ].join("");
}

function circle(cx, cy, r) {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

/** Thick segment with round ends, as a filled path. */
function capsule(x1, y1, x2, y2, w) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  const r = w / 2;
  return [
    `M${f(x1 + nx)} ${f(y1 + ny)}`,
    `L${f(x2 + nx)} ${f(y2 + ny)}`,
    `A${f(r)} ${f(r)} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}`,
    `L${f(x1 - nx)} ${f(y1 - ny)}`,
    `A${f(r)} ${f(r)} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}`,
    "Z",
  ].join("");
}

/** Speech bubble: very round body plus a short curved tail. */
function bubble({ x, y, w, h, side = "left" }) {
  const body = rrect(x, y, w, h, Math.min(w, h) * 0.42);
  const dir = side === "left" ? 1 : -1;
  const bx = side === "left" ? x + w * 0.3 : x + w * 0.7;
  const by = y + h - h * 0.08;
  const tip = [bx - dir * w * 0.16, y + h + h * 0.2];
  const tail = [
    `M${f(bx - dir * w * 0.13)} ${f(by - h * 0.1)}`,
    `C${f(bx - dir * w * 0.1)} ${f(by + h * 0.1)} ${f(tip[0] + dir * w * 0.03)} ${f(tip[1] - h * 0.06)} ${f(tip[0])} ${f(tip[1])}`,
    `C${f(tip[0] + dir * w * 0.12)} ${f(tip[1] - h * 0.03)} ${f(bx + dir * w * 0.1)} ${f(by)} ${f(bx + dir * w * 0.12)} ${f(by - h * 0.12)}`,
    "Z",
  ].join("");
  return [body, tail];
}

/** Scalloped seal: a disc plus `count` bumps around its rim. */
function seal(cx, cy, R, count = 12, bump = 0.24) {
  const parts = [circle(cx, cy, R)];
  for (let i = 0; i < count; i += 1) {
    const t = (i / count) * Math.PI * 2 - Math.PI / 2;
    parts.push(circle(cx + R * Math.cos(t), cy + R * Math.sin(t), R * bump));
  }
  return parts;
}

// ------------------------------------------------------------------ paint

const squirclePath = squircle();

/**
 * Soft plastic filter: a light rim along the top edge and a soft shade along
 * the bottom edge of whatever is drawn inside the filtered group.
 */
function plasticFilter(
  id,
  {
    rim = 0.55,
    rimSize = 14,
    shade = 0.28,
    shadeSize = 22,
    rimColor = C.white,
    shadeColor = "#000",
  } = {},
) {
  if (mode.flat) return "";
  return `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
  <feOffset in="SourceAlpha" dy="${rimSize}" result="rimOff"/>
  <feGaussianBlur in="rimOff" stdDeviation="${rimSize * 0.9}" result="rimBlur"/>
  <feComposite in="SourceAlpha" in2="rimBlur" operator="out" result="rimBand"/>
  <feFlood flood-color="${rimColor}" flood-opacity="${rim}" result="rimFill"/>
  <feComposite in="rimFill" in2="rimBand" operator="in" result="rimLit"/>
  <feOffset in="SourceAlpha" dy="${-shadeSize}" result="shadeOff"/>
  <feGaussianBlur in="shadeOff" stdDeviation="${shadeSize * 0.9}" result="shadeBlur"/>
  <feComposite in="SourceAlpha" in2="shadeBlur" operator="out" result="shadeBand"/>
  <feFlood flood-color="${shadeColor}" flood-opacity="${shade}" result="shadeFill"/>
  <feComposite in="shadeFill" in2="shadeBand" operator="in" result="shaded"/>
  <feMerge>
    <feMergeNode in="SourceGraphic"/>
    <feMergeNode in="shaded"/>
    <feMergeNode in="rimLit"/>
  </feMerge>
</filter>`;
}

/** Ambient shadow the subject casts on the background. */
function dropShadow(
  id,
  { blur = 26, dy = 30, color = "#000", opacity = 0.22 } = {},
) {
  if (mode.flat) return "";
  return `<filter id="${id}" x="-30%" y="-30%" width="160%" height="170%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/>
  <feOffset in="b" dy="${dy}" result="o"/>
  <feFlood flood-color="${color}" flood-opacity="${opacity}"/>
  <feComposite in2="o" operator="in"/>
</filter>`;
}

function blur(id, std) {
  if (mode.flat) return "";
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${std}"/></filter>`;
}

/** Vertical gradient in canvas units so several subpaths share one light. */
function vgrad(id, top, bottom, y1, y2, x = 0) {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
}

function dgrad(id, a, b, x1, y1, x2, y2) {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
}

function rgrad(id, cx, cy, r, stops) {
  const s = stops
    .map(
      ([o, c, a = 1]) =>
        `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`,
    )
    .join("");
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${s}</radialGradient>`;
}

/** Full-bleed background: soft top to bottom gradient plus a top light. */
function background(kind) {
  const map = {
    amber: [C.amberLight, C.amberDeep],
    paper: [C.paper, C.paperDeep],
    ink: [C.inkBg, C.inkBgDeep],
  };
  const [top, bottom] = map[kind];
  const light = kind === "ink" ? 0.08 : 0.35;
  if (mode.bare) return { defs: "", body: "" };
  return {
    defs: `${vgrad("bg", top, bottom, 0, S)}${rgrad(
      "bgLight",
      S * 0.5,
      -S * 0.1,
      S * 0.9,
      [
        [0, C.white, light],
        [1, C.white, 0],
      ],
    )}`,
    body: `<rect width="${S}" height="${S}" fill="url(#bg)"/><rect width="${S}" height="${S}" fill="url(#bgLight)"/>`,
  };
}

/** Specular glint: a soft white ellipse. */
function glint(cx, cy, rx, ry, opacity = 0.7, rotate = -25) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.white}" opacity="${opacity}" transform="rotate(${rotate} ${cx} ${cy})" ${fx("glintBlur")}/>`;
}

/** Two pill eyes. */
function eyes(cx, cy, { gap = 128, w = 46, h = 100, color = C.ink } = {}) {
  const left = rrect(cx - gap / 2 - w / 2, cy - h / 2, w, h, w / 2);
  const right = rrect(cx + gap / 2 - w / 2, cy - h / 2, w, h, w / 2);
  return `<path d="${left}${right}" fill="${color}"/>`;
}

/** Small smile, an arc with round caps. */
function smile(cx, cy, w, { stroke = 24, color = C.ink } = {}) {
  const d = `M${cx - w / 2} ${cy}Q${cx} ${cy + w * 0.7} ${cx + w / 2} ${cy}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`;
}

/** `filter` attribute for a filter id, or nothing in flat mode. */
function fx(id) {
  return mode.flat ? "" : `filter="url(#${id})"`;
}

/** Shadow copy of a subject, dropped entirely in flat mode. */
function cast(id, markup) {
  return mode.flat ? "" : `<g filter="url(#${id})">${markup}</g>`;
}

/** Several subpaths as separate elements, so overlaps never punch holes. */
function paths(list, attrs) {
  return list.map((d) => `<path d="${d}" ${attrs}/>`).join("");
}

function svg({ name, defs, body }) {
  const [vx, vy, vw, vh] = mode.viewBox ?? [0, 0, S, S];
  const clip = mode.clip
    ? `<clipPath id="squircle"><path d="${squirclePath}"/></clipPath>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="${name}">
<defs>
${clip}
${blur("glintBlur", 10)}
${defs}
</defs>
<g${mode.clip ? ' clip-path="url(#squircle)"' : ""}>
${body}
</g>
</svg>
`;
}

// ------------------------------------------------------------------ icons

const icons = [];

// 01 · Star mascot. The logo's star, made soft, with a face.
icons.push(() => {
  const bg = background("amber");
  const d = star(512, 536, 372, { inner: 0.52, round: 0.2 });
  return svg({
    name: "Get Some Proof, star mascot",
    defs: `${bg.defs}${vgrad("body", C.white, C.whiteDeep, 170, 910)}${plasticFilter("plastic", { rim: 0.9, shade: 0.16, shadeColor: C.amberShade })}${dropShadow("shadow", { color: C.amberShade, opacity: 0.35, blur: 24, dy: 34 })}`,
    body: `${bg.body}
${cast("shadow", `<path d="${d}"/>`)}
<g ${fx("plastic")}><path d="${d}" fill="url(#body)"/></g>
${eyes(512, 526, { gap: 132, w: 48, h: 108 })}
${smile(512, 620, 88, { stroke: 26 })}`,
  });
});

// 02 · Bubble sticker. Flat amber, white bubble with a thick ink outline.
icons.push(() => {
  const bg = background("amber");
  const d = bubble({ x: 186, y: 206, w: 652, h: 520, side: "left" });
  return svg({
    name: "Get Some Proof, speech bubble sticker",
    defs: `${bg.defs}${dropShadow("shadow", { color: C.amberShade, opacity: 0.3, blur: 22, dy: 30 })}`,
    body: `${bg.body}
${cast("shadow", paths(d, ""))}
${paths(d, `fill="${C.ink}" stroke="${C.ink}" stroke-width="72" stroke-linejoin="round"`)}
${paths(d, `fill="${C.white}"`)}
${eyes(512, 466, { gap: 150, w: 54, h: 128 })}`,
  });
});

// 03 · Quote marks on paper. Chunky ink quotes, one amber star.
icons.push(() => {
  const bg = background("paper");
  const mark = (cx, cy, R) => [
    circle(cx, cy, R),
    [
      `M${f(cx + R * 0.98)} ${f(cy - R * 0.2)}`,
      `C${f(cx + R * 1.05)} ${f(cy + R * 0.9)} ${f(cx + R * 0.55)} ${f(cy + R * 1.75)} ${f(cx - R * 0.25)} ${f(cy + R * 2.15)}`,
      `C${f(cx + R * 0.2)} ${f(cy + R * 1.55)} ${f(cx + R * 0.35)} ${f(cy + R * 1.05)} ${f(cx - R * 0.1)} ${f(cy + R * 0.95)}`,
      "Z",
    ].join(""),
  ];
  const d = [...mark(368, 452, 148), ...mark(652, 452, 148)];
  const s = star(818, 238, 84, { inner: 0.5, round: 0.2, rotate: 12 });
  // `invert` paints the quotes in paper for the mark used on dark grounds.
  const [top, bottom] = mode.invert
    ? [C.white, C.whiteDeep]
    : [C.inkLight, C.inkDeep];
  return svg({
    name: "Get Some Proof, quote marks",
    defs: `${bg.defs}${vgrad("body", top, bottom, 300, 780)}${plasticFilter("plastic", { rim: 0.45, shade: 0.5, rimSize: 14, shadeSize: 24 })}${dropShadow("shadow", { color: C.paperShade, opacity: 0.3, blur: 22, dy: 30 })}${vgrad("starFill", C.amberLight, C.amberDeep, 154, 322)}${plasticFilter("plasticStar", { rim: 0.8, shade: 0.2, rimSize: 6, shadeSize: 10, shadeColor: C.amberShade })}`,
    body: `${bg.body}
${cast("shadow", paths(d, ""))}
<g ${fx("plastic")}>${paths(d, `fill="url(#body)"`)}</g>
<g ${fx("plasticStar")}><path d="${s}" fill="url(#starFill)"/></g>`,
  });
});

// 04 · Proof seal. Amber rosette with an ink check, on warm ink.
icons.push(() => {
  const bg = background("ink");
  const d = seal(512, 520, 300, 12, 0.25);
  const check = "M372 528L470 626L664 420";
  return svg({
    name: "Get Some Proof, proof seal",
    defs: `${bg.defs}${rgrad("glow", 512, 520, 520, [
      [0, C.amber, 0.38],
      [1, C.amber, 0],
    ])}${vgrad("body", C.amberLight, C.amberDeep, 150, 900)}${plasticFilter("plastic", { rim: 0.75, shade: 0.22, rimSize: 16, shadeSize: 26, shadeColor: C.amberShade })}${dropShadow("shadow", { color: "#000", opacity: 0.45, blur: 26, dy: 34 })}`,
    body: `${bg.body}
<rect width="${S}" height="${S}" fill="url(#glow)"/>
${cast("shadow", paths(d, ""))}
<g ${fx("plastic")}>${paths(d, `fill="url(#body)"`)}</g>
<path d="${check}" fill="none" stroke="${C.ink}" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/>`,
  });
});

// 05 · Glossy star. One amber star with a warm glow, on warm ink.
icons.push(() => {
  const bg = background("ink");
  const d = star(512, 540, 392, { inner: 0.5, round: 0.18 });
  return svg({
    name: "Get Some Proof, glossy star",
    defs: `${bg.defs}${rgrad("glow", 512, 560, 560, [
      [0, C.amber, 0.45],
      [1, C.amber, 0],
    ])}${dgrad("body", C.amberLight, C.amberDeep, 300, 200, 720, 900)}${plasticFilter("plastic", { rim: 0.85, shade: 0.3, rimSize: 18, shadeSize: 30, shadeColor: C.amberShade })}${dropShadow("shadow", { color: "#000", opacity: 0.5, blur: 28, dy: 36 })}`,
    body: `${bg.body}
<rect width="${S}" height="${S}" fill="url(#glow)"/>
${cast("shadow", `<path d="${d}"/>`)}
<g ${fx("plastic")}><path d="${d}" fill="url(#body)"/></g>
<g clip-path="url(#starClip)">${glint(430, 330, 120, 46, 0.75, -30)}</g>
<clipPath id="starClip"><path d="${d}"/></clipPath>`,
  });
});

// 06 · Bubble with a star. Soft white bubble holding one amber star.
icons.push(() => {
  const bg = background("amber");
  const d = bubble({ x: 176, y: 196, w: 672, h: 540, side: "right" });
  const s = star(512, 470, 180, { inner: 0.5, round: 0.2 });
  return svg({
    name: "Get Some Proof, testimonial bubble",
    defs: `${bg.defs}${vgrad("body", C.white, C.whiteDeep, 180, 880)}${plasticFilter("plastic", { rim: 0.9, shade: 0.16, shadeColor: C.amberShade })}${dropShadow("shadow", { color: C.amberShade, opacity: 0.35, blur: 24, dy: 34 })}${vgrad("starFill", C.amberLight, C.amberDeep, 290, 650)}${plasticFilter("plasticStar", { rim: 0.8, shade: 0.22, rimSize: 10, shadeSize: 16, shadeColor: C.amberShade })}${dropShadow("starShadow", { color: C.paperShade, opacity: 0.25, blur: 12, dy: 14 })}`,
    body: `${bg.body}
${cast("shadow", paths(d, ""))}
<g ${fx("plastic")}>${paths(d, `fill="url(#body)"`)}</g>
${cast("starShadow", `<path d="${s}"/>`)}
<g ${fx("plasticStar")}><path d="${s}" fill="url(#starFill)"/></g>`,
  });
});

// 07 · Camera. Ink video camera with a glass lens, for video testimonials.
icons.push(() => {
  const bg = background("amber");
  const body = [rrect(200, 318, 624, 452, 104), rrect(292, 244, 252, 130, 65)];
  const lensOuter = circle(512, 544, 186);
  return svg({
    name: "Get Some Proof, camera",
    defs: `${bg.defs}${vgrad("body", C.inkLight, C.inkDeep, 262, 760)}${plasticFilter("plastic", { rim: 0.45, shade: 0.5, rimSize: 14, shadeSize: 22 })}${dropShadow("shadow", { color: C.amberShade, opacity: 0.4, blur: 24, dy: 34 })}${rgrad(
      "lensRing",
      512,
      544,
      186,
      [
        [0.78, C.inkDeep],
        [0.9, "#5A524A"],
        [1, C.inkDeep],
      ],
    )}${rgrad("glass", 466, 488, 220, [
      [0, "#6E655B"],
      [0.5, "#2B2622"],
      [1, "#100E0C"],
    ])}${rgrad("rec", 728, 418, 30, [
      [0, C.amberLight],
      [1, C.amberDeep],
    ])}`,
    body: `${bg.body}
${cast("shadow", paths(body, ""))}
<g ${fx("plastic")}>${paths(body, `fill="url(#body)"`)}</g>
<path d="${lensOuter}" fill="url(#lensRing)"/>
<circle cx="512" cy="544" r="142" fill="url(#glass)"/>
<circle cx="512" cy="544" r="142" fill="none" stroke="${C.white}" stroke-opacity="0.18" stroke-width="6"/>
${glint(458, 474, 48, 24, 0.85, -35)}
<circle cx="728" cy="418" r="28" fill="url(#rec)"/>`,
  });
});

// 08 · Blob mascot. A squishy amber blob with pill eyes, on paper.
icons.push(() => {
  const bg = background("paper");
  const d = [
    "M236 556",
    "C236 322 360 232 512 232",
    "C664 232 788 322 788 556",
    "C788 648 752 716 712 746",
    "C674 774 630 722 588 750",
    "C552 776 472 776 436 750",
    "C394 722 350 774 312 746",
    "C272 716 236 648 236 556Z",
  ].join("");
  return svg({
    name: "Get Some Proof, blob mascot",
    defs: `${bg.defs}${vgrad("body", C.amberLight, C.amberDeep, 236, 780)}${plasticFilter("plastic", { rim: 0.8, shade: 0.24, rimSize: 16, shadeSize: 28, shadeColor: C.amberShade })}${dropShadow("shadow", { color: C.paperShade, opacity: 0.32, blur: 24, dy: 34 })}`,
    body: `${bg.body}
${cast("shadow", `<path d="${d}"/>`)}
<g ${fx("plastic")}><path d="${d}" fill="url(#body)"/></g>
${eyes(512, 498, { gap: 156, w: 54, h: 126 })}`,
  });
});

// 09 · P monogram. Chunky rounded P with an amber star in its counter.
icons.push(() => {
  const bg = background("paper");
  const stroke = 150;
  const pPath = "M392 772V312H556A154 154 0 0 1 556 620H392";
  const s = star(572, 466, 66, { inner: 0.5, round: 0.2 });
  return svg({
    name: "Get Some Proof, P monogram",
    defs: `${bg.defs}${vgrad("body", C.inkLight, C.inkDeep, 250, 840)}${plasticFilter("plastic", { rim: 0.45, shade: 0.5, rimSize: 14, shadeSize: 24 })}${dropShadow("shadow", { color: C.paperShade, opacity: 0.3, blur: 24, dy: 32 })}${vgrad("starFill", C.amberLight, C.amberDeep, 400, 532)}${plasticFilter("plasticStar", { rim: 0.8, shade: 0.2, rimSize: 5, shadeSize: 8, shadeColor: C.amberShade })}`,
    body: `${bg.body}
${cast("shadow", `<path d="${pPath}" fill="none" stroke="#000" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`)}
<g ${fx("plastic")}><path d="${pPath}" fill="none" stroke="url(#body)" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/></g>
<g ${fx("plasticStar")}><path d="${s}" fill="url(#starFill)"/></g>`,
  });
});

// 10 · Star burst. One big amber star and two sparks, on warm ink.
icons.push(() => {
  const bg = background("ink");
  const big = star(588, 548, 300, { inner: 0.5, round: 0.18, rotate: 8 });
  const s1 = star(262, 286, 92, { inner: 0.5, round: 0.2, rotate: -10 });
  const s2 = star(262, 726, 64, { inner: 0.5, round: 0.2, rotate: 14 });
  return svg({
    name: "Get Some Proof, star burst",
    defs: `${bg.defs}${rgrad("glow", 588, 560, 560, [
      [0, C.amber, 0.42],
      [1, C.amber, 0],
    ])}${dgrad("body", C.amberLight, C.amberDeep, 380, 260, 760, 860)}${plasticFilter("plastic", { rim: 0.85, shade: 0.3, rimSize: 16, shadeSize: 26, shadeColor: C.amberShade })}${plasticFilter("plasticSmall", { rim: 0.85, shade: 0.3, rimSize: 6, shadeSize: 10, shadeColor: C.amberShade })}${dropShadow("shadow", { color: "#000", opacity: 0.5, blur: 26, dy: 34 })}${dropShadow("shadowSmall", { color: "#000", opacity: 0.4, blur: 10, dy: 12 })}`,
    body: `${bg.body}
<rect width="${S}" height="${S}" fill="url(#glow)"/>
${cast("shadow", `<path d="${big}"/>`)}
<g ${fx("plastic")}><path d="${big}" fill="url(#body)"/></g>
${cast("shadowSmall", `<path d="${s1}${s2}"/>`)}
<g ${fx("plasticSmall")}><path d="${s1}${s2}" fill="url(#body)"/></g>`,
  });
});

// ---------------------------------------------------------------- mascots
// Series two, the 08 blob's cousins: one amber soft plastic character on
// paper, ink pill eyes, optional smile. Three stars, then shapes that say
// "Get Some Proof" (bubble, seal, quote, medal, magnifier, stamp, envelope).

/** Shared frame for the mascot series. `shapes` are amber, `over` draws on top. */
function mascot({ name, shapes, defs = "", over = "", under = "" }) {
  const bg = background("paper");
  return svg({
    name: `Get Some Proof, ${name}`,
    defs: `${bg.defs}${vgrad("body", C.amberLight, C.amberDeep, 200, 860)}${vgrad("bodyDark", C.amberDeep, C.amberDark, 150, 700)}${plasticFilter("plastic", { rim: 0.8, shade: 0.24, rimSize: 16, shadeSize: 28, shadeColor: C.amberShade })}${dropShadow("shadow", { color: C.paperShade, opacity: 0.32, blur: 24, dy: 34 })}${defs}`,
    body: `${bg.body}
${cast("shadow", paths(shapes, ""))}
${under}
<g ${fx("plastic")}>${paths(shapes, `fill="url(#body)"`)}</g>
${over}`,
  });
}

// 11 · Star smile. The 01 mascot in amber on paper, delighted.
icons.push(() =>
  mascot({
    name: "star smile mascot",
    shapes: [star(512, 536, 364, { inner: 0.52, round: 0.2 })],
    over: `${eyes(512, 526, { gap: 132, w: 48, h: 108 })}${smile(512, 620, 88, { stroke: 26 })}`,
  }),
);

// 12 · Star tilt. Leaning star, eyes only, calm.
icons.push(() => {
  const rot = -14;
  return mascot({
    name: "star tilt mascot",
    shapes: [star(520, 540, 372, { inner: 0.5, round: 0.18, rotate: rot })],
    over: `<g transform="rotate(${rot} 520 540)">${eyes(520, 532, { gap: 140, w: 50, h: 116 })}</g>`,
  });
});

// 13 · Star chubby. A very round star, almost a flower, smiling.
icons.push(() =>
  mascot({
    name: "star chubby mascot",
    shapes: [star(512, 540, 384, { inner: 0.62, round: 0.34 })],
    over: `${eyes(512, 522, { gap: 136, w: 50, h: 110 })}${smile(512, 616, 96, { stroke: 26 })}`,
  }),
);

// 14 · Bubble buddy. An amber speech bubble with a face.
icons.push(() =>
  mascot({
    name: "bubble mascot",
    shapes: bubble({ x: 196, y: 226, w: 632, h: 500, side: "left" }),
    over: `${eyes(512, 452, { gap: 146, w: 52, h: 122 })}${smile(512, 552, 92, { stroke: 26 })}`,
  }),
);

// 15 · Seal buddy. The proof seal, now a character.
icons.push(() =>
  mascot({
    name: "seal mascot",
    shapes: seal(512, 528, 288, 12, 0.25),
    over: `${eyes(512, 500, { gap: 140, w: 50, h: 116 })}${smile(512, 598, 92, { stroke: 26 })}`,
  }),
);

// 16 · Quote buddy. One closing quote mark with eyes in its head.
icons.push(() => {
  const R = 204;
  const cx = 512;
  const cy = 418;
  const tail = [
    `M${f(cx + R * 0.98)} ${f(cy - R * 0.2)}`,
    `C${f(cx + R * 1.05)} ${f(cy + R * 0.9)} ${f(cx + R * 0.55)} ${f(cy + R * 1.75)} ${f(cx - R * 0.25)} ${f(cy + R * 2.15)}`,
    `C${f(cx + R * 0.2)} ${f(cy + R * 1.55)} ${f(cx + R * 0.35)} ${f(cy + R * 1.05)} ${f(cx - R * 0.1)} ${f(cy + R * 0.95)}`,
    "Z",
  ].join("");
  return mascot({
    name: "quote mascot",
    shapes: [circle(cx, cy, R), tail],
    over: eyes(cx, cy + 4, { gap: 122, w: 46, h: 104 }),
  });
});

// 17 · Medal buddy. A disc on two ribbons, smiling.
icons.push(() => {
  const ribbon = (angle) =>
    `<path d="${rrect(428, 96, 168, 560, 36)}" fill="url(#bodyDark)" transform="rotate(${angle} 512 620)"/>`;
  return mascot({
    name: "medal mascot",
    shapes: [circle(512, 600, 246)],
    under: `<g ${fx("plastic")}>${ribbon(-24)}${ribbon(24)}</g>`,
    over: `${eyes(512, 584, { gap: 130, w: 48, h: 108 })}${smile(512, 676, 88, { stroke: 26 })}`,
  });
});

// 18 · Magnifier buddy. The lens is the face: proof means looking closely.
icons.push(() => {
  const ring = 92;
  const cx = 468;
  const cy = 466;
  const R = 262;
  return mascot({
    name: "magnifier mascot",
    shapes: [
      circle(cx, cy, R + ring),
      capsule(cx + R * 0.74, cy + R * 0.74, 812, 812, 118),
    ],
    defs: rgrad("lens", cx - 60, cy - 70, R * 1.3, [
      [0, C.white],
      [1, C.paperDeep],
    ]),
    over: `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#lens)"/>
${eyes(cx, cy - 8, { gap: 124, w: 46, h: 104 })}${smile(cx, cy + 82, 84, { stroke: 24 })}`,
  });
});

// 19 · Stamp buddy. A postage stamp with perforated edges and eyes.
icons.push(() => {
  const x = 232;
  const y = 262;
  const w = 560;
  const h = 500;
  const holes = [];
  const step = 70;
  for (let i = 0; i <= w / step; i += 1) {
    holes.push([x + i * step, y], [x + i * step, y + h]);
  }
  for (let i = 1; i < h / step; i += 1) {
    holes.push([x, y + i * step], [x + w, y + i * step]);
  }
  return mascot({
    name: "stamp mascot",
    shapes: [rrect(x, y, w, h, 34)],
    over: `${holes.map(([hx, hy]) => `<circle cx="${hx}" cy="${hy}" r="23" fill="url(#bg)"/>`).join("")}
${eyes(512, 486, { gap: 142, w: 52, h: 120 })}${smile(512, 586, 92, { stroke: 26 })}`,
  });
});

// 20 · Envelope buddy. Proof arrives in the mail; the flap wears the face.
icons.push(() => {
  const body = rrect(212, 296, 600, 440, 56);
  const flap =
    "M212 352C212 322 236 296 268 296H756C788 296 812 322 812 352L560 566C532 588 492 588 464 566Z";
  return mascot({
    name: "envelope mascot",
    shapes: [body],
    over: `<g ${fx("plastic")}><path d="${flap}" fill="url(#bodyDark)"/></g>
${eyes(512, 420, { gap: 122, w: 44, h: 96 })}`,
  });
});

export const ICONS = [
  "star-mascot",
  "bubble-sticker",
  "quote-marks",
  "proof-seal",
  "glossy-star",
  "testimonial-bubble",
  "camera",
  "blob-mascot",
  "p-monogram",
  "star-burst",
  "star-smile-mascot",
  "star-tilt-mascot",
  "star-chubby-mascot",
  "bubble-mascot",
  "seal-mascot",
  "quote-mascot",
  "medal-mascot",
  "magnifier-mascot",
  "stamp-mascot",
  "envelope-mascot",
];

/** Index of the icon chosen as the product's app icon (03 quote marks). */
export const FLAGSHIP = 2;

/** Tight crop around the flagship subject, for the mark-only export. */
const FLAGSHIP_MARK_VIEWBOX = [200, 134, 722, 656];

/**
 * Mascots exported as marks (no squircle, transparent) for lockups next to
 * the wordmark: the blob and the tilted star. The crop leaves room for the
 * cast shadow of the shaded build.
 */
const MASCOT_MARKS = {
  7: [186, 196, 652, 704],
  11: [96, 146, 792, 866],
};

export function iconFileName(index) {
  return `${String(index + 1).padStart(2, "0")}-${ICONS[index]}`;
}

/**
 * Build one icon's SVG markup. Modes: `flat` (no filters, Figma and favicon
 * safe), `clip` (squircle mask, default true), `bare` (no background),
 * `invert` (light subject, flagship only), `viewBox` ([x, y, w, h] crop).
 */
export function buildIcon(index, options = {}) {
  return withMode(options, () => icons[index]());
}

async function write(file, content) {
  await writeFile(file, content, "utf8");
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (let i = 0; i < icons.length; i += 1) {
    await write(path.join(OUT_DIR, `${iconFileName(i)}.svg`), buildIcon(i));
  }
  const flagship = iconFileName(FLAGSHIP);
  await write(
    path.join(OUT_DIR, `${flagship}-flat.svg`),
    buildIcon(FLAGSHIP, { flat: true }),
  );
  const mark = {
    flat: true,
    clip: false,
    bare: true,
    viewBox: FLAGSHIP_MARK_VIEWBOX,
  };
  await write(
    path.join(OUT_DIR, `${flagship}-mark.svg`),
    buildIcon(FLAGSHIP, mark),
  );
  await write(
    path.join(OUT_DIR, `${flagship}-mark-on-dark.svg`),
    buildIcon(FLAGSHIP, { ...mark, invert: true }),
  );
  for (const [index, viewBox] of Object.entries(MASCOT_MARKS)) {
    const i = Number(index);
    const bare = { clip: false, bare: true, viewBox };
    await write(
      path.join(OUT_DIR, `${iconFileName(i)}-mark.svg`),
      buildIcon(i, bare),
    );
    await write(
      path.join(OUT_DIR, `${iconFileName(i)}-mark-flat.svg`),
      buildIcon(i, { ...bare, flat: true }),
    );
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
