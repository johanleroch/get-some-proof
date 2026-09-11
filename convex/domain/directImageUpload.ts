import { v, type Infer } from "convex/values";

export const directImageTarget = v.union(
  v.object({ kind: v.literal("ownerPhoto") }),
  v.object({
    kind: v.literal("brandLogo"),
    organizationId: v.id("organizations"),
  }),
  v.object({
    kind: v.literal("submitterPhoto"),
    reservationId: v.id("submissionAvatarUploads"),
  }),
  v.object({
    kind: v.literal("testimonialImage"),
    imageId: v.id("testimonialImages"),
  }),
  v.object({
    kind: v.literal("videoThumbnail"),
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  }),
);

export type DirectImageTarget = Infer<typeof directImageTarget>;
