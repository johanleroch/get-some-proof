import { type Infer, v } from "convex/values";

export const richTextValidator = v.array(
  v.object({
    type: v.literal("p"),
    children: v.array(
      v.object({
        text: v.string(),
        highlight: v.optional(v.boolean()),
        href: v.optional(v.string()),
      }),
    ),
  }),
);
export type TestimonialRichText = Infer<typeof richTextValidator>;

export function richTextFromPlain(text: string): TestimonialRichText {
  return text.split("\n").map((text) => ({ type: "p", children: [{ text }] }));
}
export function richTextToPlain(value: TestimonialRichText): string {
  return value
    .map((block) => block.children.map((leaf) => leaf.text).join(""))
    .join("\n");
}
/** A deliberately narrow portable document; the server never accepts editor HTML. */
export function normalizeRichText(
  value: TestimonialRichText | undefined,
  text: string,
) {
  if (value === undefined) return undefined;
  if (
    !value.length ||
    value.length > 100 ||
    value.some((block) => !block.children.length) ||
    value.reduce((sum, block) => sum + block.children.length, 0) > 2000 ||
    richTextToPlain(value).length > 8000 ||
    richTextToPlain(value).trim() !== text.trim()
  ) {
    throw new Error("Formatting must preserve the testimonial's words.");
  }
  const normalized = value.map((block) => ({
    type: "p" as const,
    children: block.children.map((leaf) => ({
      text: leaf.text,
      ...(leaf.highlight ? { highlight: true } : {}),
      ...(safeTestimonialHref(leaf.href)
        ? { href: safeTestimonialHref(leaf.href) }
        : {}),
    })),
  }));
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > 64_000)
    throw new Error("Testimonial formatting is too large.");
  return normalized;
}

/** Only explicit web destinations; never infer a profile from a bare @name. */
export function safeTestimonialHref(
  value: string | undefined,
): string | undefined {
  if (!value || value.length > 2048 || !/^https?:\/\//i.test(value))
    return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password) return undefined;
    const href = url.toString();
    return href.length <= 2048 ? href : undefined;
  } catch {
    return undefined;
  }
}

/** Omit destinations from public payloads when the Owner disables links. */
export function publicRichText(
  value: TestimonialRichText | undefined,
  linksEnabled: boolean,
) {
  return value?.map((block) => ({
    ...block,
    children: block.children.map((leaf) => ({
      text: leaf.text,
      ...(leaf.highlight ? { highlight: true } : {}),
      ...(linksEnabled && safeTestimonialHref(leaf.href)
        ? { href: safeTestimonialHref(leaf.href) }
        : {}),
    })),
  }));
}
