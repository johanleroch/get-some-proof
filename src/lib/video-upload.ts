import { createUpload } from "@mux/upchunk";

export type DirectVideoUploadTarget = {
  onProgress: (progress: number) => void;
  provider: "fake" | "mux";
  signal?: AbortSignal;
  uploadUrl: string;
};

export function uploadDirectVideo(file: File, input: DirectVideoUploadTarget) {
  if (input.provider === "fake") {
    if (input.signal?.aborted) {
      return Promise.reject(new Error("Video upload cancelled."));
    }
    input.onProgress(100);
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(new Error("Video upload cancelled."));
      return;
    }
    const upload = createUpload({
      chunkSize: 30_720,
      endpoint: input.uploadUrl,
      file,
    });
    const finish = (callback: () => void) => {
      input.signal?.removeEventListener("abort", abortUpload);
      callback();
    };
    const abortUpload = () => {
      upload.abort();
      finish(() => reject(new Error("Video upload cancelled.")));
    };
    input.signal?.addEventListener("abort", abortUpload, { once: true });
    upload.on("progress", (event) => input.onProgress(event.detail));
    upload.on("success", () => finish(resolve));
    upload.on("error", (event) =>
      finish(() =>
        reject(new Error(event.detail.message || "Video upload failed.")),
      ),
    );
  });
}
