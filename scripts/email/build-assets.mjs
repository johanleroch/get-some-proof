// Renders the lockup the transactional emails show at the top as a PNG under
// public/brand/email. Mail clients do not draw SVG, so it is rasterised at
// 2x from public/brand/logo.svg, the same file the site uses, on a
// transparent background. Regenerate with `pnpm email:assets` whenever the
// logo changes.

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

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:transparent}
#logo{display:inline-block;height:28px}#logo svg{display:block;height:28px;width:auto}
</style><div id="logo">${logo}</div>`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { height: 200, width: 800 },
});
await page.setContent(html);
const target = path.join(outDir, "logo.png");
await page.locator("#logo").screenshot({ omitBackground: true, path: target });
const box = await page.locator("#logo").boundingBox();
console.log(
  `${path.relative(root, target)} ${Math.round(box.width)}x${Math.round(box.height)} css px`,
);
await browser.close();
