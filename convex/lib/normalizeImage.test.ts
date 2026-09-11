import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { normalizeStoredImage } from "./normalizeImage";

describe("normalizeStoredImage", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
    ["avif", "image/avif"],
  ] as const)(
    "accepts static %s input and emits WebP",
    async (format, mime) => {
      const source = sharp({
        create: {
          width: 64,
          height: 48,
          channels: 3,
          background: { r: 50, g: 100, b: 150 },
        },
      });
      const input = await source[format]().toBuffer();

      const result = await normalizeStoredImage(
        new Blob([new Uint8Array(input)], { type: mime }),
        "submitterPhoto",
        "import",
      );

      expect(
        (await sharp(new Uint8Array(result.bytes)).metadata()).format,
      ).toBe("webp");
      expect(result.metadata.originalContentType).toBe(mime);
    },
  );

  it("converts a large transparent PNG to bounded WebP and preserves alpha", async () => {
    const input = await sharp({
      create: {
        width: 1800,
        height: 900,
        channels: 4,
        background: { r: 240, g: 180, b: 20, alpha: 0.45 },
      },
    })
      .png()
      .toBuffer();

    const result = await normalizeStoredImage(
      new Blob([new Uint8Array(input)], { type: "image/png" }),
      "brandLogo",
      "import",
    );
    const metadata = await sharp(new Uint8Array(result.bytes)).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.hasAlpha).toBe(true);
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(512);
    expect(metadata.exif).toBeUndefined();
    expect(result.metadata).toMatchObject({
      contentType: "image/webp",
      height: 512,
      kind: "brandLogo",
      originalContentType: "image/png",
      originalSize: input.byteLength,
      source: "import",
      transformVersion: "webp-v1",
      width: 1024,
    });
    expect(result.bytes.byteLength).toBeLessThanOrEqual(500 * 1024);
  });

  it("applies EXIF orientation before resizing and strips the metadata", async () => {
    const input = await sharp({
      create: {
        width: 400,
        height: 200,
        channels: 3,
        background: { r: 20, g: 80, b: 140 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await normalizeStoredImage(
      new Blob([new Uint8Array(input)], { type: "image/jpeg" }),
      "submitterPhoto",
      "import",
    );
    const metadata = await sharp(new Uint8Array(result.bytes)).metadata();

    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(400);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects unsupported bytes and animated WebP containers", async () => {
    await expect(
      normalizeStoredImage(
        new Blob(["<svg/>"] as BlobPart[], { type: "image/svg+xml" }),
        "brandLogo",
        "import",
      ),
    ).rejects.toMatchObject({
      diagnostic: "UNSUPPORTED_IMAGE",
    });
    await expect(
      normalizeStoredImage(
        new Blob(["RIFF0000WEBPVP8 ANIM payload"], { type: "image/webp" }),
        "submitterPhoto",
        "import",
      ),
    ).rejects.toMatchObject({
      diagnostic: "ANIMATED_IMAGE",
    });
    await expect(
      normalizeStoredImage(
        new Blob(["GIF89a"], { type: "image/gif" }),
        "submitterPhoto",
        "import",
      ),
    ).rejects.toMatchObject({ diagnostic: "UNSUPPORTED_IMAGE" });
  });
});
