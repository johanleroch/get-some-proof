import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { fetchAuthAction } from "@/lib/auth-server";
import {
  buildProjectArchive,
  type ExportDocument,
} from "@/lib/project-export-archive";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("Forbidden", { status: 403 });
  let organizationId: string;
  try {
    ({ organizationId } = await request.json());
    if (
      typeof organizationId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(organizationId)
    )
      throw new Error();
  } catch {
    return new Response("Invalid export request.", { status: 400 });
  }
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal]);
  async function* exportStream() {
    let result: Awaited<ReturnType<typeof buildProjectArchive>> | undefined;
    let transferring = false;
    let building: Promise<void> | undefined;
    const encode = (event: import("@/lib/export-progress").ExportStreamEvent) =>
      Buffer.from(JSON.stringify(event) + "\n");
    try {
      yield encode({
        type: "progress",
        progress: { phase: "preparing", processed: 0, total: 0, failed: 0 },
      });
      const data: ExportDocument = JSON.parse(
        await fetchAuthAction(api.workspaceDeletion.exportData, {
          organizationId: organizationId as Id<"organizations">,
          deferVideos: true,
        }),
      );
      const storageOrigin = new URL(process.env.NEXT_PUBLIC_CONVEX_URL!).origin;
      const queue: Buffer[] = [];
      let wake: (() => void) | undefined;
      let finished = false;
      let failure: unknown;
      building = buildProjectArchive(data, storageOrigin, signal, {
        onProgress: (progress) => {
          queue.push(encode({ type: "progress", progress }));
          wake?.();
        },
        prepareVideo: (assetId) =>
          fetchAuthAction(api.workspaceDeletion.prepareExportVideo, {
            organizationId: organizationId as Id<"organizations">,
            assetId,
          }),
      })
        .then((value) => {
          result = value;
        })
        .catch((error) => {
          failure = error;
        })
        .finally(() => {
          finished = true;
          wake?.();
        });
      while (!finished || queue.length) {
        if (queue.length) yield queue.shift()!;
        else
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
      }
      if (failure || !result) throw new Error("Export failed.");
      yield encode({ type: "archive", complete: result.complete });
      transferring = true;
      // Everything after the archive event is raw ZIP bytes; streaming keeps
      // large videos out of both the server heap and the browser heap.
      for await (const chunk of createReadStream(result.path)) yield chunk;
    } catch {
      if (transferring) throw new Error("ZIP transfer interrupted.");
      if (!signal.aborted)
        yield encode({
          type: "error",
          message:
            "Export could not be prepared. Retry before deleting your project.",
        });
    } finally {
      controller.abort();
      await building;
      await result?.cleanup();
    }
  }
  return new Response(
    Readable.toWeb(Readable.from(exportStream())) as ReadableStream,
    {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Accel-Buffering": "no",
      },
    },
  );
}
