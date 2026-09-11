import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmodSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Writable } from "node:stream";
import ffmpegPath from "ffmpeg-static";
import { openPublicMedia, MediaCopyError } from "./public-media";

export const maximumImportedVideoBytes = 512 * 1024 * 1024;
export class VideoUploadUncertain extends Error {}

const chunkBytes = 8 * 1024 * 1024;
const maximumManifestBytes = 1024 * 1024;
const maximumVideoDurationSeconds = 10 * 60;

function publicMuxHlsUrl(input: string) {
  const url = URL.parse(input);
  return url &&
    url.protocol === "https:" &&
    url.hostname === "stream.mux.com" &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    !url.hash &&
    /^\/[a-zA-Z0-9]+\.m3u8$/.test(url.pathname)
    ? url.href
    : undefined;
}

function muxMediaUrl(input: string, base: string) {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    throw new MediaCopyError();
  }
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "stream.mux.com" || url.hostname.endsWith(".mux.com")) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new MediaCopyError();
  return url.href;
}

async function readManifest(url: string, signal: AbortSignal) {
  const source = await openPublicMedia(
    url,
    signal,
    "application/vnd.apple.mpegurl,application/x-mpegURL,audio/mpegurl,text/plain",
  );
  try {
    if (
      Number(source.headers["content-length"]) > maximumManifestBytes ||
      (source.headers["content-encoding"] &&
        source.headers["content-encoding"] !== "identity")
    )
      throw new MediaCopyError(false, "input-headers");
    const chunks: Uint8Array[] = [];
    let length = 0;
    for await (const chunk of source) {
      length += chunk.length;
      if (length > maximumManifestBytes) throw new MediaCopyError();
      chunks.push(chunk);
    }
    if (!length) throw new MediaCopyError();
    return Buffer.concat(chunks).toString("utf8");
  } catch (error) {
    if (error instanceof MediaCopyError) throw error;
    throw new MediaCopyError(true);
  } finally {
    source.destroy();
  }
}

function attributes(line: string) {
  const result = new Map<string, string>();
  for (const match of line.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g))
    result.set(
      match[1]!,
      match[2]!.startsWith('"') ? match[2]!.slice(1, -1) : match[2]!,
    );
  return result;
}

function playlistLines(manifest: string) {
  const lines = manifest
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0] !== "#EXTM3U" || lines.length > 20_000)
    throw new MediaCopyError();
  return lines;
}

function selectMuxTrackCandidates(manifest: string, sourceUrl: string) {
  const lines = playlistLines(manifest);
  const audio = new Map<string, string>();
  const variants: {
    audioGroup?: string;
    pixels: number;
    bandwidth: number;
    url: string;
  }[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (line.startsWith("#EXT-X-MEDIA:")) {
      const values = attributes(line.slice("#EXT-X-MEDIA:".length));
      const uri = values.get("URI");
      const group = values.get("GROUP-ID");
      if (values.get("TYPE") === "AUDIO" && uri && group && !audio.has(group))
        audio.set(group, muxMediaUrl(uri, sourceUrl));
    }
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const values = attributes(line.slice("#EXT-X-STREAM-INF:".length));
    const uri = lines[index + 1]?.startsWith("#")
      ? undefined
      : lines[index + 1];
    const resolution = /^(\d+)x(\d+)$/.exec(values.get("RESOLUTION") ?? "");
    if (!uri || !resolution) throw new MediaCopyError();
    variants.push({
      audioGroup: values.get("AUDIO"),
      bandwidth: Number(values.get("BANDWIDTH")) || 0,
      pixels: Number(resolution[1]) * Number(resolution[2]),
      url: muxMediaUrl(uri, sourceUrl),
    });
  }
  const sorted = variants.sort(
    (left, right) =>
      right.pixels - left.pixels || right.bandwidth - left.bandwidth,
  );
  if (!sorted.length) throw new MediaCopyError();
  return sorted.map((variant) => {
    if (!Number.isFinite(variant.bandwidth) || variant.bandwidth <= 0)
      throw new MediaCopyError(false, "missing-bandwidth");
    if (variant.audioGroup && !audio.has(variant.audioGroup))
      throw new MediaCopyError(false, "missing-audio");
    return {
      bandwidth: variant.bandwidth,
      urls: [
        variant.url,
        ...(variant.audioGroup ? [audio.get(variant.audioGroup)!] : []),
      ],
    };
  });
}

