export function inspectVideoFile(file: File) {
  return new Promise<{ durationSeconds: number }>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      video.removeAttribute("src");
      URL.revokeObjectURL(objectUrl);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationSeconds = video.duration;
      cleanup();
      if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0 ||
        durationSeconds > 120
      ) {
        reject(new Error("Video must be no longer than 2 minutes."));
        return;
      }
      resolve({ durationSeconds });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("This video could not be read."));
    };
    video.src = objectUrl;
  });
}
