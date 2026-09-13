import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { transform } from "esbuild";
const output = new URL("../workers/delivery/dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
const source = await readFile(
  new URL("../public/embed/v2.js", import.meta.url),
  "utf8",
);
const { code } = await transform(source, {
  minify: true,
  target: "es2022",
  define: { "globalThis.__GSP_CLOUDFLARE_DELIVERY__": "true" },
});
const hash = createHash("sha256").update(code).digest("hex").slice(0, 20);
const artifact = `releases/canary-v1/widget.${hash}.js`;
await mkdir(new URL("releases/canary-v1/", output), { recursive: true });
await mkdir(new URL("embed/", output), { recursive: true });
await writeFile(new URL(artifact, output), code);
await writeFile(
  new URL("embed/loader.js", output),
  `(()=>{const s=document.createElement("script");s.src=new URL("/${artifact}",document.currentScript.src).href;s.async=true;document.head.append(s)})();\n`,
);
await writeFile(
  new URL("_headers", output),
  `/releases/*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n/embed/loader.js\n  Cache-Control: public, max-age=300\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n`,
);
console.log(`Cloudflare runtime built: ${artifact}`);