function mediaSegments(manifest: string, sourceUrl: string) {
  const lines = playlistLines(manifest);
  if (
    !lines.includes("#EXT-X-ENDLIST") ||
    lines.some(
      (line) =>
        line.startsWith("#EXT-X-BYTERANGE:") ||
        (line.startsWith("#EXT-X-KEY:") && !line.includes("METHOD=NONE")),
    )
  )
    throw new MediaCopyError();
  const map = lines.find((line) => line.startsWith("#EXT-X-MAP:"));
  const mapUri = map
    ? attributes(map.slice("#EXT-X-MAP:".length)).get("URI")
    : undefined;
  if (!mapUri) throw new MediaCopyError();
  const durationSeconds = lines.reduce((total, line) => {
    if (!line.startsWith("#EXTINF:")) return total;
    const duration = Number(line.slice("#EXTINF:".length).split(",", 1)[0]);
    if (!Number.isFinite(duration) || duration <= 0) throw new MediaCopyError();
    return total + duration;
  }, 0);
  if (!durationSeconds || durationSeconds > maximumVideoDurationSeconds)
    throw new MediaCopyError();
  const segments = lines
    .filter((line) => !line.startsWith("#"))
    .map((line) => muxMediaUrl(line, sourceUrl));
  if (!segments.length) throw new MediaCopyError();
  return {
    durationSeconds,
    urls: [muxMediaUrl(mapUri, sourceUrl), ...segments],
  };
}

async function writeMedia(
  urls: string[],
  destination: Writable,
  signal: AbortSignal,
  addBytes: (length: number) => void,
  trackIndex: number,
) {
  let segmentIndex = -1;
  try {
    for (const [index, url] of urls.entries()) {
      segmentIndex = index;
      const source = await openPublicMedia(
        url,
        signal,
        "video/mp4,audio/mp4,application/octet-stream",
      );
      try {
        if (
          (source.headers["content-encoding"] &&
            source.headers["content-encoding"] !== "identity") ||
          Number(source.headers["content-length"]) > maximumImportedVideoBytes
        )
          throw new MediaCopyError();
        for await (const chunk of source) {
          addBytes(chunk.length);
          if (!destination.write(chunk)) await once(destination, "drain");
        }
      } finally {
        source.destroy();
      }
    }
    destination.end();
  } catch (error) {
    destination.destroy();
    if (error instanceof MediaCopyError)
      throw new MediaCopyError(
        error.transient,
        `track-${trackIndex}-segment-${segmentIndex}`,
      );
    throw new MediaCopyError(
      true,
      `track-${trackIndex}-segment-${segmentIndex}`,
    );
  }
}

