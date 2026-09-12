import { v, type Infer } from "convex/values";
import { safeTestimonialHref } from "./testimonialRichText";

export const sourcePlatforms = [
  "google",
  "trustpilot",
  "x",
  "linkedin",
  "facebook",
  "instagram",
  "youtube",
  "reddit",
  "producthunt",
  "github",
  "tiktok",
] as const;
export const testimonialSourceValidator = v.object({
  platform: v.union(...sourcePlatforms.map((platform) => v.literal(platform))),
  url: v.optional(v.string()),
});
export type TestimonialSource = Infer<typeof testimonialSourceValidator>;
const domains: Record<TestimonialSource["platform"], string[]> = {
  google: ["google.com", "maps.google.com", "g.page", "maps.app.goo.gl"],
  trustpilot: ["trustpilot.com"],
  x: ["x.com", "twitter.com"],
  linkedin: ["linkedin.com"],
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
  reddit: ["reddit.com"],
  producthunt: ["producthunt.com"],
  github: ["github.com"],
  tiktok: ["tiktok.com"],
};
/** Only explicit import metadata or a source-badge link identifies provenance. */
export function testimonialSource(
  platform: unknown,
  inputUrl?: unknown,
): TestimonialSource | undefined {
  const href =
    typeof inputUrl === "string" ? safeTestimonialHref(inputUrl) : undefined;
  const host = href ? new URL(href).hostname : undefined;
  const fromUrl = host
    ? sourcePlatforms.find((key) =>
        domains[key].some(
          (domain) => host === domain || host.endsWith(`.${domain}`),
        ),
      )
    : undefined;
  const alias =
    platform === "twitter"
      ? "x"
      : platform === "product-hunt"
        ? "producthunt"
        : platform;
  const explicit = sourcePlatforms.find((key) => key === alias);
  const selected = explicit ?? fromUrl;
  if (!selected) return undefined;
  // A mismatching link must never make the badge point to another platform.
  return {
    platform: selected,
    ...(href && fromUrl === selected ? { url: href } : {}),
  };
}
