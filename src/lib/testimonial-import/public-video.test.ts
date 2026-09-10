// @vitest-environment node
import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({
  chmodSync: vi.fn(),
  copyFileSync: vi.fn(),
  mkdtempSync: vi.fn(() => "/tmp/gsp-ffmpeg-test"),
  open: vi.fn(),
  rmSync: vi.fn(),
  spawn: vi.fn(),
}));
vi.mock("./public-media", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  openPublicMedia: dependencies.open,
}));
vi.mock("node:child_process", () => ({ spawn: dependencies.spawn }));
vi.mock("node:fs", () => ({
  chmodSync: dependencies.chmodSync,
  copyFileSync: dependencies.copyFileSync,
  mkdtempSync: dependencies.mkdtempSync,
  rmSync: dependencies.rmSync,
}));
vi.mock("ffmpeg-static", () => ({ default: "/runtime/ffmpeg" }));
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
  dependencies.open.mockResolvedValue(response);
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
it("remuxes a public Mux HLS playback stream before uploading it", async () => {
  const master = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="https://manifest.mux.com/audio.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1080x1920,AUDIO="audio"
https://manifest.mux.com/video.m3u8`;
  const video = `#EXTM3U
#EXT-X-MAP:URI="https://chunk.mux.com/video-init.mp4"
#EXTINF:1,
https://chunk.mux.com/video.m4s
#EXT-X-ENDLIST`;
  const audio = `#EXTM3U
#EXT-X-MAP:URI="https://chunk.mux.com/audio-init.mp4"
#EXTINF:1,
https://chunk.mux.com/audio.m4s
#EXT-X-ENDLIST`;
  dependencies.open.mockImplementation(async (url: string) => {
    const contents = new Map<string, [string | Uint8Array, string]>([
      [
        "https://stream.mux.com/publicPlayback123.m3u8",
        [master, "application/vnd.apple.mpegurl"],
      ],
      [
        "https://manifest.mux.com/video.m3u8",
        [video, "application/vnd.apple.mpegurl"],
      ],
      [
        "https://manifest.mux.com/audio.m3u8",
        [audio, "application/vnd.apple.mpegurl"],
      ],
    ]);
    const [body, mime] = contents.get(url) ?? [new Uint8Array(10), "video/mp4"];
    return Object.assign(
      Readable.from([typeof body === "string" ? Buffer.from(body) : body]),
      { headers: { "content-type": mime } },
    );
  });
  const videoInput = new PassThrough();
  const audioInput = new PassThrough();
  videoInput.resume();
  audioInput.resume();
  const child = Object.assign(new EventEmitter(), {
    exitCode: null as null | number,
    kill: vi.fn(),
    stderr: Readable.from([]),
    stdout: Readable.from([new Uint8Array(20)]),
    stdio: [null, null, null, videoInput, audioInput],
  });
  dependencies.spawn.mockReturnValue(child);
  let finished = 0;
  for (const input of [videoInput, audioInput])
    input.on("finish", () => {
      if (++finished === 2) {
        child.exitCode = 0;
        child.emit("close", 0);
      }
    });
  const put = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", put);

  await expect(
    copyPublicVideoToUpload(
      "https://stream.mux.com/publicPlayback123.m3u8",
      "https://upload.example/capability",
    ),
  ).resolves.toEqual({ fileSizeBytes: 20, mimeType: "video/mp4" });

  expect(dependencies.open).toHaveBeenCalledWith(
    "https://stream.mux.com/publicPlayback123.m3u8",
    expect.any(AbortSignal),
    expect.stringContaining("mpegurl"),
  );
  expect(dependencies.copyFileSync).toHaveBeenCalledWith(
    "/runtime/ffmpeg",
    "/tmp/gsp-ffmpeg-test/ffmpeg",
  );
  expect(dependencies.chmodSync).toHaveBeenCalledWith(
    "/tmp/gsp-ffmpeg-test/ffmpeg",
    0o700,
  );
  expect(dependencies.spawn).toHaveBeenCalledWith(
    "/tmp/gsp-ffmpeg-test/ffmpeg",
    expect.arrayContaining(["-i", "pipe:3", "pipe:4", "pipe:1"]),
    expect.objectContaining({ windowsHide: true }),
  );
  expect(dependencies.rmSync).toHaveBeenCalledWith("/tmp/gsp-ffmpeg-test", {
    recursive: true,
    force: true,
  });
  expect(put.mock.calls[0][1].headers["Content-Type"]).toBe("video/mp4");
});
it("refuses a Mux variant whose declared audio group has no playable track", async () => {
  const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1080x1920,AUDIO="missing"
https://manifest.mux.com/video.m3u8`;
  source([Buffer.from(master)], "application/vnd.apple.mpegurl");
  vi.stubGlobal("fetch", vi.fn());

  await expect(
    copyPublicVideoToUpload(
      "https://stream.mux.com/publicPlayback123.m3u8",
      "https://upload.example/capability",
    ),
  ).rejects.toMatchObject({
    diagnostic: "master-selection",
    transient: false,
  });
  expect(dependencies.spawn).not.toHaveBeenCalled();
});
it("falls back to a lower Mux rendition when the highest one is estimated over 512 MB", async () => {
  const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=10000000,RESOLUTION=1920x1080
https://manifest.mux.com/high.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720
https://manifest.mux.com/low.m3u8`;
  const media = (name: string) => `#EXTM3U
#EXT-X-MAP:URI="https://chunk.mux.com/${name}-init.mp4"
#EXTINF:600,
https://chunk.mux.com/${name}.m4s
#EXT-X-ENDLIST`;
  dependencies.open.mockImplementation(async (url: string) => {
    const manifests = new Map<string, string>([
      ["https://stream.mux.com/publicPlayback123.m3u8", master],
      ["https://manifest.mux.com/high.m3u8", media("high")],
      ["https://manifest.mux.com/low.m3u8", media("low")],
    ]);
    const body = manifests.get(url);
    return Object.assign(
      Readable.from([body ? Buffer.from(body) : new Uint8Array(10)]),
      {
        headers: {
          "content-type": body ? "application/vnd.apple.mpegurl" : "video/mp4",
        },
      },
    );
  });
  const input = new PassThrough();
  input.resume();
  const child = Object.assign(new EventEmitter(), {
    exitCode: null as null | number,
    kill: vi.fn(),
    stderr: Readable.from([]),
    stdout: Readable.from([new Uint8Array(20)]),
    stdio: [null, null, null, input],
  });
  dependencies.spawn.mockReturnValue(child);
  input.on("finish", () => {
    child.exitCode = 0;
    child.emit("close", 0);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  );

  await expect(
    copyPublicVideoToUpload(
      "https://stream.mux.com/publicPlayback123.m3u8",
      "https://upload.example/capability",
    ),
  ).resolves.toEqual({ fileSizeBytes: 20, mimeType: "video/mp4" });

  expect(dependencies.open).toHaveBeenCalledWith(
    "https://chunk.mux.com/low.m4s",
    expect.any(AbortSignal),
    expect.stringContaining("video/mp4"),
  );
  expect(dependencies.open).not.toHaveBeenCalledWith(
    "https://chunk.mux.com/high.m4s",
    expect.anything(),
    expect.anything(),
  );
});
it("does not turn a successful upload into a failure when temporary cleanup fails", async () => {
  const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1280x720
https://manifest.mux.com/video.m3u8`;
  const media = `#EXTM3U
#EXT-X-MAP:URI="https://chunk.mux.com/init.mp4"
#EXTINF:1,
https://chunk.mux.com/video.m4s
#EXT-X-ENDLIST`;
  dependencies.open.mockImplementation(async (url: string) => {
    const body = url.includes("publicPlayback")
      ? master
      : url.includes("manifest")
        ? media
        : new Uint8Array(10);
    return Object.assign(
      Readable.from([typeof body === "string" ? Buffer.from(body) : body]),
      {
        headers: {
          "content-type":
            typeof body === "string"
              ? "application/vnd.apple.mpegurl"
              : "video/mp4",
        },
      },
    );
  });
  const input = new PassThrough();
  input.resume();
  const child = Object.assign(new EventEmitter(), {
    exitCode: null as null | number,
    kill: vi.fn(),
    stderr: Readable.from([]),
    stdout: Readable.from([new Uint8Array(20)]),
    stdio: [null, null, null, input],
  });
  dependencies.spawn.mockReturnValue(child);
  input.on("finish", () => {
    child.exitCode = 0;
    child.emit("close", 0);
  });
  dependencies.rmSync.mockImplementation(() => {
    throw new Error("cleanup failed");
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  );

  await expect(
    copyPublicVideoToUpload(
      "https://stream.mux.com/publicPlayback123.m3u8",
      "https://upload.example/capability",
    ),
  ).resolves.toEqual({ fileSizeBytes: 20, mimeType: "video/mp4" });
});
it("removes the private executable copy when FFmpeg cannot start", async () => {
  const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1280x720
https://manifest.mux.com/video.m3u8`;
  const media = `#EXTM3U
#EXT-X-MAP:URI="https://chunk.mux.com/init.mp4"
#EXTINF:1,
https://chunk.mux.com/video.m4s
#EXT-X-ENDLIST`;
  dependencies.open.mockImplementation(async (url: string) =>
    Object.assign(
      Readable.from([
        Buffer.from(url.includes("publicPlayback") ? master : media),
      ]),
      { headers: { "content-type": "application/vnd.apple.mpegurl" } },
    ),
  );
  dependencies.spawn.mockImplementation(() => {
    throw new Error("spawn failed");
  });
  vi.stubGlobal("fetch", vi.fn());

  await expect(
    copyPublicVideoToUpload(
      "https://stream.mux.com/publicPlayback123.m3u8",
      "https://upload.example/capability",
    ),
  ).rejects.toMatchObject({ diagnostic: "ffmpeg-spawn", transient: false });
  expect(dependencies.rmSync).toHaveBeenCalledWith("/tmp/gsp-ffmpeg-test", {
    recursive: true,
    force: true,
  });
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