async function remuxPublicMuxHls(input: string, signal: AbortSignal) {
  const sourceUrl = publicMuxHlsUrl(input);
  if (!sourceUrl || !ffmpegPath) throw new MediaCopyError(false, "mux-source");
  const master = await readManifest(sourceUrl, signal).catch((error) => {
    if (error instanceof MediaCopyError)
      throw new MediaCopyError(error.transient, "master-manifest");
    throw error;
  });
  let candidates: ReturnType<typeof selectMuxTrackCandidates>;
  try {
    candidates = selectMuxTrackCandidates(master, sourceUrl);
  } catch (error) {
    if (error instanceof MediaCopyError)
      throw new MediaCopyError(error.transient, "master-selection");
    throw error;
  }
  let tracks: ReturnType<typeof mediaSegments>[] | undefined;
  for (const candidate of candidates) {
    const candidateTracks = await Promise.all(
      candidate.urls.map(async (url, index) => {
        try {
          return mediaSegments(await readManifest(url, signal), url);
        } catch (error) {
          if (error instanceof MediaCopyError)
            throw new MediaCopyError(
              error.transient,
              `track-${index}-manifest`,
            );
          throw error;
        }
      }),
    );
    const durationSeconds = Math.max(
      ...candidateTracks.map((track) => track.durationSeconds),
    );
    if (
      candidate.bandwidth * durationSeconds <=
      maximumImportedVideoBytes * 8
    ) {
      tracks = candidateTracks;
      break;
    }
  }
  if (!tracks) throw new MediaCopyError(false, "estimated-size-limit");

  let executableDirectory: string | undefined;
  let executablePath: string;
  const removeExecutableDirectory = () => {
    if (!executableDirectory) return;
    try {
      rmSync(executableDirectory, { recursive: true, force: true });
    } catch {
      // Temporary cleanup must not replace the upload result or primary error.
    }
  };
  try {
    // External dependencies can be mounted read-only without executable mode.
    executableDirectory = mkdtempSync(join(tmpdir(), "gsp-ffmpeg-"));
    executablePath = join(executableDirectory, "ffmpeg");
    copyFileSync(ffmpegPath, executablePath);
    chmodSync(executablePath, 0o700);
  } catch {
    removeExecutableDirectory();
    throw new MediaCopyError(false, "ffmpeg-chmod");
  }
  const inputArguments = tracks.flatMap((_, index) => [
    "-f",
    "mp4",
    "-i",
    `pipe:${index + 3}`,
  ]);
  let process: ReturnType<typeof spawn>;
  try {
    process = spawn(
      executablePath,
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        ...inputArguments,
        "-map",
        "0:v:0",
        "-map",
        tracks.length > 1 ? "1:a:0" : "0:a:0?",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-c",
        "copy",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-f",
        "mp4",
        "pipe:1",
      ],
      {
        stdio: ["ignore", "pipe", "pipe", ...tracks.map(() => "pipe" as const)],
        windowsHide: true,
      },
    );
  } catch {
    removeExecutableDirectory();
    throw new MediaCopyError(false, "ffmpeg-spawn");
  }
  const output = process.stdout;
  const diagnosticsOutput = process.stderr;
  if (!output || !diagnosticsOutput) {
    process.kill("SIGKILL");
    removeExecutableDirectory();
    throw new MediaCopyError(false, "ffmpeg-pipes");
  }
  let diagnostics = "";
  diagnosticsOutput.setEncoding("utf8");
  diagnosticsOutput.on("data", (chunk: string) => {
    if (diagnostics.length < 4_096)
      diagnostics += chunk.slice(0, 4_096 - diagnostics.length);
  });
  const abort = () => process.kill("SIGKILL");
  signal.addEventListener("abort", abort, { once: true });
  const completed = new Promise<boolean>((resolve) => {
    process.once("error", (error) => {
      diagnostics ||= error.message;
      resolve(false);
    });
    process.once("close", (code) => resolve(code === 0));
  })
    .then((success) => {
      if (!success)
        console.error(
          "Public Mux HLS remux failed.",
          diagnostics.trim() ||
            "The FFmpeg process exited without diagnostics.",
        );
      return success;
    })
    .finally(() => signal.removeEventListener("abort", abort));
  let downloadedBytes = 0;
  const addBytes = (length: number) => {
    downloadedBytes += length;
    if (downloadedBytes > maximumImportedVideoBytes) throw new MediaCopyError();
  };
  const feeds = Promise.all(
    tracks.map((track, index) =>
      writeMedia(
        track.urls,
        process.stdio[index + 3] as Writable,
        signal,
        addBytes,
        index,
      ),
    ),
  ).then(
    () => undefined,
    (error: unknown) => {
      if (process.exitCode === null) process.kill("SIGKILL");
      return error;
    },
  );
  return {
    body: output,
    completed,
    feeds,
    close() {
      signal.removeEventListener("abort", abort);
      if (process.exitCode === null) process.kill("SIGKILL");
      removeExecutableDirectory();
    },
  };
}

