// @vitest-environment node
import { Readable } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
const network = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("./public-media", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  openPublicMedia: network.open,
}));
import {
  VideoUploadUncertain,
  copyPublicVideoToUpload,
  maximumImportedVideoBytes,
} from "./public-video";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function source(
  chunks: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  mime = "video/mp4",
) {
  const response = Object.assign(Readable.from(chunks), {
    headers: { "content-type": mime },
  });
  network.open.mockResolvedValue(response);
  return response;
}
it("copies bounded chunks and finalizes only with the measured source size", async () => {
  source([new Uint8Array(8 * 1024 * 1024), new Uint8Array(3)]);
  const put = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 308 }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", put);
  expect(
    await copyPublicVideoToUpload(
      "https://source.example/video.mp4",
      "https://upload.example/capability",
    ),
  ).toEqual({ fileSizeBytes: 8 * 1024 * 1024 + 3, mimeType: "video/mp4" });
  expect(put.mock.calls[0][1].headers["Content-Range"]).toBe(
    "bytes 0-8388607/*",
  );
  expect(put.mock.calls[1][1].headers["Content-Range"]).toBe(
    "bytes 8388608-8388610/8388611",
  );
  expect(put.mock.calls.every((call) => call[1].redirect === "manual")).toBe(
    true,
  );
});
it("refuses an oversized actual body before finalizing even without a declared size", async () => {
  source(
    (function* () {
      const chunk = new Uint8Array(8 * 1024 * 1024);
      for (let i = 0; i < 64; i++) yield chunk;
      yield new Uint8Array(1);
    })(),
  );
  const put = vi.fn().mockResolvedValue(new Response(null, { status: 308 }));
  vi.stubGlobal("fetch", put);
  await expect(
    copyPublicVideoToUpload(
      "https://source.example/video.mp4",
      "https://upload.example/capability",
    ),
  ).rejects.toMatchObject({ transient: false });
  expect(
    put.mock.calls.every((call) =>
      call[1].headers["Content-Range"].endsWith("/*"),
    ),
  ).toBe(true);
  expect(put.mock.calls.length * 8 * 1024 * 1024).toBeLessThan(
    maximumImportedVideoBytes,
  );
});
it("refuses non-video content without transmitting it", async () => {
  source([new Uint8Array(20)], "text/html");
  const put = vi.fn();
  vi.stubGlobal("fetch", put);
  await expect(
    copyPublicVideoToUpload(
      "https://source.example/video.mp4",
      "https://upload.example/capability",
    ),
  ).rejects.toMatchObject({ transient: false });
  expect(put).not.toHaveBeenCalled();
});

it("persists measured bytes before finalization and leaves an uncertain final upload to its webhook", async () => {
  source([new Uint8Array(20)]);
  const verified = vi.fn().mockResolvedValue(undefined);
  const put = vi.fn().mockImplementation(async () => {
    expect(verified).toHaveBeenCalledWith({
      fileSizeBytes: 20,
      mimeType: "video/mp4",
    });
    return new Response(null, { status: 503 });
  });
  vi.stubGlobal("fetch", put);
  await expect(
    copyPublicVideoToUpload(
      "https://source.example/video.mp4",
      "https://upload.example/capability",
      verified,
    ),
  ).rejects.toBeInstanceOf(VideoUploadUncertain);
  expect(put).toHaveBeenCalledTimes(1);
});
