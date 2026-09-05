export function inspectVideoFile(file: File) {
  return new Promise<{
    durationSeconds: number;
    height: number;
    width: number;
  }>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      video.removeAttribute("src");
      URL.revokeObjectURL(objectUrl);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationSeconds = video.duration;
      const height = video.videoHeight;
      const width = video.videoWidth;
      cleanup();
      if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0 ||
        durationSeconds > 120
      ) {
        reject(new Error("Video must be no longer than 2 minutes."));
        return;
      }
      if (
        !Number.isSafeInteger(height) ||
        height <= 0 ||
        !Number.isSafeInteger(width) ||
        width <= 0
      ) {
        reject(new Error("This video's dimensions could not be read."));
        return;
      }
      resolve({ durationSeconds, height, width });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("This video could not be read."));
    };
    video.src = objectUrl;
  });
}
