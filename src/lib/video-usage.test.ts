import { describe, expect, it } from "vitest";

import {
  videoSlotsBarWidth,
  videoSlotsLeft,
  videoSlotsRatio,
  videoSlotsShown,
  videoSlotsUsed,
} from "./video-usage";

describe("video usage", () => {
  it("counts a slot held while an upload processes as spent", () => {
    expect(videoSlotsUsed({ readyVideos: 8, reservedVideos: 1 })).toBe(9);
    expect(videoSlotsLeft({ readyVideos: 8, reservedVideos: 1 }, 25)).toBe(16);
  });

  it("never prints more than the allowance, nor less than nothing", () => {
    expect(videoSlotsShown({ readyVideos: 24, reservedVideos: 3 }, 25)).toBe(
      25,
    );
    expect(videoSlotsLeft({ readyVideos: 24, reservedVideos: 3 }, 25)).toBe(0);
  });

  it("draws nothing when nothing is stored", () => {
    expect(videoSlotsBarWidth({ readyVideos: 0, reservedVideos: 0 }, 25)).toBe(
      0,
    );
  });

  it("draws a visible sliver for a single video", () => {
    expect(videoSlotsBarWidth({ readyVideos: 1, reservedVideos: 0 }, 100)).toBe(
      2,
    );
  });

  it("treats an allowance of zero as full rather than dividing by it", () => {
    expect(videoSlotsRatio({ readyVideos: 0, reservedVideos: 0 }, 0)).toBe(1);
    expect(videoSlotsBarWidth({ readyVideos: 0, reservedVideos: 0 }, 0)).toBe(
      100,
    );
  });
});
