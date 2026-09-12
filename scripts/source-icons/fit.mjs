/**
 * Put any brand mark on the source-badge grid.
 *
 *   pnpm icon:fit <file.svg> --slug trustpilot --label "Trustpilot"
 *
 * Give it the brand's own file, exactly as they publish it. It measures the ink
 * the way a reader sees it - rasterised, so strokes, masks and gradients all
 * count, and getBBox's blind spots do not apply - reads the silhouette, and
 * prints the entry to paste into src/components/testimonials/source-icons.ts,
 * already placed on the grid. It never touches the outline itself.
 *
 * Options:
 *   --slug <name>     key for the entry (default: the file name)
 *   --label <text>    what the badge says out loud (default: the slug, capitalised)
 *   --color <hex>     brand colour; taken from the file when it uses only one
 *   --shape <name>    square | letter | circle | portrait | landscape
 *                     (default: read from the ink; pass `letter` for a bare
 *                     letterform such as an f or a P)
 *   --json            print the measurements instead of the entry
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

import { classify, fitFor, looksLikeLetter, SHAPES } from "./grid.mjs";

const SAMPLES = 640;

function parseArgs(argv) {
  const args = { file: undefined, json: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--json") args.json = true;
    else if (token.startsWith("--")) args[token.slice(2)] = argv[++i];
    else args.file ??= token;
  }
  return args;
}

/** Strip everything around the drawing and keep the source coordinate system. */
function readSvg(source) {
  const cleaned = source
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/<desc>[\s\S]*?<\/desc>/g, "");
  const open = cleaned.match(/<svg\b([^>]*)>/i);
  if (!open) throw new Error("No <svg> element found");
  if (/<style[\s>]/i.test(cleaned)) {
    // An SVG <style> is scoped to the document, not the svg, and this markup is
    // injected into pages we do not own: a .fil0 rule would repaint theirs.
    throw new Error(
      "This file paints through a <style> block. Inline its fills onto the shapes " +
        "(most editors export that way) and run the tool again.",
    );
  }
  const inner = cleaned
    .slice(open.index + open[0].length, cleaned.lastIndexOf("</svg>"))
    .trim();
  const viewBox = open[1].match(/viewBox="([^"]+)"/i);
  if (viewBox) {
    const [x, y, width, height] = viewBox[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    return { inner, view: { x, y, width, height } };
  }
  const width = Number(open[1].match(/\bwidth="([\d.]+)/i)?.[1]);
  const height = Number(open[1].match(/\bheight="([\d.]+)/i)?.[1]);
  if (!width || !height)
    throw new Error("No viewBox and no usable width/height");
  return { inner, view: { x: 0, y: 0, width, height } };
}

/**
 * A mark in one colour inherits `currentColor` like the rest of the family, so
 * the chip can tint it. A mark that carries several keeps every one of them.
 */
const COLOUR = "(#[0-9a-fA-F]{3,8}|[a-z]+)";

function monochrome(markup) {
  const fills = [
    ...markup.matchAll(new RegExp(`fill="${COLOUR}"`, "g")),
    ...markup.matchAll(new RegExp(`fill:\\s*${COLOUR}`, "g")),
  ]
    .map((match) => match[1])
    .filter((value) => value !== "none" && value !== "currentColor");
  const distinct = [...new Set(fills.map((value) => value.toLowerCase()))];
  if (distinct.length !== 1)
    return { markup, color: distinct[0], multicolour: distinct.length > 1 };
  return {
    markup: markup
      .replace(/\s*fill="(?!none|currentColor)[^"]*"/g, "")
      .replace(/\s*fill:\s*(?!none|currentColor)[^;"]*;?/g, ""),
    color: distinct[0],
    multicolour: false,
  };
}

async function measure(page, markup, view, { padded }) {
  return page.evaluate(
    async ({ markup, view, padded, samples }) => {
      const pad = padded ? Math.max(view.width, view.height) * 0.25 : 0;
      const box = {
        x: view.x - pad,
        y: view.y - pad,
        width: view.width + pad * 2,
        height: view.height + pad * 2,
      };
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${samples}" height="${samples}" ` +
        `viewBox="${box.x} ${box.y} ${box.width} ${box.height}" fill="#000">${markup}</svg>`;
      const image = new Image();
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = samples;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, samples, samples);
      const ink = (x, y) => data[(y * samples + x) * 4 + 3] > 24;

      let minX = samples,
        minY = samples,
        maxX = -1,
        maxY = -1;
      for (let y = 0; y < samples; y++) {
        for (let x = 0; x < samples; x++) {
          if (!ink(x, y)) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) throw new Error("The file draws nothing");

      // Ink in the corners of its own bounds is what tells a square from a disc.
      const inset = 0.18;
      const spanX = maxX - minX + 1;
      const spanY = maxY - minY + 1;
      const cornerW = Math.max(2, Math.round(spanX * inset));
      const cornerH = Math.max(2, Math.round(spanY * inset));
      const corners = [
        [minX, minY],
        [maxX - cornerW + 1, minY],
        [minX, maxY - cornerH + 1],
        [maxX - cornerW + 1, maxY - cornerH + 1],
      ].map(([x0, y0]) => {
        let hits = 0;
        for (let y = y0; y < y0 + cornerH; y++)
          for (let x = x0; x < x0 + cornerW; x++) if (ink(x, y)) hits++;
        return hits / (cornerW * cornerH);
      });

      const unit = box.width / samples;
      return {
        x: minX * unit + box.x,
        y: minY * unit + box.y,
        width: spanX * unit,
        height: spanY * unit,
        corners,
        cornerRatio:
          corners.reduce((total, value) => total + value, 0) / corners.length,
      };
    },
    { markup, view, padded, samples: SAMPLES },
  );
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error(
    "Usage: pnpm icon:fit <file.svg> [--slug x] [--label X] [--shape square|letter|circle|portrait|landscape]",
  );
  process.exit(1);
}
if (args.shape && !SHAPES.includes(args.shape)) {
  console.error(
    `Unknown --shape "${args.shape}", expected ${SHAPES.join(", ")}`,
  );
  process.exit(1);
}

const slug =
  args.slug ??
  path
    .basename(args.file)
    .replace(/\.svg$/i, "")
    .toLowerCase();
if (!/^[a-z][a-z0-9]*$/.test(slug)) {
  console.error(
    `"${slug}" cannot be the key of an entry. Pass --slug with letters and digits only.`,
  );
  process.exit(1);
}
const label = args.label ?? slug[0].toUpperCase() + slug.slice(1);
const { inner, view } = readSvg(await readFile(args.file, "utf8"));
const { markup, color, multicolour } = monochrome(
  inner.replace(/\s+/g, " ").trim(),
);

const browser = await chromium.launch();
let bounds;
let shape;
let fit;
let placed;
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><body>");
  bounds = await measure(page, markup, view, { padded: true });
  shape = args.shape ?? classify(bounds);
  fit = fitFor(bounds, shape);
  placed = await measure(
    page,
    `<g transform="${fit.transform}">${markup}</g>`,
    { x: 0, y: 0, width: 24, height: 24 },
    { padded: true },
  );
} finally {
  await browser.close();
}

const entry =
  `  ${slug}: {\n` +
  `    color: "${args.color ?? color ?? "#000000"}",\n` +
  `    fit: "${fit.transform}",\n` +
  `    label: "${label}",\n` +
  `    markup:\n      '${markup.replaceAll("'", "\\'")}',\n` +
  `  },`;

if (args.json) {
  console.log(
    JSON.stringify({ slug, label, shape, bounds, fit, placed }, null, 2),
  );
} else {
  const centre = `${(placed.x + placed.width / 2).toFixed(2)}, ${(placed.y + placed.height / 2).toFixed(2)}`;
  console.log(`\n${label} - read as a ${shape}`);
  console.log(
    `  file       ${args.file} (viewBox ${view.x} ${view.y} ${view.width} ${view.height})`,
  );
  console.log(
    `  measured   ${bounds.width.toFixed(2)} x ${bounds.height.toFixed(2)} at ${bounds.x.toFixed(2)}, ${bounds.y.toFixed(2)}  (corners ${bounds.cornerRatio.toFixed(2)})`,
  );
  console.log(
    `  placed     ${placed.width.toFixed(2)} x ${placed.height.toFixed(2)}, centre ${centre} of 12, 12`,
  );
  if (multicolour)
    console.log(
      `  colours    several kept as published; "color" only tints the kit swatch`,
    );
  if (!args.shape && looksLikeLetter(bounds))
    console.log(
      `  note       narrow enough to be a letterform - try --shape letter (18.5 instead of ${shape === "portrait" ? 20 : fitFor(bounds, shape).height})`,
    );
  console.log(`\nPaste into src/components/testimonials/source-icons.ts:\n`);
  console.log(entry);
  console.log("");
}
