import { ConvexError, v, type Infer } from "convex/values";

export const importAttestationVersion = "2026-09-09";
export const importAttestationText =
  "I confirm that I have permission to publish this testimonial and the displayed customer details for this Brand.";

export const importResult = v.object({
  processing: v.optional(v.number()),
  failed: v.optional(v.number()),
  imported: v.number(),
  skipped: v.number(),
  changed: v.number(),
  unavailable: v.number(),
});

export const wallProvider = v.union(
  v.literal("testimonial-to"),
  v.literal("senja"),
);
export const importOrigin = v.object({
  acquisitionFlowId: v.optional(v.id("importAcquisitionFlows")),
  provider: wallProvider,
  sourceUrl: v.string(),
  sourceId: v.string(),
  originalAuthorName: v.string(),
  originalText: v.string(),
  originalTagline: v.optional(v.string()),
  originalType: v.optional(v.union(v.literal("text"), v.literal("video"))),
  originalVideoUrl: v.optional(v.string()),
  originalAvatarUrl: v.optional(v.string()),
  importedBy: v.string(),
  importedAt: v.number(),
  publicationAttestation: v.optional(
    v.object({
      acceptedBy: v.string(),
      acceptedAt: v.number(),
      version: v.string(),
      text: v.string(),
    }),
  ),
});
export const wallCandidate = v.object({
  sourceId: v.string(),
  type: v.union(v.literal("text"), v.literal("video")),
  authorName: v.string(),
  text: v.string(),
  tagline: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
  unavailableReason: v.optional(v.literal("VIDEO_SOURCE_UNAVAILABLE")),
});

function videoSourceIdentity(url: string) {
  // Rendition quality can change without replacing the public Mux video.
  const match = /^https:\/\/stream\.mux\.com\/([a-zA-Z0-9]+)\//.exec(url);
  return match ? `mux:${match[1]}` : url;
}

export function hasUnchangedImportContent(
  existing: {
    submissionType: "text" | "video";
    importOrigin?: Infer<typeof importOrigin>;
  },
  candidate: Infer<typeof wallCandidate>,
) {
  const origin = existing.importOrigin;
  if (
    !origin ||
    origin.originalText !== candidate.text ||
    origin.originalAuthorName !== candidate.authorName ||
    origin.originalTagline !== candidate.tagline ||
    (origin.originalType ?? existing.submissionType) !== candidate.type
  )
    return false;
  if (candidate.type === "text") return true;
  // Legacy imports without a source-media snapshot cannot prove equivalence.
  return (
    !!origin.originalVideoUrl &&
    !!candidate.videoUrl &&
    videoSourceIdentity(origin.originalVideoUrl) ===
      videoSourceIdentity(candidate.videoUrl)
  );
}

export const importChannel = v.union(
  v.literal("public-web"),
  v.literal("chatgpt"),
  v.literal("workspace"),
);
export const importStage = v.union(
  v.literal("started"),
  v.literal("previewed"),
  v.literal("claimed"),
  v.literal("saved"),
  v.literal("published"),
);

export function normalizeImportIdentity(args: {
  authorName: string;
  tagline: string;
}) {
  const authorName = args.authorName.trim();
  const tagline = args.tagline.trim();
  if (!authorName || authorName.length > 100 || tagline.length > 200)
    throw new ConvexError({
      code: "INVALID_IMPORT_IDENTITY",
      message:
        "Enter a name up to 100 characters and a role or company up to 200 characters.",
    });
  return { authorName, tagline };
}
