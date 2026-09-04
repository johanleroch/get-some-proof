import { ConvexError } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export type PublicVisibility = {
  avatar: boolean;
  company: boolean;
  rating: boolean;
  role: boolean;
};

export const defaultPublicVisibility: PublicVisibility = {
  avatar: true,
  company: true,
  rating: true,
  role: true,
};

export function organizationPublicVisibility(
  organization: Doc<"organizations">,
): PublicVisibility {
  return organization.publicWallVisibility ?? defaultPublicVisibility;
}

export function resolvedPublicVisibility(
  organization: Doc<"organizations">,
  testimonial: Doc<"testimonials">,
): PublicVisibility {
  const global = organizationPublicVisibility(organization);
  const overrides = testimonial.publicVisibilityOverrides;
  return {
    avatar: overrides?.avatar ?? global.avatar,
    company: overrides?.company ?? global.company,
    rating: overrides?.rating ?? global.rating,
    role: overrides?.role ?? global.role,
  };
}

function unavailable(): never {
  throw new ConvexError({
    code: "PUBLIC_PROJECTION_UNAVAILABLE",
    message: "The public Testimonial could not be prepared.",
  });
}

export async function upsertPublicProjection(
  ctx: MutationCtx,
  testimonial: Doc<"testimonials">,
  publishedAt: number,
  publicOrderKey?: string,
) {
  const [organization, consent, videoAsset, existingProjection] =
    await Promise.all([
      ctx.db.get(testimonial.organizationId),
      ctx.db
        .query("publicationConsents")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      testimonial.submissionType === "video"
        ? ctx.db
            .query("videoAssets")
            .withIndex("by_testimonial", (index) =>
              index.eq("testimonialId", testimonial._id),
            )
            .unique()
        : null,
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
    ]);
  if (!organization || !consent) unavailable();
  if (
    testimonial.submissionType === "video" &&
    (!videoAsset || videoAsset.status !== "ready" || !videoAsset.playbackId)
  ) {
    throw new ConvexError({
      code: "VIDEO_NOT_READY",
      message: "Only a Ready video Testimonial can be Published.",
    });
  }
  const consentFields = new Set(consent.identityFields);
  const identity = {
    avatarStorageId: consentFields.has("avatar")
      ? testimonial.avatarStorageId
      : undefined,
    company: consentFields.has("company") ? testimonial.company : undefined,
    name: testimonial.submitterName,
    organizationId: testimonial.organizationId,
    publishedAt,
    publicOrderKey:
      publicOrderKey ??
      existingProjection?.publicOrderKey ??
      (await nextPublicOrderKey(ctx, testimonial.organizationId)),
    rating: consentFields.has("rating") ? testimonial.rating : undefined,
    role: consentFields.has("role") ? testimonial.role : undefined,
    testimonialId: testimonial._id,
    visibilityOverrides: testimonial.publicVisibilityOverrides,
  };
  const projection =
    testimonial.submissionType === "video" && videoAsset
      ? {
          ...identity,
          aspectRatio: videoAsset.aspectRatio,
          captionsAvailable: videoAsset.captionsStatus === "ready",
          playbackId: videoAsset.playbackId!,
          posterTimeSeconds: videoAsset.durationSeconds
            ? videoAsset.durationSeconds / 2
            : undefined,
          type: "video" as const,
        }
      : { ...identity, text: testimonial.text, type: "text" as const };
  if (existingProjection) {
    await ctx.db.replace(existingProjection._id, projection);
    return existingProjection._id;
  }
  return await ctx.db.insert("publicTestimonialProjections", projection);
}

const orderDigits =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function validateOrderKey(value: string) {
  if (
    value.endsWith(orderDigits[0]!) ||
    [...value].some((character) => !orderDigits.includes(character))
  ) {
    unavailable();
  }
}

function midpoint(lower: string, upper?: string): string {
  validateOrderKey(lower);
  if (upper !== undefined) {
    validateOrderKey(upper);
    if (lower >= upper) unavailable();
    let common = 0;
    while ((lower[common] ?? orderDigits[0]) === upper[common]) common += 1;
    if (common > 0) {
      return `${upper.slice(0, common)}${midpoint(
        lower.slice(common),
        upper.slice(common),
      )}`;
    }
  }
  const lowerDigit = lower ? orderDigits.indexOf(lower[0]!) : 0;
  const upperDigit =
    upper === undefined ? orderDigits.length : orderDigits.indexOf(upper[0]!);
  if (upperDigit - lowerDigit > 1) {
    return orderDigits[Math.round((lowerDigit + upperDigit) / 2)]!;
  }
  if (upper && upper.length > 1) return upper[0]!;
  return `${orderDigits[lowerDigit]}${midpoint(lower.slice(1))}`;
}

export function publicOrderKeyBetween(before?: string, after?: string) {
  return midpoint(after ?? "", before);
}

export async function nextPublicOrderKey(
  ctx: MutationCtx,
  organizationId: Doc<"organizations">["_id"],
) {
  const first = await ctx.db
    .query("publicTestimonialProjections")
    .withIndex("by_organization_order_key", (index) =>
      index.eq("organizationId", organizationId),
    )
    .order("desc")
    .first();
  return publicOrderKeyBetween(undefined, first?.publicOrderKey);
}
