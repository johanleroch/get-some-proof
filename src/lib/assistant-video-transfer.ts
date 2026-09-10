export class AssistantVideoTransferError extends Error {
  readonly resumable: boolean;
  constructor(message: string, resumable = false) {
    super(message);
    this.name = "AssistantVideoTransferError";
    this.resumable = resumable;
  }
}

export type AssistantUploadCapability = {
  status: "uploading" | "finalizing" | "complete";
  uploadUrl: string;
  uploadToken: string;
  expiresAt: number;
  offset: number;
  totalBytes: number;
  chunkSize: number;
};

/** Shared by the browser file picker and the Node file-transfer command.
 * Bytes stay outside MCP messages. Acknowledgement means uploaded, not Ready. */
export async function transferAssistantVideo(
  file: Blob,
  capability: AssistantUploadCapability,
  options: {
    signal?: AbortSignal;
    onProgress?: (offset: number, total: number) => void;
  } = {},
): Promise<"complete" | "finalizing"> {
  const url = URL.parse(capability.uploadUrl);
  if (
    !["uploading", "finalizing", "complete"].includes(capability.status) ||
    !Number.isFinite(capability.expiresAt) ||
    !url ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !/^[a-f0-9]{64}$/.test(capability.uploadToken) ||
    !Number.isSafeInteger(capability.offset) ||
    capability.offset < 0 ||
    capability.offset > capability.totalBytes ||
    !Number.isSafeInteger(capability.chunkSize) ||
    capability.chunkSize <= 0 ||
    capability.chunkSize > 8 * 1024 * 1024
  )
    throw new AssistantVideoTransferError("Invalid file upload destination.");
  if (
    file.size !== capability.totalBytes ||
    file.size <= 0 ||
    file.size > 512 * 1024 * 1024
  )
    throw new AssistantVideoTransferError(
      "Choose the same file used to request this upload, no larger than 512 MB.",
    );
  if (capability.status !== "uploading") return capability.status;
  let offset = capability.offset;
  options.onProgress?.(offset, file.size);
  while (offset < file.size) {
    options.signal?.throwIfAborted();
    if (Date.now() >= capability.expiresAt)
      throw new AssistantVideoTransferError(
        "This upload expired. Choose the file again from the Inbox.",
      );
    const end = Math.min(file.size, offset + capability.chunkSize);
    const piece = file.slice(offset, end);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      options.signal?.throwIfAborted();
      try {
        response = await fetch(capability.uploadUrl, {
          method: "POST",
          redirect: "error",
          signal: options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(45_000)])
            : AbortSignal.timeout(45_000),
          headers: {
            Authorization: `Bearer ${capability.uploadToken}`,
            "Content-Type": "application/octet-stream",
            "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
          },
          body: piece,
        });
        if (response.status < 500 && response.status !== 429) break;
      } catch {
        options.signal?.throwIfAborted();
        response = undefined;
      }
    }
    if (!response || response.status >= 500 || response.status === 429)
      throw new AssistantVideoTransferError(
        "The transfer was interrupted. Resume with the same file and upload request.",
        true,
      );
    if (response.status === 202) return "finalizing";
    if (
      response.status === 409 ||
      response.status === 401 ||
      response.status === 403
    )
      throw new AssistantVideoTransferError(
        "This upload expired or is no longer available. Choose the file again from the Inbox.",
      );
    if (!response.ok)
      throw new AssistantVideoTransferError(
        "The video could not be uploaded. Choose a supported MP4, MOV or WebM file.",
      );
    const result = (await response.json()) as { offset?: number };
    if (result.offset !== end)
      throw new AssistantVideoTransferError(
        "The transfer was not confirmed. Resume with the same file and upload request.",
        true,
      );
    offset = end;
    options.onProgress?.(offset, file.size);
  }
  return "complete";
}
