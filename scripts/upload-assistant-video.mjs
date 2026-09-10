#!/usr/bin/env node
import { openAsBlob } from "node:fs";
import { transferAssistantVideo } from "../src/lib/assistant-video-transfer.ts";

// Capability JSON enters through stdin, never process arguments or logs.
// Node 24+ is the same runtime required by this repository.
try {
  const filePath = process.argv[2];
  if (!filePath || process.argv.length !== 3)
    throw new Error(
      "Usage: node scripts/upload-assistant-video.mjs /absolute/path/video.mp4 < private-capability.json",
    );
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 16_384)
      throw new Error("Upload capability is too large.");
  }
  const capability = JSON.parse(input);
  const file = await openAsBlob(filePath);
  const status = await transferAssistantVideo(file, capability, {
    onProgress: (offset, total) =>
      process.stderr.write(`Uploaded ${offset} of ${total} bytes\n`),
  });
  process.stdout.write(
    JSON.stringify({
      status,
      next: "Use read_assistant_import to check video readiness.",
    }) + "\n",
  );
} catch (error) {
  // Never print response bodies, destinations, tokens, or arbitrary parser errors.
  const safe =
    error instanceof Error &&
    /^(Choose |This upload |The transfer |The video |Invalid file |Usage:|Upload capability)/.test(
      error.message,
    );
  process.stderr.write(
    (safe
      ? error.message
      : "File transfer failed. Check the local file and private upload capability.") +
      "\n",
  );
  process.exitCode = 1;
}
