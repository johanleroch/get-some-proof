import { build } from "esbuild";

await build({
  entryPoints: ["scripts/upload-assistant-video.mjs"],
  outfile: "public/assistant-upload.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
});
console.log("Built standalone assistant video transfer helper.");
