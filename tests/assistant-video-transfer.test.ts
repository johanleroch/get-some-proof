import { afterEach, expect, it, vi } from "vitest";
import { transferAssistantVideo } from "../src/lib/assistant-video-transfer";
const cap = {
  status: "uploading" as const,
  uploadUrl: "https://fixture.convex.site/api/import-mcp/upload",
  uploadToken: "a".repeat(64),
  expiresAt: Date.now() + 900_000,
  offset: 0,
  totalBytes: 4,
  chunkSize: 2,
};
afterEach(() => vi.unstubAllGlobals());
it("resumes at the recorded byte and waits on an ambiguous final without resending", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: "finalizing", offset: 2 }), {
      status: 202,
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const progress = vi.fn();
  expect(
    await transferAssistantVideo(
      new Blob([new Uint8Array([0, 1, 2, 3])]),
      { ...cap, offset: 2 },
      { onProgress: progress },
    ),
  ).toBe("finalizing");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1].headers["Content-Range"]).toBe("bytes 2-3/4");
  expect(
    Array.from(
      new Uint8Array(await fetcher.mock.calls[0][1].body.arrayBuffer()),
    ),
  ).toEqual([2, 3]);
  expect(progress).toHaveBeenCalledWith(2, 4);
});
it("replays the same interrupted piece, then confirms only acknowledged offsets", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("lost response"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ offset: 2 })))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ offset: 4, complete: true })),
    );
  vi.stubGlobal("fetch", fetcher);
  const progress = vi.fn();
  expect(
    await transferAssistantVideo(new Blob([new Uint8Array(4)]), cap, {
      onProgress: progress,
    }),
  ).toBe("complete");
  expect(
    fetcher.mock.calls.map((call) => call[1].headers["Content-Range"]),
  ).toEqual(["bytes 0-1/4", "bytes 0-1/4", "bytes 2-3/4"]);
  expect(progress.mock.calls).toEqual([
    [0, 4],
    [2, 4],
    [4, 4],
  ]);
});
it("rejects mismatched files before transmitting and never retries a rejected capability", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    transferAssistantVideo(new Blob([new Uint8Array(5)]), cap),
  ).rejects.toThrow("same file");
  expect(fetcher).not.toHaveBeenCalled();
  await expect(
    transferAssistantVideo(new Blob([new Uint8Array(4)]), cap),
  ).rejects.toThrow("expired");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not send bytes for finalizing or complete capabilities", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(
    await transferAssistantVideo(new Blob([new Uint8Array(4)]), {
      ...cap,
      status: "finalizing",
    }),
  ).toBe("finalizing");
  expect(fetcher).not.toHaveBeenCalled();
});
