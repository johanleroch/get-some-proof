export const imageAssetKinds = [
  "ownerPhoto",
  "brandLogo",
  "submitterPhoto",
  "testimonialImage",
  "videoThumbnail",
] as const;

export type ImageAssetKind = (typeof imageAssetKinds)[number];

export const acceptedImageInputTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const imageTransformVersion = "webp-v1" as const;
export const maximumImageInputBytes = 20 * 1024 * 1024;
export const maximumImageInputPixels = 40_000_000;

export const imageAssetProfiles: Record<
  ImageAssetKind,
  {
    maxWidth: number;
    maxHeight: number;
    targetBytes: number;
    maximumBytes: number;
    quality: number;
    minimumQuality: number;
  }
> = {
  ownerPhoto: {
    maxWidth: 512,
    maxHeight: 512,
    targetBytes: 150 * 1024,
    maximumBytes: 300 * 1024,
    quality: 0.82,
    minimumQuality: 0.62,
  },
  brandLogo: {
    maxWidth: 1024,
    maxHeight: 1024,
    targetBytes: 250 * 1024,
    maximumBytes: 500 * 1024,
    quality: 0.94,
    minimumQuality: 0.82,
  },
  submitterPhoto: {
    maxWidth: 512,
    maxHeight: 512,
    targetBytes: 150 * 1024,
    maximumBytes: 300 * 1024,
    quality: 0.82,
    minimumQuality: 0.62,
  },
  testimonialImage: {
    maxWidth: 1920,
    maxHeight: 1920,
    targetBytes: 500 * 1024,
    maximumBytes: 1024 * 1024,
    quality: 0.8,
    minimumQuality: 0.6,
  },
  videoThumbnail: {
    maxWidth: 1280,
    maxHeight: 720,
    targetBytes: 300 * 1024,
    maximumBytes: 600 * 1024,
    quality: 0.82,
    minimumQuality: 0.62,
  },
};

export type ImageAssetSource = "direct" | "import" | "generated" | "migration";

export type ImageAssetMetadata = {
  contentType: "image/webp";
  height: number;
  kind: ImageAssetKind;
  originalContentType: string;
  originalSize: number;
  size: number;
  source: ImageAssetSource;
  transformVersion: typeof imageTransformVersion;
  width: number;
};

export type OptimizedImage = {
  blob: Blob;
  metadata: ImageAssetMetadata;
};

export class ImageOptimizationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "EMPTY_IMAGE"
      | "IMAGE_TOO_LARGE"
      | "TOO_MANY_PIXELS"
      | "UNSUPPORTED_IMAGE"
      | "ANIMATED_IMAGE"
      | "DECODE_FAILED"
      | "ENCODE_FAILED"
      | "OUTPUT_TOO_LARGE",
  ) {
    super(message);
    this.name = "ImageOptimizationError";
  }
}

function ascii(bytes: Uint8Array, from: number, to: number) {
  return String.fromCharCode(...bytes.subarray(from, to));
}

function containsAscii(bytes: Uint8Array, marker: string) {
  const markerBytes = new TextEncoder().encode(marker);
  outer: for (
    let index = 0;
    index <= bytes.length - markerBytes.length;
    index++
  ) {
    for (let offset = 0; offset < markerBytes.length; offset++) {
      if (bytes[index + offset] !== markerBytes[offset]) continue outer;
    }
    return true;
  }
  return false;
}

export function detectRasterImage(bytes: Uint8Array): {
  animated: boolean;
  contentType: (typeof acceptedImageInputTypes)[number];
} | null {
  const starts = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  if (starts(0xff, 0xd8, 0xff))
    return { animated: false, contentType: "image/jpeg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { animated: containsAscii(bytes, "acTL"), contentType: "image/png" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP")
    return {
      animated: containsAscii(bytes, "ANIM") || containsAscii(bytes, "ANMF"),
      contentType: "image/webp",
    };
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brands = ascii(bytes, 8, Math.min(bytes.length, 64));
    if (brands.includes("avif") || brands.includes("avis"))
      return { animated: brands.includes("avis"), contentType: "image/avif" };
  }
  return null;
}

async function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(
            new ImageOptimizationError(
              "This browser cannot prepare WebP images.",
              "ENCODE_FAILED",
            ),
          );
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function loadImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new ImageOptimizationError(
      "This image could not be decoded.",
      "DECODE_FAILED",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
  return image;
}

export async function optimizeImageForUpload(
  input: Blob,
  kind: ImageAssetKind,
  source: ImageAssetSource = "direct",
): Promise<OptimizedImage> {
  if (!input.size)
    throw new ImageOptimizationError(
      "Choose a non-empty image.",
      "EMPTY_IMAGE",
    );
  if (input.size > maximumImageInputBytes)
    throw new ImageOptimizationError(
      "Choose an image smaller than 20 MB.",
      "IMAGE_TOO_LARGE",
    );
  const bytes = new Uint8Array(await input.arrayBuffer());
  const detected = detectRasterImage(bytes);
  if (!detected)
    throw new ImageOptimizationError(
      "Choose a JPEG, PNG, WebP, or AVIF image.",
      "UNSUPPORTED_IMAGE",
    );
  if (detected.animated)
    throw new ImageOptimizationError(
      "Animated images are not supported.",
      "ANIMATED_IMAGE",
    );
  const image = await loadImage(input);
  if (image.naturalWidth * image.naturalHeight > maximumImageInputPixels)
    throw new ImageOptimizationError(
      "Choose an image smaller than 40 megapixels.",
      "TOO_MANY_PIXELS",
    );
  const profile = imageAssetProfiles[kind];
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (kind === "videoThumbnail") {
    const targetRatio = 16 / 9;
    const sourceRatio = sourceWidth / sourceHeight;
    if (sourceRatio > targetRatio) {
      sourceWidth = Math.round(sourceHeight * targetRatio);
      sourceX = Math.round((image.naturalWidth - sourceWidth) / 2);
    } else if (sourceRatio < targetRatio) {
      sourceHeight = Math.round(sourceWidth / targetRatio);
      sourceY = Math.round((image.naturalHeight - sourceHeight) / 2);
    }
  }
  const scale = Math.min(
    1,
    profile.maxWidth / sourceWidth,
    profile.maxHeight / sourceHeight,
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context)
    throw new ImageOptimizationError(
      "Image editing is unavailable in this browser.",
      "ENCODE_FAILED",
    );
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );

  let output: Blob | undefined;
  for (
    let quality = profile.quality;
    quality >= profile.minimumQuality - 0.001;
    quality -= 0.06
  ) {
    output = await canvasBlob(
      canvas,
      Math.max(quality, profile.minimumQuality),
    );
    if (output.size <= profile.targetBytes) break;
  }
  if (!output || output.size > profile.maximumBytes)
    throw new ImageOptimizationError(
      "The optimized image is still too large. Choose a simpler or smaller image.",
      "OUTPUT_TOO_LARGE",
    );
  return {
    blob: output,
    metadata: {
      contentType: "image/webp",
      height,
      kind,
      originalContentType: detected.contentType,
      originalSize: input.size,
      size: output.size,
      source,
      transformVersion: imageTransformVersion,
      width,
    },
  };
}
