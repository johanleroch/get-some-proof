export function videoDownloadFeedback(status: "processing" | "ready") {
  return status === "processing"
    ? "Preparing your MP4. The download will start automatically."
    : "Your MP4 download is ready.";
}

type VideoDownloadResult =
  { status: "processing" } | { status: "ready"; url: string };

export async function waitForVideoDownload({
  maxAttempts = 60,
  onProcessing,
  requestDownload,
  retryDelayMs = 2_000,
}: {
  maxAttempts?: number;
  onProcessing: () => void;
  requestDownload: () => Promise<VideoDownloadResult>;
  retryDelayMs?: number;
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await requestDownload();
    if (result.status === "ready") return result;

    onProcessing();
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(
    "The MP4 is taking longer than expected. Try the download again in a moment.",
  );
}
