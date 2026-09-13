import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const root = new URL("../../", import.meta.url);
const asset = async (path, mime) =>
  `data:${mime};base64,${(await readFile(new URL(path, root))).toString("base64")}`;
const font = await asset(
  "src/app/fonts/gelica/Gelica-Black.woff2",
  "font/woff2",
);
const mascot = await asset("public/brand/blob/happy.svg", "image/svg+xml");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html lang="fr"><meta charset="utf-8"><style>
    @font-face{font-family:Gelica;src:url('${font}');font-weight:900}
    *{box-sizing:border-box}body{margin:0;background:#FCFAF5;color:#2E2A25}
    main{position:relative;width:1200px;height:630px;overflow:hidden;padding:65px 70px}
    h1{position:relative;z-index:1;font-family:Gelica,serif;font-weight:900;font-size:86px;line-height:1.06;letter-spacing:-1.5px;margin:105px 0 0}
    .wordmark{position:absolute;left:70px;top:60px;font:900 32px Gelica,serif;letter-spacing:-0.5px}
    .mascot{position:absolute;right:30px;top:150px;width:440px;height:440px;transform:rotate(-8deg)}
    .underline{position:absolute;left:65px;top:455px;width:500px;height:24px}
  </style><main><div class="wordmark">Get Some Proof</div><h1>Récupérez<br>vos avis<br>clients.</h1>
  <svg class="underline" viewBox="0 0 575 24" fill="none"><path d="M5 14 Q170 1 315 12 T566 9" stroke="#FFBB16" stroke-width="12" stroke-linecap="round"/></svg>
  <img class="mascot" src="${mascot}" alt="Happy amber Get Some Proof mascot">
  </main></html>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.screenshot({
    path: new URL("public/brand/social-card.png", root).pathname,
  });
} finally {
  await browser.close();
}
