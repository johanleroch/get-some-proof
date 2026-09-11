import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectRasterImage,
  imageAssetProfiles,
  maximumImageInputPixels,
  optimizeImageForUpload,
} from "./image-assets";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockBrowserImage(
  width: number,
  height: number,
  outputSizes: number[],
) {
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:test-image"),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal(
    "Image",
    class {
      naturalHeight = height;
      naturalWidth = width;
      src = "";
      decode = vi.fn().mockResolvedValue(undefined);
    },
  );
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const qualities: number[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback, type, quality) => {
      qualities.push(Number(quality));
      const size = outputSizes.shift() ?? 16;
      callback(new Blob([new Uint8Array(size)], { type }));
    },
  );
  return { drawImage, qualities };
}

describe("image asset policy", () => {
  it("detects the supported raster signatures instead of trusting MIME", () => {
    expect(detectRasterImage(Uint8Array.from([0xff, 0xd8, 0xff]))).toEqual({
      animated: false,
      contentType: "image/jpeg",
    });
    expect(
      detectRasterImage(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toEqual({ animated: false, contentType: "image/png" });
    expect(
      detectRasterImage(new TextEncoder().encode("RIFF0000WEBPVP8  payload")),
    ).toEqual({ animated: false, contentType: "image/webp" });
    expect(
      detectRasterImage(
        Uint8Array.from([
          0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
        ]),
      ),
    ).toEqual({ animated: false, contentType: "image/avif" });
    expect(detectRasterImage(new TextEncoder().encode("<svg/>"))).toBeNull();
  });

  it("rejects animation markers in otherwise supported containers", () => {
    expect(
      detectRasterImage(
        new TextEncoder().encode("RIFF0000WEBPVP8 ANIM payload"),
      ),
    ).toEqual({ animated: true, contentType: "image/webp" });
    expect(
      detectRasterImage(
        Uint8Array.from([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
          ...new TextEncoder().encode("acTL"),
        ]),
      ),
    ).toEqual({ animated: true, contentType: "image/png" });
  });

  it("keeps distinct geometry and byte budgets for each use", () => {
    expect(imageAssetProfiles.submitterPhoto).toMatchObject({
      maxWidth: 512,
      maxHeight: 512,
      maximumBytes: 300 * 1024,
    });
    expect(imageAssetProfiles.brandLogo).toMatchObject({
      maxWidth: 1024,
      maxHeight: 1024,
      maximumBytes: 500 * 1024,
    });
    expect(imageAssetProfiles.testimonialImage).toMatchObject({
      maxWidth: 1920,
      maxHeight: 1920,
      maximumBytes: 1024 * 1024,
    });
    expect(imageAssetProfiles.videoThumbnail).toMatchObject({
      maxWidth: 1280,
      maxHeight: 720,
      maximumBytes: 600 * 1024,
    });
    expect(maximumImageInputPixels).toBe(40_000_000);
  });

  it("preserves a large attachment ratio and retries WebP quality", async () => {
    const browser = mockBrowserImage(2_000, 1_000, [600 * 1024, 400 * 1024]);
    const input = new Blob([
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ]);

    const result = await optimizeImageForUpload(input, "testimonialImage");

    expect(result.metadata).toMatchObject({
      contentType: "image/webp",
      height: 960,
      kind: "testimonialImage",
      originalContentType: "image/png",
      size: 400 * 1024,
      width: 1920,
    });
    expect(browser.qualities).toHaveLength(2);
    expect(browser.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      2_000,
      1_000,
      0,
      0,
      1920,
      960,
    );
  });

  it("center-crops a custom thumbnail to 16:9 without upscaling", async () => {
    const browser = mockBrowserImage(800, 1_600, [100 * 1024]);
    const input = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])]);

    const result = await optimizeImageForUpload(input, "videoThumbnail");

    expect(result.metadata).toMatchObject({ height: 450, width: 800 });
    expect(browser.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      575,
      800,
      450,
      0,
      0,
      800,
      450,
    );
  });
});
