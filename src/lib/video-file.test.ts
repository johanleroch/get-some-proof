import { afterEach, describe, expect, it, vi } from "vitest";

import { inspectVideoFile } from "./video-file";

describe("inspectVideoFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the encoded file dimensions before upload", async () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName !== "video") return element;
      Object.defineProperties(element, {
        duration: { value: 42 },
        videoHeight: { value: 1920 },
        videoWidth: { value: 1080 },
      });
      queueMicrotask(() =>
        element.onloadedmetadata?.(new Event("loadedmetadata")),
      );
      return element;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-video");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    await expect(
      inspectVideoFile(
        new File(["video"], "portrait.webm", { type: "video/webm" }),
      ),
    ).resolves.toEqual({ durationSeconds: 42, height: 1920, width: 1080 });
  });
});
