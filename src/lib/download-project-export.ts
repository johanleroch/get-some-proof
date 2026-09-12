import type { ExportProgress, ExportStreamEvent } from "./export-progress";
type SaveHandle = { createWritable(): Promise<WritableStream<Uint8Array>> };
type SaveWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<SaveHandle>;
};

/** Reads newline-delimited progress, then hands the remaining binary stream to the saver. */
export async function readExportProgress(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onProgress: (progress: ExportProgress) => void,
) {
  let buffered = new Uint8Array(0);
  for (;;) {
    const newline = buffered.indexOf(10);
    if (newline >= 0) {
      const event = JSON.parse(
        new TextDecoder().decode(buffered.subarray(0, newline)),
      ) as ExportStreamEvent;
      buffered = buffered.slice(newline + 1);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "archive")
        return { complete: event.complete, remainder: buffered };
      if (event.type !== "progress")
        throw new Error("Invalid export response.");
      onProgress(event.progress);
      continue;
    }
    if (buffered.length > 65536) throw new Error("Invalid export response.");
    const { done, value } = await reader.read();
    if (done) throw new Error("Export interrupted. Please retry.");
    const next = new Uint8Array(buffered.length + value.length);
    next.set(buffered);
    next.set(value, buffered.length);
    buffered = next;
  }
}

export async function downloadProjectExport(
  organizationId: string,
  publicSlug: string,
  onProgress: (progress: ExportProgress) => void = () => {},
) {
  const name = `${publicSlug}-export.zip`;
  let handle: SaveHandle | undefined;
  try {
    handle = await (window as SaveWindow).showSaveFilePicker?.({
      suggestedName: name,
      types: [
        { description: "ZIP archive", accept: { "application/zip": [".zip"] } },
      ],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error("Export cancelled. No file was saved.");
    throw error;
  }

  const response = await fetch("/api/project-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId }),
  });
  if (!response.ok || !response.body)
    throw new Error(
      "Export could not be prepared. Retry before deleting this project.",
    );
  const reader = response.body.getReader();
  let latest: ExportProgress = {
    phase: "preparing",
    processed: 0,
    total: 0,
    failed: 0,
  };
  const update = (value: ExportProgress) => {
    latest = value;
    onProgress(value);
  };
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  try {
    const { complete, remainder } = await readExportProgress(reader, update);
    update({ ...latest, phase: "saving", current: undefined });
    if (handle) writer = (await handle.createWritable()).getWriter();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let bytes = 0;
    async function save(chunk: Uint8Array) {
      if (!chunk.length) return;
      if (writer) await writer.write(chunk);
      else {
        bytes += chunk.length;
        if (bytes > 256 * 1024 ** 2)
          throw new Error(
            "This archive is too large for this browser. Use Chrome or Edge to save directly to disk.",
          );
        chunks.push(new Uint8Array(chunk));
      }
    }
    await save(remainder);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await save(value);
    }
    if (writer) await writer.close();
    else {
      const url = URL.createObjectURL(
        new Blob(chunks, { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.download = complete ? name : `INCOMPLETE-${name}`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    update({ ...latest, phase: "done" });
    if (!complete)
      throw new Error(
        "The ZIP is incomplete. Read export-report.json for missing files and retry before deleting this project.",
      );
  } catch (error) {
    await writer?.abort().catch(() => {});
    throw error;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
