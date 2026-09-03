import { describe, expect, it } from "vitest";

import {
  assertVideoMetadata,
  deriveVideoRetryToken,
  transitionVideoAsset,
  videoCapacityLimit,
} from "./video";

describe("Video Testimonial domain", () => {
  it("accepts supported short videos and rejects unsupported or overlong media", () => {
    expect(
      assertVideoMetadata({ durationSeconds: 119.9, mimeType: "video/mp4" }),
    ).toEqual({ durationSeconds: 119.9, mimeType: "video/mp4" });
    expect(
      assertVideoMetadata({
        durationSeconds: 60,
        mimeType: "video/webm;codecs=vp8,opus",
      }),
    ).toEqual({ durationSeconds: 60, mimeType: "video/webm" });
    expect(() =>
      assertVideoMetadata({ durationSeconds: 121, mimeType: "video/mp4" }),
    ).toThrow("2 minutes");
    expect(() =>
      assertVideoMetadata({ durationSeconds: 12, mimeType: "image/png" }),
    ).toThrow("MP4, MOV or WebM");
  });

  it("allows only idempotent forward lifecycle transitions", () => {
    expect(transitionVideoAsset("awaiting_upload", "processing")).toBe(
      "processing",
    );
    expect(transitionVideoAsset("processing", "ready")).toBe("ready");
    expect(transitionVideoAsset("ready", "ready")).toBe("ready");
    expect(() => transitionVideoAsset("ready", "failed")).toThrow(
      "cannot become failed",
    );
  });

  it("keeps the MVP capacity policy explicit for Free and Pro", () => {
    expect(videoCapacityLimit("free")).toBe(2);
    expect(videoCapacityLimit("premium")).toBe(25);
  });

  it("derives stable unguessable retry material without persisting the raw token", async () => {
    const secret = "test-video-retry-secret-at-least-32-characters";
    await expect(deriveVideoRetryToken(secret, "event-1")).resolves.toMatch(
      /^[a-f0-9]{64}$/,
    );
    await expect(deriveVideoRetryToken(secret, "event-1")).resolves.toBe(
      await deriveVideoRetryToken(secret, "event-1"),
    );
    await expect(deriveVideoRetryToken(secret, "event-2")).resolves.not.toBe(
      await deriveVideoRetryToken(secret, "event-1"),
    );
  });
});
