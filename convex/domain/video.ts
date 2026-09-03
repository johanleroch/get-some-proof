export const supportedVideoMimeTypes = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type VideoAssetStatus =
  "awaiting_upload" | "processing" | "ready" | "failed";

export type VideoPlan = "free" | "premium";

export function normalizeVideoMimeType(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export async function deriveVideoRetryToken(secret: string, seed: string) {
  if (secret.length < 32) {
    throw new Error(
      "Video retry token secret must contain at least 32 characters.",
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`video-retry:${seed}`),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function assertVideoMetadata(input: {
  durationSeconds: number;
  mimeType: string;
}) {
  const mimeType = normalizeVideoMimeType(input.mimeType);
  if (!(supportedVideoMimeTypes as readonly string[]).includes(mimeType)) {
    throw new Error("Choose an MP4, MOV or WebM video.");
  }
  if (
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0 ||
    input.durationSeconds > 120
  ) {
    throw new Error("Video must be no longer than 2 minutes.");
  }
  return { durationSeconds: input.durationSeconds, mimeType };
}

const transitions: Record<VideoAssetStatus, VideoAssetStatus[]> = {
  awaiting_upload: ["processing", "failed"],
  processing: ["ready", "failed"],
  ready: [],
  failed: [],
};

export function transitionVideoAsset(
  current: VideoAssetStatus,
  next: VideoAssetStatus,
) {
  if (current === next) return current;
  if (!transitions[current].includes(next)) {
    throw new Error(`Video Asset ${current} cannot become ${next}.`);
  }
  return next;
}

export function videoCapacityLimit(plan: VideoPlan) {
  return plan === "premium" ? 25 : 2;
}
