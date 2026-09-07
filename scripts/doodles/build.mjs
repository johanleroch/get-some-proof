// Builds the spot illustrations of the hand-drawn signature (DESIGN.md
// section 4) as React components in src/components/doodles/spots.tsx.
//
// Every drawing shares one grammar so the set stays coherent:
// - a 320 x 220 artboard, subjects tilted 2 to 6 degrees;
// - closed outlines whose sides bow by at most one unit while corners land on
//   exact coordinates, so strokes never step or hook;
// - overlapping shapes filled with `--surface` so they occlude cleanly;
// - amber (`--brand`) only on stars, sparkles and one accent dot;
// - one to three sparkles of 4 to 7 units per drawing.
//
// Randomness is seeded per drawing, so the output is stable. Regenerate with
// `pnpm doodles:build`; review the sheet with
// `node scripts/doodles/build.mjs --preview <file.html>`.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTBOARD = "0 0 320 220";
const SURFACE = "surface";
const BRAND = "brand";
const OUT_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/components/doodles/spots.tsx",
);

/** Small deterministic PRNG (mulberry32) so a seed always draws the same lines. */
function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value, digits = 1) => Number(value.toFixed(digits));

function pen(seed) {
  const random = prng(seed);
  const j = (amplitude = 0.9) => round(random() * 2 * amplitude - amplitude);

  /** Rounded rectangle, sides bowing gently, corners exact. */
  const rect = (x, y, w, h, r = 8) => {
    const x2 = x + w;
    const y2 = y + h;
    return [
      `M${x + r} ${y}`,
      `C${round(x + w * 0.33)} ${y + j()},${round(x + w * 0.66)} ${y + j()},${x2 - r} ${y}`,
      `Q${x2} ${y},${x2} ${y + r}`,
      `C${x2 + j()} ${round(y + h * 0.33)},${x2 + j()} ${round(y + h * 0.66)},${x2} ${y2 - r}`,
      `Q${x2} ${y2},${x2 - r} ${y2}`,
      `C${round(x + w * 0.66)} ${y2 + j()},${round(x + w * 0.33)} ${y2 + j()},${x + r} ${y2}`,
      `Q${x} ${y2},${x} ${y2 - r}`,
      `C${x + j()} ${round(y + h * 0.66)},${x + j()} ${round(y + h * 0.33)},${x} ${y + r}`,
      `Q${x} ${y},${x + r} ${y}Z`,
    ].join("");
  };

  /** Speech bubble: a rect whose bottom edge grows a tail between two points. */
  const bubble = (x, y, w, h, r, tailLeft, tailRight, tip) => {
    const x2 = x + w;
    const y2 = y + h;
    return [
      `M${x + r} ${y}`,
      `C${round(x + w * 0.33)} ${y + j()},${round(x + w * 0.66)} ${y + j()},${x2 - r} ${y}`,
      `Q${x2} ${y},${x2} ${y + r}`,
      `C${x2 + j()} ${round(y + h * 0.33)},${x2 + j()} ${round(y + h * 0.66)},${x2} ${y2 - r}`,
      `Q${x2} ${y2},${x2 - r} ${y2}`,
      `Q${round((x2 - r + tailRight) / 2)} ${y2 + j(0.6)},${tailRight} ${y2}`,
      `Q${round((tailRight + tip[0]) / 2 + 2)} ${round((y2 + tip[1]) / 2)},${tip[0]} ${tip[1]}`,
      `Q${round((tailLeft + tip[0]) / 2 - 1)} ${round((y2 + tip[1]) / 2 + 2)},${tailLeft} ${y2}`,
      `Q${round((tailLeft + x + r) / 2)} ${y2 + j(0.6)},${x + r} ${y2}`,
      `Q${x} ${y2},${x} ${y2 - r}`,
      `C${x + j()} ${round(y + h * 0.66)},${x + j()} ${round(y + h * 0.33)},${x} ${y + r}`,
      `Q${x} ${y},${x + r} ${y}Z`,
    ].join("");
  };

  /** A line of handwriting: a shallow wave. */
  const line = (x1, y, x2, amplitude = 0.8) => {
    const n = Math.max(2, Math.floor((x2 - x1) / 18));
    const step = (x2 - x1) / n;
    let d = `M${x1} ${y}`;
    for (let i = 0; i < n; i += 1) {
      const cx = round(x1 + step * (i + 0.5));
      const cy = round(y + (i % 2 ? amplitude : -amplitude));
      d += `Q${cx} ${cy},${round(x1 + step * (i + 1))} ${y}`;
    }
    return d;
  };

  /** Five-point star, slightly uneven. */
  const star = (cx, cy, r) => {
    const points = [
      [0, -1],
      [0.3, -0.3],
      [1, -0.3],
      [0.45, 0.15],
      [0.6, 0.85],
      [0, 0.45],
      [-0.6, 0.85],
      [-0.45, 0.15],
      [-1, -0.3],
      [-0.3, -0.3],
    ];
    return (
      points
        .map(([x, y], index) => {
          const jitter = index % 2 === 0 ? 0.04 : -0.03;
          return `${index === 0 ? "M" : "L"}${round(cx + (x + jitter) * r)} ${round(cy + y * r)}`;
        })
        .join("") + "Z"
    );
  };

  /** Circle from four bowed arcs, closed on its start point. */
  const circle = (cx, cy, r) => {
    const k = round(r * 0.552, 2);
    const jj = () => round(random() * 0.7 - 0.35, 2);
    return (
      `M${cx + r} ${cy}` +
      `C${cx + r + jj()} ${cy + k},${cx + k} ${cy + r + jj()},${cx} ${cy + r}` +
      `C${cx - k} ${cy + r + jj()},${cx - r + jj()} ${cy + k},${cx - r} ${cy}` +
      `C${cx - r + jj()} ${cy - k},${cx - k} ${cy - r + jj()},${cx} ${cy - r}` +
      `C${cx + k} ${cy - r + jj()},${cx + r + jj()} ${cy - k},${cx + r} ${cy}Z`
    );
  };

  /** Four-point sparkle. */
  const sparkle = (cx, cy, r) => {
    const k = round(r * 0.28);
    return (
      `M${cx} ${cy - r}c0 ${r - k} ${k} ${r} ${r} ${r}c-${r - k} 0-${r} ${k}-${r} ${r}` +
      `c0-${r - k}-${k}-${r}-${r}-${r}c${r - k} 0 ${r}-${k} ${r}-${r}z`
    );
  };

  /** Opening quotation marks. */
  const quotes = (x, y) =>
    `M${x} ${y}c-4 1-6 5-5 9 1 3 4 4 7 3 3-2 2-6-1-7` +
    `M${x + 16} ${y}c-4 1-6 5-5 9 1 3 4 4 7 3 3-2 2-6-1-7`;

  const stars = (xs, y, r) => xs.map((x) => star(x, y, r)).join("");

  return { bubble, circle, line, quotes, rect, sparkle, star, stars };
}

