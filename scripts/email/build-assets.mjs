// Renders the two images the transactional emails need as PNGs under
// public/brand/email: the lockup, and the envelope on its way. Mail clients
// do not draw SVG, so these are rasterised at 2x from the same sources the
// site uses (public/brand/logo.svg and the doodle script), on a transparent
// background, with the envelope's fill in the email's paper so it blends.
// Regenerate with `pnpm email:assets` whenever the logo or the doodle changes.

import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const outDir = path.join(root, "public/brand/email");

const logo = await readFile(path.join(root, "public/brand/logo.svg"), "utf8");
const envelope = execFileSync(
  process.execPath,
  [path.join(root, "scripts/doodles/build.mjs"), "--svg", "EnvelopeSent"],
  { encoding: "utf8" },
);

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:transparent;font-family:system-ui}
#logo{display:inline-block;height:28px}#logo svg{display:block;height:28px;width:auto}
#envelope{display:inline-block;height:112px;color:#26201c;--brand:#ffbb16;--surface:#fcfaf6}
#envelope svg{display:block;height:112px;width:auto}
</style><div id="logo">${logo}</div><br><div id="envelope">${envelope}</div>`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { height: 400, width: 800 },
});
await page.setContent(html);
for (const id of ["logo", "envelope"]) {
  const target = path.join(
    outDir,
    `${id === "logo" ? "logo" : "envelope-sent"}.png`,
  );
  await page
    .locator(`#${id}`)
    .screenshot({ omitBackground: true, path: target });
  const box = await page.locator(`#${id}`).boundingBox();
  console.log(
    `${path.relative(root, target)} ${Math.round(box.width)}x${Math.round(box.height)} css px`,
  );
}
await browser.close();
