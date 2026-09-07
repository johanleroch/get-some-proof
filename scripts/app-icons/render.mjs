// Renders the app icon SVGs to PNG (1024 px, transparent corners), builds
// the review sheet used in docs/design/app-icons/DESIGN.md and, with
// `--install`, writes the site icons from the flagship.
//
// SVGs stay in public/brand/icons (source of truth, servable). PNGs go to
// docs/design/app-icons/png so the deployed bundle does not carry them.
//
// Usage:
//   node scripts/app-icons/render.mjs            PNG exports and the sheet
//   node scripts/app-icons/render.mjs --install  also src/app/icon.svg,
//                                                apple-icon.png, favicon.ico
// Requires the Playwright Chromium already installed for the e2e suite.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { FLAGSHIP, ICONS, buildIcon, iconFileName } from "./build.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const ICON_DIR = path.join(ROOT, "public/brand/icons");
const DOC_DIR = path.join(ROOT, "docs/design/app-icons");
const PNG_DIR = path.join(DOC_DIR, "png");
const APP_DIR = path.join(ROOT, "src/app");

const install = process.argv.includes("--install");

async function main() {
  await mkdir(PNG_DIR, { recursive: true });
  const browser = await chromium.launch();
  const svgs = [];

  for (let i = 0; i < ICONS.length; i += 1) {
    const name = iconFileName(i);
    const svg = await readFile(path.join(ICON_DIR, `${name}.svg`), "utf8");
    svgs.push({ name, svg });
    await writeFile(
      path.join(PNG_DIR, `${name}.png`),
      await renderPng(browser, svg, 1024, { transparent: true }),
    );
    console.log(`rendered ${name}.png`);
  }

  const sheet = await browser.newPage({
    viewport: { width: 1680, height: 10 },
    deviceScaleFactor: 2,
  });
  await sheet.setContent(sheetHtml(svgs));
  await sheet.screenshot({
    path: path.join(DOC_DIR, "sheet.png"),
    fullPage: true,
  });
  await sheet.close();
  console.log("rendered docs/design/app-icons/sheet.png");

  if (install) {
    await installSiteIcons(browser);
  }

  await browser.close();
}

/**
 * Site icons, all from the flagship:
 * - icon.svg: flat build (no filters), the favicon for modern browsers and
 *   the in-app brand mark (`BrandMark` reads /icon.svg).
 * - apple-icon.png: 180 px, square and opaque; iOS rounds it itself.
 * - favicon.ico: 16, 32 and 48 px PNG frames from the flat build.
 */
async function installSiteIcons(browser) {
  const flat = buildIcon(FLAGSHIP, { flat: true });
  await writeFile(path.join(APP_DIR, "icon.svg"), flat, "utf8");
  console.log("installed src/app/icon.svg");

  const square = buildIcon(FLAGSHIP, { clip: false });
  await writeFile(
    path.join(APP_DIR, "apple-icon.png"),
    await renderPng(browser, square, 180, { transparent: false }),
  );
  console.log("installed src/app/apple-icon.png");

  const frames = [];
  for (const size of [16, 32, 48]) {
    frames.push({
      size,
      png: await renderPng(browser, flat, size, { transparent: true }),
    });
  }
  await writeFile(path.join(APP_DIR, "favicon.ico"), ico(frames));
  console.log("installed src/app/favicon.ico");
}

async function renderPng(browser, svg, size, { transparent }) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const scaled = svg.replace(
    /^<svg([^>]*?) width="\d+" height="\d+"/,
    `<svg$1 width="${size}" height="${size}"`,
  );
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${scaled}</body></html>`,
  );
  const png = await page.screenshot({
    omitBackground: transparent,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
  return png;
}

/** Pack PNG frames into a .ico container (PNG-in-ICO, every modern browser). */
function ico(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const entries = [];
  const images = [];
  let offset = 6 + frames.length * 16;
  for (const { size, png } of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    images.push(png);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images]);
}

function sheetHtml(svgs) {
  const label = (name) =>
    name.replace(/^(\d+)-(.*)$/, "$1 · $2").replace(/-/g, " ");
  const tile = ({ name, svg }, size, caption = false) =>
    `<figure class="tile" style="--s:${size}px"><img class="icon" alt="${name}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}">${caption ? `<figcaption>${label(name)}</figcaption>` : ""}</figure>`;
  const row = (size, bg) =>
    `<section class="row ${bg}"><h2>${size}px</h2><div class="icons">${svgs
      .map((s) => tile(s, size))
      .join("")}</div></section>`;
  const hero = `<section class="hero">${svgs.map((s) => tile(s, 220, true)).join("")}</section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:14px/1.4 "DM Sans",system-ui,sans-serif;color:#2E2A25;background:#FCFAF5}
  main{padding:40px 48px 56px}
  h1{font:800 26px/1.1 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-0.02em;margin:0 0 6px}
  p{margin:0 0 28px;color:#6B655C}
  .row{display:grid;grid-template-columns:72px 1fr;align-items:center;gap:20px;padding:22px 24px;border-radius:16px;margin-bottom:14px;border:1px solid #E6E0D5}
  .row.paper{background:#FFFFFF}
  .row.ink{background:#1F1B18;border-color:#1F1B18;color:#FCFAF5}
  .row h2{margin:0;font:600 13px/1 "DM Sans",system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;opacity:.6}
  .icons{display:grid;grid-template-columns:repeat(10,1fr);gap:16px;align-items:center;justify-items:center}
  .tile{margin:0;width:var(--s)}
  .icon{width:var(--s);height:var(--s);display:block;filter:drop-shadow(0 1px 2px rgba(46,42,37,.10)) drop-shadow(0 6px 14px rgba(46,42,37,.10))}
  figcaption{margin-top:12px;text-align:center;font-size:13px;color:#6B655C}
  .hero{display:grid;grid-template-columns:repeat(5,220px);gap:32px 44px;justify-content:center;padding:28px 24px 36px;margin-bottom:14px;background:#FFFFFF;border:1px solid #E6E0D5;border-radius:16px}
  </style></head><body><main>
  <h1>Get Some Proof, app icon family</h1>
  <p>Ten candidates in the appicons.store grammar, built on the brand tokens. Flagship: 03 quote marks. Check legibility at 64 and 32 px before choosing.</p>
  ${hero}
  ${row(128, "paper")}
  ${row(64, "paper")}
  ${row(32, "paper")}
  ${row(128, "ink")}
  ${row(64, "ink")}
  </main></body></html>`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