const group = (transform, paths) => ({ paths, transform });
const stroke = (d) => ({ d });
const filled = (d, fill) => ({ d, fill });

const spots = [
  {
    doc: [
      "Two speech bubbles: a five-star Testimonial with two lines of",
      "handwriting, and a smaller bubble with quotation marks behind it.",
    ],
    draw(p) {
      return [
        group("rotate(3 242 74)", [
          filled(p.bubble(196, 44, 94, 60, 14, 214, 232, [206, 122]), SURFACE),
          stroke(p.quotes(224, 66)),
        ]),
        group("rotate(-2 130 128)", [
          filled(p.bubble(40, 70, 180, 106, 16, 72, 94, [64, 200]), SURFACE),
          filled(p.stars([74, 98, 122, 146, 170], 112, 10), BRAND),
          stroke(p.line(72, 142, 188)),
          stroke(p.line(72, 156, 150)),
        ]),
        group("", [
          filled(p.sparkle(30, 46, 6), BRAND),
          filled(p.sparkle(300, 150, 7), BRAND),
          filled(p.sparkle(268, 24, 4), BRAND),
        ]),
      ];
    },
    name: "SpeechBubbleStars",
    seed: 11,
  },
  {
    doc: ["Camera on a tripod, recording light on."],
    draw(p) {
      return [
        group("", [
          stroke("M160 170v14"),
          stroke("M160 184c-14 12-28 24-42 36"),
          stroke("M160 184c14 12 28 24 42 36"),
          stroke("M160 184v34"),
          stroke("M112 218l8 4M208 218l-8 4M154 218h12"),
          filled(p.circle(160, 184, 6), SURFACE),
          stroke("M126 78l8-14h52l8 14"),
          stroke("M98 78v-8h18v8"),
          filled(p.rect(80, 78, 160, 92, 14), SURFACE),
          filled(p.circle(160, 124, 30), SURFACE),
          stroke(p.circle(160, 124, 18)),
          stroke("M147 115c3-5 8-8 14-9"),
          filled(p.circle(214, 98, 5), BRAND),
          stroke("M96 100h10M96 108h6"),
        ]),
        group("", [
          filled(p.sparkle(274, 60, 7), BRAND),
          filled(p.sparkle(52, 150, 5), BRAND),
        ]),
      ];
    },
    name: "CameraTripod",
    seed: 23,
  },
  {
    doc: ["Sealed envelope with a postmark and a star stamp."],
    draw(p) {
      return [
        group("rotate(-2 160 126)", [
          filled(p.rect(44, 60, 232, 132, 12), SURFACE),
          stroke("M46 66C90 96,128 124,160 148C192 124,230 96,274 66"),
          stroke("M46 188C74 166,98 148,118 132"),
          stroke("M274 188C246 166,222 148,202 132"),
          stroke(p.line(168, 88, 206)),
          stroke(p.line(176, 98, 206)),
          filled(p.rect(214, 72, 46, 40, 3), SURFACE),
          stroke(p.rect(219, 77, 36, 30, 2)),
          filled(p.star(237, 92, 11), BRAND),
        ]),
        group("", [
          filled(p.sparkle(300, 46, 7), BRAND),
          filled(p.sparkle(30, 200, 5), BRAND),
        ]),
      ];
    },
    name: "EnvelopeStamp",
    seed: 37,
  },
  {
    doc: [
      "A wall of customer proof: a text Testimonial with its five stars, a",
      "video Testimonial and a short quote, pinned at slight angles.",
    ],
    draw(p) {
      return [
        group("rotate(-6 72 158)", [
          filled(p.rect(26, 122, 92, 72, 8), SURFACE),
          stroke(p.quotes(44, 140)),
          stroke(p.line(44, 162, 104)),
          stroke(p.line(44, 172, 90)),
          stroke(p.line(44, 182, 72)),
        ]),
        group("rotate(4 258 98)", [
          filled(p.rect(210, 32, 96, 132, 9), SURFACE),
          stroke(p.circle(258, 88, 15)),
          stroke("M253 80l12 8-12 8z"),
          stroke(p.line(222, 134, 276)),
          stroke(p.line(222, 144, 254)),
        ]),
        group("rotate(-2.5 130 121)", [
          filled(p.rect(52, 62, 156, 118, 9), SURFACE),
          stroke(p.circle(76, 88, 11)),
          stroke(p.line(94, 84, 148)),
          stroke(p.line(94, 93, 128)),
          filled(p.stars([76, 90, 104, 118, 132], 112, 5.6), BRAND),
          stroke(p.line(76, 131, 190)),
          stroke(p.line(76, 142, 178)),
          stroke(p.line(76, 153, 152)),
        ]),
        group("", [
          filled(p.sparkle(34, 52, 7), BRAND),
          filled(p.sparkle(186, 28, 5), BRAND),
          filled(p.sparkle(300, 196, 6), BRAND),
        ]),
      ];
    },
    name: "WallFrames",
    seed: 7,
  },
];

