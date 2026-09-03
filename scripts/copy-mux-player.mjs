import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const moduleUrl = import.meta.resolve("@mux/mux-player/mux-player");
const source = fileURLToPath(moduleUrl).replace(/\.mjs$/, ".js");
const destination = new URL("../public/embed/mux-player.js", import.meta.url);
const policySource = new URL(
  "../public/embed/video-player-policy.json",
  import.meta.url,
);
const policyDestination = new URL(
  "../public/embed/video-player-policy.js",
  import.meta.url,
);

await mkdir(new URL("../public/embed/", import.meta.url), { recursive: true });
await copyFile(source, destination);
const policy = JSON.parse(await readFile(policySource, "utf8"));
await writeFile(
  policyDestination,
  `window.__GSP_VIDEO_PLAYER_POLICY__ = Object.freeze(${JSON.stringify(policy)});\n`,
);
