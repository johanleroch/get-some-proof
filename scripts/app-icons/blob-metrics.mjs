// Measures the blob expressions so consistency is a number, not a feeling.
//
// For every expression the ink layer is rasterised alone (no body), each
// connected ink mark is labelled, and its area, box and centroid are printed
// next to the official pill. Usage: node scripts/app-icons/blob-metrics.mjs
// (add --json for machine output).

import { chromium } from "@playwright/test";

import { blobExpressions } from "../../src/lib/blob-expressions.ts";

const SIZE = 1000;
const json = process.argv.includes("--json");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });

const results = [];
for (const expression of blobExpressions) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${expression.face}</svg>`;
  await page.setContent(
    `<body style="margin:0;background:#fff"><canvas id="c" width="${SIZE}" height="${SIZE}"></canvas></body>`,
  );
  const marks = await page.evaluate(
    async ({ svg, size }) => {
      const canvas = document.getElementById("c");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
      await new Promise((resolve) => (img.onload = resolve));
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      // Ink is anything darker than the paper; the white sweat drop is ignored.
      const ink = new Uint8Array(size * size);
      for (let i = 0; i < size * size; i += 1) {
        const a = data[i * 4 + 3];
        const l = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
        ink[i] = a > 128 && l < 128 ? 1 : 0;
      }
      const seen = new Uint8Array(size * size);
      const components = [];
      const stack = [];
      for (let start = 0; start < size * size; start += 1) {
        if (!ink[start] || seen[start]) continue;
        let area = 0;
        let sx = 0;
        let sy = 0;
        let minX = size;
        let minY = size;
        let maxX = 0;
        let maxY = 0;
        stack.push(start);
        seen[start] = 1;
        while (stack.length) {
          const p = stack.pop();
          const x = p % size;
          const y = (p - x) / size;
          area += 1;
          sx += x;
          sy += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          const next = [p - 1, p + 1, p - size, p + size];
          for (const q of next) {
            if (q < 0 || q >= size * size) continue;
            if (Math.abs((q % size) - x) > 1) continue;
            if (ink[q] && !seen[q]) {
              seen[q] = 1;
              stack.push(q);
            }
          }
        }
        if (area > 200) {
          components.push({
            area,
            cx: Math.round(sx / area),
            cy: Math.round(sy / area),
            w: maxX - minX + 1,
            h: maxY - minY + 1,
          });
        }
      }
      components.sort((a, b) => a.cx - b.cx);
      return components;
    },
    { svg, size: SIZE },
  );
  results.push({ name: expression.name, marks });
}
await browser.close();

const pill = results[0].marks[0];
if (json) {
  console.log(JSON.stringify({ pill, results }, null, 2));
} else {
  console.log(
    `reference pill: area ${pill.area}, box ${pill.w}x${pill.h}, centre (${pill.cx}, ${pill.cy})\n`,
  );
  console.log(
    "expression   mark  area    mass  box        centre     | symmetry",
  );
  for (const { name, marks } of results) {
    marks.forEach((m, i) => {
      const mirror = marks[marks.length - 1 - i];
      const symmetry =
        marks.length === 2 && i === 0
          ? `x ${m.cx + mirror.cx} (1000 = centred), dy ${Math.abs(m.cy - mirror.cy)}, area diff ${Math.abs(m.area - mirror.area)}`
          : "";
      console.log(
        `${name.padEnd(12)} ${String(i + 1).padStart(2)}   ${String(m.area).padStart(6)}  ${(m.area / pill.area).toFixed(2)}x  ${`${m.w}x${m.h}`.padEnd(9)}  (${m.cx}, ${m.cy})`.padEnd(
          64,
        ) + (symmetry ? `| ${symmetry}` : ""),
      );
    });
  }
}