function fillAttribute(fill) {
  return fill ? ` fill="var(--${fill})"` : "";
}

function componentSource(spot) {
  const groups = spot.draw(pen(spot.seed));
  const body = groups
    .map((g) => {
      const open = g.transform
        ? `      <g transform="${g.transform}">`
        : "      <g>";
      const paths = g.paths.map(
        (item) =>
          `        <path {...strokeAttributes} d="${item.d}"${fillAttribute(item.fill)} />`,
      );
      return [open, ...paths, "      </g>"].join("\n");
    })
    .join("\n");
  const doc = spot.doc.map((line) => ` * ${line}`).join("\n");
  return `/**\n${doc}\n */\nexport function ${spot.name}(props: DoodleProps) {\n  return (\n    <svg {...doodleProps(props, "${ARTBOARD}")}>\n${body}\n    </svg>\n  );\n}\n`;
}

function fileSource() {
  const header = [
    "// Generated by scripts/doodles/build.mjs. Edit the script, not this file:",
    "// `pnpm doodles:build` rewrites it. DESIGN.md section 4 sets the grammar.",
    "",
    'import { doodleProps, type DoodleProps, strokeAttributes } from "./doodle";',
    "",
    "/** Artboard shared by every spot illustration. */",
    `export const spotViewBox = "${ARTBOARD}";`,
    "",
  ].join("\n");
  return header + spots.map(componentSource).join("\n");
}

function svgSource(spot) {
  const groups = spot.draw(pen(spot.seed));
  const body = groups
    .map((g) => {
      const open = g.transform ? `<g transform="${g.transform}">` : "<g>";
      const paths = g.paths.map(
        (item) =>
          `<path d="${item.d}"${fillAttribute(item.fill)} pathLength="1" vector-effect="non-scaling-stroke"/>`,
      );
      return [open, ...paths, "</g>"].join("");
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ARTBOARD}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function previewSource() {
  const panels = spots
    .map((spot) => {
      const svg = svgSource(spot);
      return `<div class="panel"><div>${svg}</div><p>${spot.name}</p></div><div class="panel dark"><div>${svg}</div></div><div class="panel small"><div>${svg}</div></div>`;
    })
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Spot illustrations</title><style>
body{margin:0;display:grid;grid-template-columns:2fr 2fr 1fr;gap:24px;padding:24px;background:#fff;font-family:system-ui}
.panel{background:#f5f1ea;padding:28px;border-radius:12px;color:#2e2a25;--brand:#ffbb16;--surface:#fff}
.dark{background:#2a2522;color:#eeebe4;--surface:#211c18}
svg{width:100%;height:auto}.small svg{width:160px}p{margin:8px 0 0;font-size:13px;color:#6b655c}
</style>${panels}`;
}

const previewIndex = process.argv.indexOf("--preview");
if (previewIndex !== -1) {
  const target = process.argv[previewIndex + 1];
  if (!target) throw new Error("--preview needs a file path");
  await writeFile(target, previewSource());
  console.log(`Preview sheet: ${target}`);
} else {
  await writeFile(OUT_FILE, fileSource());
  console.log(
    `Wrote ${path.relative(process.cwd(), OUT_FILE)} (${spots.length} spots)`,
  );
}
