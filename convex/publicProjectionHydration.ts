import { publicRichText } from "./domain/testimonialRichText";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { organizationPublicVisibility } from "./publicProjection";
import { resolveTestimonialImages } from "./testimonialImages";
import { testimonialCardValue } from "./testimonialCardValue";

/** The single public-safe card projection used by walls and widget selections. */
export async function hydratePublicProjection(
  ctx: QueryCtx,
  brand: Doc<"organizations">,
  projection: Doc<"publicTestimonialProjections">,
  linksEnabled: boolean,
) {
  const defaults = organizationPublicVisibility(brand);
  const visible = {
    avatar: projection.visibilityOverrides?.avatar ?? defaults.avatar,
    company: projection.visibilityOverrides?.company ?? defaults.company,
    rating: projection.visibilityOverrides?.rating ?? defaults.rating,
    role: projection.visibilityOverrides?.role ?? defaults.role,
  };
  const identity = {
    source:
      brand.publicWallShowSourceIcons === false
        ? undefined
        : projection.source
          ? {
              ...projection.source,
              url: linksEnabled ? projection.source.url : undefined,
            }
          : undefined,
    avatarUrl: projection.avatarStorageId
      ? visible.avatar
        ? await ctx.storage.getUrl(projection.avatarStorageId)
        : null
      : null,
    avatarVisible: visible.avatar,
    company: visible.company ? projection.company : undefined,
    id: projection._id,
    name: projection.name,
    publishedAt: projection.publishedAt,
    rating: visible.rating ? projection.rating : undefined,
    role: visible.role ? projection.role : undefined,
  };
  return projection.type === "video"
    ? testimonialCardValue(identity, {
        aspectRatio: projection.aspectRatio,
        captionsAvailable: projection.captionsAvailable,
        playbackId: projection.playbackId,
        posterTimeSeconds: projection.posterTimeSeconds,
        posterUrl: projection.posterStorageId
          ? ((await ctx.storage.getUrl(projection.posterStorageId)) ??
            undefined)
          : undefined,
        type: "video" as const,
      })
    : testimonialCardValue(identity, {
        text: projection.text,
        richText: publicRichText(projection.richText, linksEnabled),
        images: projection.imageIds?.length
          ? await resolveTestimonialImages(ctx, projection.imageIds)
          : undefined,
        type: "text" as const,
      });
}
