import { describe, expect, it } from "vitest";

import { testimonialPoster } from "./testimonial-card-markup";

const video = {
  aspectRatio: "9:16",
  avatarUrl: null,
  captionsAvailable: true,
  id: "video-1",
  name: "Maya Chen",
  playbackId: "public-playback-id",
  publishedAt: 1,
  type: "video" as const,
};

describe("testimonialPoster", () => {
  it("frames the middle of the video unless the Owner chose a moment", () => {
    expect(testimonialPoster(video)).toBe(
      "https://image.mux.com/public-playback-id/thumbnail.webp?width=960&time=0.5",
    );
    expect(testimonialPoster({ ...video, posterTimeSeconds: 12.5 })).toContain(
      "time=12.5",
    );
  });

  it("prefers the image the Owner uploaded over any frame", () => {
    expect(
      testimonialPoster({
        ...video,
        posterTimeSeconds: 12.5,
        posterUrl: "https://files.example/poster.jpg",
      }),
    ).toBe("https://files.example/poster.jpg");
  });
});
