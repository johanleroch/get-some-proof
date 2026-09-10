import { openPublicMedia, MediaCopyError } from "./public-media";

export const maximumImportedVideoBytes = 512 * 1024 * 1024;
export class VideoUploadUncertain extends Error {}

const chunkBytes = 8 * 1024 * 1024;

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
  const source = await openPublicMedia(
    sourceUrl,
    signal,
    "video/mp4,video/quicktime,video/webm",
  );
  let length = 0;
  let offset = 0;
  let used = 0;
  const buffer = new Uint8Array(chunkBytes);
  const mimeType = source.headers["content-type"]?.split(";", 1)[0]?.trim();
  try {
    if (
      !mimeType ||
      !["video/mp4", "video/quicktime", "video/webm"].includes(mimeType) ||
      Number(source.headers["content-length"]) > maximumImportedVideoBytes ||
      (source.headers["content-encoding"] &&
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
            throw new MediaCopyError();
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
    for await (const bytes of source) {
      length += bytes.length;
      if (length > maximumImportedVideoBytes) throw new MediaCopyError();
      let cursor = 0;
      while (cursor < bytes.length) {
        if (used === chunkBytes) await send(false);
        const size = Math.min(chunkBytes - used, bytes.length - cursor);
        buffer.set(bytes.subarray(cursor, cursor + size), used);
        used += size;
        cursor += size;
      }
    }
    if (!length) throw new MediaCopyError();
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
    source.destroy();
  }
}
