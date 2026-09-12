// @vitest-environment node
import { expect, it, vi } from "vitest";
import { readExportProgress } from "./download-project-export";
it("handles split progress messages and preserves ZIP bytes following the last newline", async () => {
  const progress = {
    phase: "media",
    processed: 1,
    total: 2,
    failed: 0,
    current: "Image · Maya",
  };
  const header = new TextEncoder().encode(
    JSON.stringify({ type: "progress", progress }) +
      "\n" +
      JSON.stringify({ type: "archive", complete: true }) +
      "\n",
  );
  const bytes = new Uint8Array([...header, 80, 75, 3, 4, 10, 255]);
  const reader = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 12));
      controller.enqueue(bytes.slice(12));
      controller.close();
    },
  }).getReader();
  const update = vi.fn();
  const result = await readExportProgress(reader, update);
  expect(update).toHaveBeenCalledWith(progress);
  expect(result.complete).toBe(true);
  expect([...result.remainder]).toEqual([80, 75, 3, 4, 10, 255]);
});
it("rejects an interrupted progress stream instead of saving a fake ZIP", async () => {
  const reader = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  }).getReader();
  await expect(readExportProgress(reader, vi.fn())).rejects.toThrow(
    "interrupted",
  );
});
