import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const result = await build({
  entryPoints: ["src/components/chatgpt/widget-entry.tsx"],
  bundle: true,
  alias: {
    "next/link": "./src/components/chatgpt/browser-link.tsx",
    "next/image": "./src/components/chatgpt/browser-image.tsx",
  },
  platform: "browser",
  format: "iife",
  target: "es2022",
  write: false,
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
const css = await postcss([tailwind()]).process(
  await readFile("src/app/globals.css", "utf8"),
  { from: "src/app/globals.css" },
);
let fonts = await readFile("src/components/chatgpt/fonts/fonts.css", "utf8");
for (const match of [...fonts.matchAll(/url\("\.\/([^\"]+)"\)/g)]) {
  const bytes = await readFile(
    path.join("src/components/chatgpt/fonts", match[1]),
  );
  fonts = fonts.replace(
    match[0],
    `url("data:font/woff2;base64,${bytes.toString("base64")}")`,
  );
}
for (const [weight, name] of [
  [600, "SemiBold"],
  [700, "Bold"],
]) {
  const bytes = await readFile(`src/app/fonts/gelica/Gelica-${name}.woff2`);
  fonts += `@font-face{font-family:Gelica;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2");}`;
}
const tokens =
  ":root{--font-figtree:Figtree;--font-gelica:Gelica;--font-caveat:Caveat}body{margin:0}";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Import testimonials</title><style>${fonts}${css.css}${tokens}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
await mkdir("public/chatgpt", { recursive: true });
await writeFile("public/chatgpt/import-widget.html", html);
console.log(
  `Built import widget (${Math.round(Buffer.byteLength(html) / 1024)} KiB).`,
);
