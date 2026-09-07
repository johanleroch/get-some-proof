import { type Infer, v } from "convex/values";

export const richTextValidator = v.array(
  v.object({
    type: v.literal("p"),
    children: v.array(
      v.object({ text: v.string(), highlight: v.optional(v.boolean()) }),
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
  return value.map((block) => ({
    type: "p" as const,
    children: block.children.map((leaf) => ({
      text: leaf.text,
      ...(leaf.highlight ? { highlight: true } : {}),
    })),
  }));
}
