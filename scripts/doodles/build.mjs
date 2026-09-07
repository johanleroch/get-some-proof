// Builds the hand-drawn signature (DESIGN.md section 4) as React components:
// the spot illustrations in src/components/doodles/spots.tsx and the marks
// (star, underline, ring, arrows) in src/components/doodles/marks.tsx.
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
const DOODLES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/components/doodles",
);
const OUT_FILE = path.join(DOODLES_DIR, "spots.tsx");
const MARKS_FILE = path.join(DOODLES_DIR, "marks.tsx");

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

/**
 * Length of a path in user units, by flattening its curves.
 *
 * The draw-in animation dashes each stroke by its own length. `pathLength="1"`
 * would be tidier, but Chromium ignores it on a path that also carries
 * `vector-effect: non-scaling-stroke`, and the stroke then appears whole from
 * the first frame. Supports the commands this file emits (M, L, H, V, C, S,
 * Q, T, Z, absolute and relative); arcs are never generated.
 */
function pathLength(d) {
  const tokens = d.match(/[a-df-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const samples = 24;
  let index = 0;
  let command = "";
  let [x, y] = [0, 0];
  let [startX, startY] = [0, 0];
  let [lastControlX, lastControlY] = [0, 0];
  let total = 0;

  const next = () => Number(tokens[index++]);
  const line = (toX, toY) => {
    total += Math.hypot(toX - x, toY - y);
    [x, y] = [toX, toY];
  };
  const curve = (points) => {
    let [previousX, previousY] = [x, y];
    for (let step = 1; step <= samples; step += 1) {
      const t = step / samples;
      const [pointX, pointY] = bezier(points, t);
      total += Math.hypot(pointX - previousX, pointY - previousY);
      [previousX, previousY] = [pointX, pointY];
    }
    [x, y] = points[points.length - 1];
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (/[a-z]/i.test(token)) {
      command = token;
      index += 1;
    } else if (command === "M") {
      command = "L";
    } else if (command === "m") {
      command = "l";
    }
    const relative = command === command.toLowerCase();
    const [originX, originY] = relative ? [x, y] : [0, 0];
    switch (command.toUpperCase()) {
      case "M": {
        [x, y] = [originX + next(), originY + next()];
        [startX, startY] = [x, y];
        [lastControlX, lastControlY] = [x, y];
        break;
      }
      case "L": {
        line(originX + next(), originY + next());
        [lastControlX, lastControlY] = [x, y];
        break;
      }
      case "H": {
        line(originX + next(), y);
        [lastControlX, lastControlY] = [x, y];
        break;
      }
      case "V": {
        line(x, originY + next());
        [lastControlX, lastControlY] = [x, y];
        break;
      }
      case "C": {
        const c1 = [originX + next(), originY + next()];
        const c2 = [originX + next(), originY + next()];
        const end = [originX + next(), originY + next()];
        curve([[x, y], c1, c2, end]);
        [lastControlX, lastControlY] = c2;
        break;
      }
      case "S": {
        const c1 = [2 * x - lastControlX, 2 * y - lastControlY];
        const c2 = [originX + next(), originY + next()];
        const end = [originX + next(), originY + next()];
        curve([[x, y], c1, c2, end]);
        [lastControlX, lastControlY] = c2;
        break;
      }
      case "Q": {
        const control = [originX + next(), originY + next()];
        const end = [originX + next(), originY + next()];
        curve([[x, y], control, end]);
        [lastControlX, lastControlY] = control;
        break;
      }
      case "T": {
        const control = [2 * x - lastControlX, 2 * y - lastControlY];
        const end = [originX + next(), originY + next()];
        curve([[x, y], control, end]);
        [lastControlX, lastControlY] = control;
        break;
      }
      case "Z": {
        line(startX, startY);
        break;
      }
      default: {
        index += 1;
      }
    }
  }
  return Math.round(total);
}

/** De Casteljau on a quadratic or cubic control polygon. */
function bezier(points, t) {
  let current = points;
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length - 1; i += 1) {
      next.push([
        current[i][0] + (current[i + 1][0] - current[i][0]) * t,
        current[i][1] + (current[i + 1][1] - current[i][1]) * t,
      ]);
    }
    current = next;
  }
  return current[0];
}

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

  /** Smooth cubic path through points (Catmull-Rom), open or closed. */
  const through = (points, { close = false } = {}) => {
    const n = points.length;
    const at = (i) =>
      points[close ? (i + n) % n : Math.min(Math.max(i, 0), n - 1)];
    let d = `M${round(points[0][0])} ${round(points[0][1])}`;
    const last = close ? n : n - 1;
    for (let i = 0; i < last; i += 1) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${round(c1[0])} ${round(c1[1])},${round(c2[0])} ${round(c2[1])},${round(p2[0])} ${round(p2[1])}`;
    }
    return close ? d + "Z" : d;
  };

  /** Five-point star outline with slightly concave edges, closed. */
  const starOutline = (cx, cy, outer, inner) => {
    const tips = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = (i % 2 === 0 ? outer : inner) + j(0.5);
      tips.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
    let d = `M${round(tips[0][0])} ${round(tips[0][1])}`;
    for (let i = 0; i < 10; i += 1) {
      const a = tips[i];
      const b = tips[(i + 1) % 10];
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      // pull the control point toward the center so edges bow inward a touch
      const cxp = mx + (cx - mx) * 0.12;
      const cyp = my + (cy - my) * 0.12;
      d += `Q${round(cxp)} ${round(cyp)},${round(b[0])} ${round(b[1])}`;
    }
    return d + "Z";
  };

  /** Marker swash: a tapered wave filled with the current color. */
  const marker = (x1, x2, y, amplitude, waves, thickness) => {
    const samples = 28;
    const top = [];
    const bottom = [];
    for (let i = 0; i <= samples; i += 1) {
      const u = i / samples;
      const x = x1 + (x2 - x1) * u;
      const wave = Math.sin(u * waves * Math.PI * 2 - Math.PI / 2) * amplitude;
      const t = thickness * (0.35 + 0.65 * Math.sin(u * Math.PI));
      top.push([x, y + wave - t / 2]);
      bottom.push([x, y + wave + t / 2]);
    }
    return through([...top, ...bottom.reverse()], { close: true });
  };

  /** Highlighter band: wavy edges, rounded tapered ends, filled with the current color. */
  const highlight = (x1, x2, y, height) => {
    const samples = 22;
    const top = [];
    const bottom = [];
    for (let i = 0; i <= samples; i += 1) {
      const u = i / samples;
      const x = x1 + (x2 - x1) * u;
      const ease = Math.min(1, Math.sin(u * Math.PI) * 2.2);
      const h = height * (0.72 + 0.28 * ease);
      const drift = Math.sin(u * Math.PI * 2.3 + 0.6) * height * 0.06;
      top.push([x, y - h / 2 + drift + j(0.4)]);
      bottom.push([x, y + h / 2 + drift * 0.6 + j(0.4)]);
    }
    return through([...top, ...bottom.reverse()], { close: true });
  };

  /** A loop drawn once and a bit, the second pass just outside the first. */
  const loop = (cx, cy, rx, ry, turns = 1.18) => {
    const points = [];
    const start = Math.PI * 0.92;
    const steps = 44;
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      const angle = start + u * turns * Math.PI * 2;
      const grow = 1 + 0.075 * u * turns + 0.015 * Math.sin(angle * 3 + 1);
      points.push([
        cx + Math.cos(angle) * rx * grow,
        cy + Math.sin(angle) * ry * grow,
      ]);
    }
    return through(points);
  };

  return {
    bubble,
    circle,
    highlight,
    line,
    loop,
    marker,
    quotes,
    rect,
    sparkle,
    star,
    starOutline,
    stars,
    through,
  };
}

const group = (transform, paths) => ({ paths, transform });
const stroke = (d) => ({ d });
const filled = (d, fill, extra = {}) => ({ d, fill, ...extra });

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

const marks = [
  {
    doc: [
      "A big four-point sparkle with a small one, the accent that also lights",
      "every illustration. Filled with the current color.",
    ],
    draw(p) {
      return [
        group("", [
          filled(p.sparkle(21, 27, 18), "currentColor", { stroke: "none" }),
          filled(p.sparkle(40, 10, 7), "currentColor", { stroke: "none" }),
        ]),
      ];
    },
    name: "Sparkle",
    seed: 41,
    viewBox: "0 0 48 48",
  },
  {
    color: "text-brand-soft-2",
    doc: [
      "A highlighter stroke behind one key word, in a soft amber unless the",
      "caller sets another text color. Stretches to its container; place it",
      "before the word in the DOM so the text paints on top.",
    ],
    draw(p) {
      return [
        group("rotate(-1.2 60 20)", [
          filled(p.highlight(2, 118, 20, 30), "currentColor", {
            stroke: "none",
          }),
        ]),
      ];
    },
    name: "MarkerHighlight",
    preserveAspectRatio: "none",
    seed: 43,
    viewBox: "0 0 120 40",
  },
  {
    color: "text-brand",
    doc: [
      "A ring drawn once and a bit around a number or a short label, in the",
      "brand color unless the caller sets another text color.",
    ],
    draw(p) {
      return [group("rotate(-4 60 30)", [stroke(p.loop(60, 31, 50, 21))])];
    },
    name: "CircleAround",
    seed: 47,
    viewBox: "0 0 120 60",
  },
];

/** Arrow strokes for SketchArrow; both point right, mirrored by the caller. */
const arrows = {
  curve: {
    paths: ["M6 9c14 2 32 7 45 22 4 5 7 10 9 16", "M52 42l9 5-1-11"],
    viewBox: "0 0 80 60",
  },
  flat: {
    paths: ["M4 15c12-7 26-9 40-6 11 2 20 3 30 2", "M65 4l9 7-10 5"],
    viewBox: "0 0 80 24",
  },
};

function fillAttribute(fill, stroke) {
  const fillPart = !fill
    ? ""
    : fill === "currentColor"
      ? ' fill="currentColor"'
      : ` fill="var(--${fill})"`;
  return fillPart + (stroke === "none" ? ' stroke="none"' : "");
}

/**
 * Timings for one group. `draw` staggers the ink so a drawing appears object
 * by object, stroke by stroke, instead of every line at once; `float` gives
 * each object its own slow drift, out of phase with its neighbours.
 */
function groupMotion(index) {
  return {
    drawDelay: index * 130,
    floatDelay: -(index * 1.3 + 0.4),
    floatDistance: index % 2 === 0 ? -6 : -4,
    floatDuration: 5.4 + index * 0.9,
  };
}

function componentSource(spot) {
  const viewBox = spot.viewBox ?? ARTBOARD;
  const extra = spot.preserveAspectRatio
    ? ` preserveAspectRatio="${spot.preserveAspectRatio}"`
    : "";
  const groups = spot.draw(pen(spot.seed));
  const body = groups
    .map((g, index) => {
      const motion = groupMotion(index);
      // The outer group carries the drift, so the inner one keeps its tilt:
      // a CSS transform would otherwise replace the `transform` attribute.
      const wrapper =
        `      <g\n` +
        `        className="doodle-item"\n` +
        `        style={\n` +
        `          {\n` +
        `            animationDelay: "${motion.floatDelay}s",\n` +
        `            animationDuration: "${motion.floatDuration}s",\n` +
        `            "--doodle-float": "${motion.floatDistance}px",\n` +
        `          } as CSSProperties\n` +
        `        }\n` +
        `      >`;
      const open = g.transform
        ? `        <g transform="${g.transform}">`
        : "        <g>";
      const paths = g.paths.map(
        (item, pathIndex) =>
          `          <path\n` +
          `            {...strokeAttributes}\n` +
          `            d="${item.d}"${fillAttribute(item.fill, item.stroke)}\n` +
          `            style={\n` +
          `              {\n` +
          `                animationDelay: "${motion.drawDelay + pathIndex * 45}ms",\n` +
          `                "--draw-length": ${pathLength(item.d)},\n` +
          `              } as CSSProperties\n` +
          `            }\n` +
          `          />`,
      );
      return [wrapper, open, ...paths, "        </g>", "      </g>"].join("\n");
    })
    .join("\n");
  const doc = spot.doc.map((line) => ` * ${line}`).join("\n");
  const propsExpression = spot.color
    ? `{ ...props, className: cn("${spot.color}", props.className) }`
    : "props";
  return `/**\n${doc}\n */\nexport function ${spot.name}(props: DoodleProps) {\n  return (\n    <svg {...doodleProps(${propsExpression}, "${viewBox}")}${extra}>\n${body}\n    </svg>\n  );\n}\n`;
}

function arrowSource() {
  const shape = (key) =>
    arrows[key].paths
      .map(
        (d) =>
          `        <path\n` +
          `          {...strokeAttributes}\n` +
          `          d="${d}"\n` +
          `          style={{ "--draw-length": ${pathLength(d)} } as CSSProperties}\n` +
          `        />`,
      )
      .join("\n");
  return [
    "/**",
    " * Arrow used with a handwritten caption. `curve` dives from the caption down",
    " * to something below it; `flat` runs sideways to something on the same line.",
    " * Both point right; mirror with `-scale-x-100` to point left.",
    " */",
    "export function SketchArrow({",
    '  shape = "curve",',
    "  ...props",
    '}: DoodleProps & { shape?: "curve" | "flat" }) {',
    '  if (shape === "flat") {',
    "    return (",
    `      <svg {...doodleProps(props, "${arrows.flat.viewBox}")}>`,
    shape("flat"),
    "      </svg>",
    "    );",
    "  }",
    "  return (",
    `    <svg {...doodleProps(props, "${arrows.curve.viewBox}")}>`,
    shape("curve"),
    "    </svg>",
    "  );",
    "}",
    "",
  ].join("\n");
}

function marksFileSource() {
  const header = [
    "// Generated by scripts/doodles/build.mjs. Edit the script, not this file:",
    "// `pnpm doodles:build` rewrites it. DESIGN.md section 4 sets the grammar.",
    "",
    'import type { CSSProperties } from "react";',
    "",
    'import { cn } from "@/lib/utils";',
    "",
    'import { doodleProps, type DoodleProps, strokeAttributes } from "./doodle";',
    "",
  ].join("\n");
  return header + marks.map(componentSource).join("\n") + "\n" + arrowSource();
}

function fileSource() {
  const header = [
    "// Generated by scripts/doodles/build.mjs. Edit the script, not this file:",
    "// `pnpm doodles:build` rewrites it. DESIGN.md section 4 sets the grammar.",
    "",
    'import type { CSSProperties } from "react";',
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
  const viewBox = spot.viewBox ?? ARTBOARD;
  const groups = spot.draw(pen(spot.seed));
  const body = groups
    .map((g) => {
      const open = g.transform ? `<g transform="${g.transform}">` : "<g>";
      const paths = g.paths.map(
        (item) =>
          `<path d="${item.d}"${fillAttribute(item.fill, item.stroke)} vector-effect="non-scaling-stroke" style="--draw-length:${pathLength(item.d)}"/>`,
      );
      return [open, ...paths, "</g>"].join("");
    })
    .join("");
  const extra = spot.preserveAspectRatio
    ? ` preserveAspectRatio="${spot.preserveAspectRatio}"`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function previewSource() {
  const markPanels = marks
    .map((mark) => {
      const svg = svgSource(mark);
      const big =
        mark.name === "MarkerHighlight"
          ? "width:260px;height:70px"
          : "height:120px";
      const small =
        mark.name === "MarkerHighlight"
          ? "width:120px;height:30px"
          : "height:40px";
      return `<div class="panel mark"><div style="${big}">${svg}</div><p>${mark.name}</p></div><div class="panel mark dark"><div style="${big}">${svg}</div></div><div class="panel mark small"><div style="${small}">${svg}</div></div>`;
    })
    .join("\n");
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
.mark div{display:inline-block}.mark svg{width:auto;height:100%}.mark.small svg{width:auto}
.doodle-item{animation-name:doodle-float;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
@keyframes doodle-float{0%,100%{transform:translateY(0)}50%{transform:translateY(var(--doodle-float,-6px))}}
</style>${markPanels}${panels}`;
}

const previewIndex = process.argv.indexOf("--preview");
if (previewIndex !== -1) {
  const target = process.argv[previewIndex + 1];
  if (!target) throw new Error("--preview needs a file path");
  await writeFile(target, previewSource());
  console.log(`Preview sheet: ${target}`);
} else {
  await writeFile(OUT_FILE, fileSource());
  await writeFile(MARKS_FILE, marksFileSource());
  console.log(
    `Wrote ${path.relative(process.cwd(), OUT_FILE)} (${spots.length} spots) and ${path.relative(process.cwd(), MARKS_FILE)} (${marks.length} marks + SketchArrow)`,
  );
}
