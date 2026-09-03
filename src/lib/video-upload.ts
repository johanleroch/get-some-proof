import { createUpload } from "@mux/upchunk";

export type DirectVideoUploadTarget = {
  onProgress: (progress: number) => void;
  provider: "fake" | "mux";
  uploadUrl: string;
};

export function uploadDirectVideo(file: File, input: DirectVideoUploadTarget) {
  if (input.provider === "fake") {
    input.onProgress(100);
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const upload = createUpload({
      chunkSize: 30_720,
      endpoint: input.uploadUrl,
      file,
    });
    upload.on("progress", (event) => input.onProgress(event.detail));
    upload.on("success", () => resolve());
    upload.on("error", (event) =>
      reject(new Error(event.detail.message || "Video upload failed.")),
    );
  });
}
