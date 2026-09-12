import { describe, expect, it } from "vitest";

import { sourcePlatforms } from "@convex/domain/testimonialSource";

import { sourceIcons } from "./source-icons";
import {
  testimonialCardHtml,
  testimonialPoster,
} from "./testimonial-card-markup";

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

it.each(sourcePlatforms)("stamps a card with the %s mark", (platform) => {
  const html = testimonialCardHtml({
    accentColor: "#123abc",
    testimonial: {
      avatarUrl: null,
      id: "card-1",
      name: "Maya Chen",
      publishedAt: 1,
      source: { platform },
      text: "Original words",
      type: "text",
    },
  });
  expect(html).toContain(`data-gsp-source="${platform}"`);
  expect(html).toContain(`aria-label="Source: ${sourceIcons[platform].label}"`);
  // Drawn through its fit, so no mark can reach a card off the grid.
  expect(html).toContain(`<g transform="${sourceIcons[platform].fit}">`);
});

it.each(["text", "video"] as const)(
  "renders a source badge safely on %s cards",
  (type) => {
    const testimonial =
      type === "video"
        ? video
        : { ...video, type: "text" as const, text: "Original words" };
    const render = (source?: { platform: "google"; url?: string }) =>
      testimonialCardHtml({
        accentColor: "#123abc",
        testimonial: { ...testimonial, source },
      });
    expect(
      render({ platform: "google", url: "https://google.com/maps/reviews/1" }),
    ).toContain('href="https://google.com/maps/reviews/1"');
    expect(
      render({ platform: "google", url: "javascript:alert(1)" }),
    ).not.toContain("href=");
    expect(render({ platform: "google" })).toContain(
      'aria-label="Source: Google"',
    );
    expect(render()).not.toContain("data-gsp-source");
  },
);
