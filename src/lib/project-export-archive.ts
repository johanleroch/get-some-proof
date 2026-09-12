import { nameBackupMedia } from "./backup-filenames";
import type { ExportProgress } from "./export-progress";
import { ZipArchive } from "archiver";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ExportMedia } from "@convex/domain/exportMedia";

export type ExportDocument = {
  media: ExportMedia[];
  organization: { publicSlug: string; _id: string };
  testimonials: Array<{ _id: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

// Never fetch provenance URLs or follow redirects to arbitrary hosts.
export function allowedExportUrl(
  value: string,
  storageOrigin: string,
): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (
      url.origin === storageOrigin &&
      url.pathname.startsWith("/api/storage/")
    )
      return true;
    return (
      url.protocol === "https:" &&
      !url.port &&
      ["image.mux.com", "mezzanine.mux.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Prepare on disk, one media file at a time; never return a truncated ZIP. */
export async function buildProjectArchive(
  data: ExportDocument,
  storageOrigin: string,
  signal: AbortSignal,
  options: {
    onProgress?: (progress: ExportProgress) => void;
    prepareVideo?: (assetId: string) => Promise<string>;
  } = {},
) {
  nameBackupMedia(data);
  const directory = await mkdtemp(join(tmpdir(), "gsp-export-"));
  const path = join(directory, "export.zip");
  const archive = new ZipArchive({ store: true, forceZip64: true });
  const completion = pipeline(archive, createWriteStream(path), { signal });
  // Register immediately so a disk error cannot become an unhandled rejection.
  void completion.catch(() => {});
  const report: Array<{
    path: string;
    ownerId: string;
    kind: string;
    role?: string;
    status: string;
    error?: string;
  }> = [];
  try {
    for (const [index, item] of data.media.entries()) {
      signal.throwIfAborted();
      const testimonial = data.testimonials.find(
        (testimonial) => testimonial._id === item.ownerId,
      );
      const label = `${item.kind === "video" ? "Video" : "Image"}${typeof testimonial?.submitterName === "string" ? ` · ${testimonial.submitterName}` : ""}`;
      options.onProgress?.({
        phase: "media",
        processed: index,
        total: data.media.length,
        failed: report.filter((entry) => entry.status === "missing").length,
        current: label,
      });
      if (
        !/^(images|videos)\/[a-zA-Z0-9_./-]+$/.test(item.path) ||
        item.path.includes("..")
      )
        throw new Error("Invalid archive path.");
      let error = item.error;
      const temporary = join(directory, `media-${index}`);
      if (!error) {
        try {
          if (item.providerAssetId && options.prepareVideo)
            item.url = await options.prepareVideo(item.providerAssetId);
          if (!item.url || !allowedExportUrl(item.url, storageOrigin))
            throw new Error("Media has no trusted hosted URL.");
          const response = await fetch(item.url, {
            redirect: "error",
            signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
          });
          const contentType = response.headers.get("content-type") ?? "";
          if (
            !response.ok ||
            !response.body ||
            !(
              item.kind === "video"
                ? /^(video\/|application\/octet-stream)/
                : /^image\//
            ).test(contentType)
          )
            throw new Error(
              "Media download is unavailable or has an unexpected format.",
            );
          let bytes = 0;
          const maximum =
            item.kind === "video" ? 2 * 1024 ** 3 : 25 * 1024 ** 2;
          await pipeline(
            Readable.fromWeb(
              response.body as import("node:stream/web").ReadableStream,
            ),
            new Transform({
              transform(chunk, _, callback) {
                bytes += chunk.length;
                callback(
                  bytes > maximum
                    ? new Error("Media exceeds the export file limit.")
                    : null,
                  chunk,
                );
              },
            }),
            createWriteStream(temporary),
            { signal },
          );
          if (!bytes) throw new Error("Media file is empty.");
        } catch (cause) {
          signal.throwIfAborted();
          error =
            cause instanceof Error && !item.url?.includes(cause.message)
              ? "Media download failed. Retry before deleting the project."
              : "Media download failed.";
        }
      }
      if (!error) {
        const appended = new Promise<void>((resolve, reject) => {
          archive.once("entry", () => {
            archive.off("error", reject);
            resolve();
          });
          archive.once("error", reject);
        });
        archive.append(createReadStream(temporary), { name: item.path });
        await appended;
      }
      await rm(temporary, { force: true });
      report.push({
        path: item.path,
        ownerId: item.ownerId,
        kind: item.kind,
        role: item.role,
        status: error ? "missing" : "included",
        ...(error ? { error } : {}),
      });
      options.onProgress?.({
        phase: "media",
        processed: index + 1,
        total: data.media.length,
        failed: report.filter((entry) => entry.status === "missing").length,
        current: label,
      });
    }
    options.onProgress?.({
      phase: "finalizing",
      processed: data.media.length,
      total: data.media.length,
      failed: report.filter((entry) => entry.status === "missing").length,
    });
    const complete = report.every((item) => item.status === "included");
    // Signed download URLs are deliberately absent from the portable manifest.
    const portable = {
      ...data,
      media: report,
      organization: {
        ...data.organization,
        mediaPaths: report
          .filter(
            (item) =>
              item.ownerId === data.organization._id &&
              item.status === "included",
          )
          .map((item) => item.path),
      },
      testimonials: data.testimonials.map((item) => ({
        ...item,
        images: undefined,
        mediaPaths: report
          .filter(
            (media) =>
              media.ownerId === item._id && media.status === "included",
          )
          .map((media) => media.path),
      })),
    };
    archive.append(JSON.stringify(portable, null, 2), { name: "data.json" });
    archive.append(JSON.stringify({ complete, files: report }, null, 2), {
      name: "export-report.json",
    });
    archive.append(
      complete
        ? "All listed hosted media were included. data.json links to files using mediaPaths. importOrigin retains source references for provenance.\n"
        : "INCOMPLETE EXPORT: some media could not be retrieved. Check export-report.json and retry before deleting your project.\n",
      { name: "README.txt" },
    );
    await archive.finalize();
    await completion;
    return {
      path,
      complete,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    archive.abort();
    await completion.catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
