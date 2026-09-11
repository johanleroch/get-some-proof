"use node";

import sharp from "sharp";

import {
  detectRasterImage,
  imageAssetProfiles,
  imageTransformVersion,
  maximumImageInputBytes,
  maximumImageInputPixels,
  type ImageAssetKind,
  type ImageAssetMetadata,
  type ImageAssetSource,
} from "../../src/lib/image-assets";

export class StoredImageNormalizationError extends Error {
  constructor(
    public readonly diagnostic:
      | "EMPTY_IMAGE"
      | "IMAGE_TOO_LARGE"
      | "TOO_MANY_PIXELS"
      | "UNSUPPORTED_IMAGE"
      | "ANIMATED_IMAGE"
      | "DECODE_FAILED"
      | "OUTPUT_TOO_LARGE",
  ) {
    super("The image could not be optimized.");
    this.name = "StoredImageNormalizationError";
  }
}

export async function normalizeStoredImage(
  input: Blob,
  kind: ImageAssetKind,
  source: ImageAssetSource,
): Promise<{ bytes: ArrayBuffer; metadata: ImageAssetMetadata }> {
  if (!input.size) throw new StoredImageNormalizationError("EMPTY_IMAGE");
  if (input.size > maximumImageInputBytes)
    throw new StoredImageNormalizationError("IMAGE_TOO_LARGE");
  const sourceBytes = new Uint8Array(await input.arrayBuffer());
  const detected = detectRasterImage(sourceBytes);
  if (!detected) throw new StoredImageNormalizationError("UNSUPPORTED_IMAGE");
  if (detected.animated)
    throw new StoredImageNormalizationError("ANIMATED_IMAGE");
  const profile = imageAssetProfiles[kind];
  let pipeline = sharp(sourceBytes, {
    animated: false,
    limitInputPixels: maximumImageInputPixels,
  }).autoOrient();
  let sourceMetadata: Awaited<ReturnType<typeof pipeline.metadata>>;
  try {
    sourceMetadata = await pipeline.metadata();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("pixel limit")
    )
      throw new StoredImageNormalizationError("TOO_MANY_PIXELS");
    throw new StoredImageNormalizationError("DECODE_FAILED");
  }
  if (
    !sourceMetadata.width ||
    !sourceMetadata.height ||
    (sourceMetadata.pages && sourceMetadata.pages > 1)
  )
    throw new StoredImageNormalizationError(
      sourceMetadata.pages && sourceMetadata.pages > 1
        ? "ANIMATED_IMAGE"
        : "DECODE_FAILED",
    );
  if (kind === "ownerPhoto") {
    const side = Math.min(
      profile.maxWidth,
      sourceMetadata.width,
      sourceMetadata.height,
    );
    pipeline = pipeline.resize({ width: side, height: side, fit: "cover" });
  } else if (kind === "videoThumbnail") {
    const targetRatio = profile.maxWidth / profile.maxHeight;
    const sourceRatio = sourceMetadata.width / sourceMetadata.height;
    const width =
      sourceRatio > targetRatio
        ? Math.floor(
            Math.min(profile.maxHeight, sourceMetadata.height) * targetRatio,
          )
        : Math.min(profile.maxWidth, sourceMetadata.width);
    const height =
      sourceRatio > targetRatio
        ? Math.min(profile.maxHeight, sourceMetadata.height)
        : Math.floor(width / targetRatio);
    pipeline = pipeline.resize({ width, height, fit: "cover" });
  } else {
    pipeline = pipeline.resize({
      width: profile.maxWidth,
      height: profile.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let output: Buffer | undefined;
  for (
    let quality = Math.round(profile.quality * 100);
    quality >= Math.round(profile.minimumQuality * 100);
    quality -= 6
  ) {
    output = await pipeline
      .clone()
      .webp(
        kind === "brandLogo"
          ? { nearLossless: true, quality, alphaQuality: 100, effort: 5 }
          : { quality, alphaQuality: 90, effort: 5 },
      )
      .toBuffer();
    if (output.byteLength <= profile.targetBytes) break;
  }
  if (!output || output.byteLength > profile.maximumBytes)
    throw new StoredImageNormalizationError("OUTPUT_TOO_LARGE");
  const normalizedMetadata = await sharp(output).metadata();
  if (!normalizedMetadata.width || !normalizedMetadata.height)
    throw new StoredImageNormalizationError("DECODE_FAILED");
  return {
    bytes: output.buffer.slice(
      output.byteOffset,
      output.byteOffset + output.byteLength,
    ) as ArrayBuffer,
    metadata: {
      contentType: "image/webp",
      height: normalizedMetadata.height,
      kind,
      originalContentType: detected.contentType,
      originalSize: input.size,
      size: output.byteLength,
      source,
      transformVersion: imageTransformVersion,
      width: normalizedMetadata.width,
    },
  };
}