/** The upload capability is issued internally by Mux, never supplied by the assistant. */
export async function copyPublicVideoToUpload(
  sourceUrl: string,
  uploadUrl: string,
  beforeFinalize?: (metadata: {
    fileSizeBytes: number;
    mimeType: string;
  }) => Promise<void>,
) {
  const signal = AbortSignal.timeout(8 * 60_000);
  const hls = publicMuxHlsUrl(sourceUrl)
    ? await remuxPublicMuxHls(sourceUrl, signal)
    : undefined;
  const source = hls
    ? undefined
    : await openPublicMedia(
        sourceUrl,
        signal,
        "video/mp4,video/quicktime,video/webm",
      );
  let length = 0;
  let offset = 0;
  let used = 0;
  const buffer = new Uint8Array(chunkBytes);
  const mimeType = hls
    ? "video/mp4"
    : source?.headers["content-type"]?.split(";", 1)[0]?.trim();
  try {
    if (
      !mimeType ||
      !["video/mp4", "video/quicktime", "video/webm"].includes(mimeType) ||
      Number(source?.headers["content-length"]) > maximumImportedVideoBytes ||
      (source?.headers["content-encoding"] &&
        source.headers["content-encoding"] !== "identity")
    )
      throw new MediaCopyError();
    async function send(final: boolean) {
      const body = buffer.slice(0, used);
      let accepted = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(uploadUrl, {
            method: "PUT",
            redirect: "manual",
            signal,
            headers: {
              "Content-Type": mimeType!,
              "Content-Length": String(used),
              "Content-Range": `bytes ${offset}-${offset + used - 1}/${final ? length : "*"}`,
            },
            body,
          });
          if (final ? response.ok : response.status === 308) {
            accepted = true;
            break;
          }
          if (final && response.status >= 500) throw new VideoUploadUncertain();
          if (response.status !== 429 && response.status < 500)
            throw new MediaCopyError(false, "upload-response");
        } catch (error) {
          if (error instanceof MediaCopyError && !error.transient) throw error;
          if (final)
            throw new VideoUploadUncertain(
              "Await the provider webhook before retrying a potentially completed upload.",
            );
          if (signal.aborted) throw new MediaCopyError(true);
        }
        if (attempt < 3)
          await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
      if (!accepted) throw new MediaCopyError(true);
      offset += used;
      used = 0;
    }
    for await (const bytes of hls?.body ?? source!) {
      length += bytes.length;
      if (length > maximumImportedVideoBytes)
        throw new MediaCopyError(false, "output-size-limit");
      let cursor = 0;
      while (cursor < bytes.length) {
        if (used === chunkBytes) await send(false);
        const size = Math.min(chunkBytes - used, bytes.length - cursor);
        buffer.set(bytes.subarray(cursor, cursor + size), used);
        used += size;
        cursor += size;
      }
    }
    const feedError = await hls?.feeds;
    if (feedError) throw feedError;
    if (hls && !(await hls.completed))
      throw new MediaCopyError(signal.aborted, "ffmpeg-exit");
    if (!length) throw new MediaCopyError(false, "empty-output");
    await beforeFinalize?.({ fileSizeBytes: length, mimeType });
    await send(true);
    return { fileSizeBytes: length, mimeType };
  } catch (error) {
    if (
      error instanceof MediaCopyError ||
      error instanceof VideoUploadUncertain
    )
      throw error;
    throw new MediaCopyError(true);
  } finally {
    hls?.close();
    source?.destroy();
  }
}
