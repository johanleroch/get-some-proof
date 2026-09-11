import { v, type Infer } from "convex/values";

export const imageAssetKind = v.union(
  v.literal("ownerPhoto"),
  v.literal("brandLogo"),
  v.literal("submitterPhoto"),
  v.literal("testimonialImage"),
  v.literal("videoThumbnail"),
);

export const imageAssetSource = v.union(
  v.literal("direct"),
  v.literal("import"),
  v.literal("generated"),
  v.literal("migration"),
);

export const imageAssetMetadata = v.object({
  contentType: v.literal("image/webp"),
  height: v.number(),
  kind: imageAssetKind,
  originalContentType: v.string(),
  originalSize: v.number(),
  size: v.number(),
  source: imageAssetSource,
  transformVersion: v.literal("webp-v1"),
  width: v.number(),
});

export type ImageAssetMetadataValue = Infer<typeof imageAssetMetadata>;
