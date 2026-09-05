import { type Infer, v } from "convex/values";

export const testimonialCardIdentityValidator = {
  avatarUrl: v.union(v.null(), v.string()),
  avatarVisible: v.optional(v.boolean()),
  company: v.optional(v.string()),
  // This is a display-only identity shared with the serialized public embed.
  // Operational mutations use the separately typed testimonialId field.
  id: v.string(),
  name: v.string(),
  publishedAt: v.number(),
  rating: v.optional(v.number()),
  role: v.optional(v.string()),
};

export const testimonialCardValueValidator = v.union(
  v.object({
    ...testimonialCardIdentityValidator,
    text: v.string(),
    type: v.literal("text"),
  }),
  v.object({
    ...testimonialCardIdentityValidator,
    aspectRatio: v.optional(v.string()),
    captionsAvailable: v.boolean(),
    playbackId: v.string(),
    posterTimeSeconds: v.optional(v.number()),
    type: v.literal("video"),
  }),
);

export type TestimonialCardValue = Infer<typeof testimonialCardValueValidator>;
export type TestimonialCardTextValue = Extract<
  TestimonialCardValue,
  { type: "text" }
>;
export type TestimonialCardVideoValue = Extract<
  TestimonialCardValue,
  { type: "video" }
>;

type TestimonialCardIdentity = Omit<TestimonialCardTextValue, "text" | "type">;

type TestimonialCardContent =
  | Pick<TestimonialCardTextValue, "text" | "type">
  | Pick<
      TestimonialCardVideoValue,
      | "aspectRatio"
      | "captionsAvailable"
      | "playbackId"
      | "posterTimeSeconds"
      | "type"
    >;

export function testimonialCardValue(
  identity: TestimonialCardIdentity,
  content: Pick<TestimonialCardTextValue, "text" | "type">,
): TestimonialCardTextValue;
export function testimonialCardValue(
  identity: TestimonialCardIdentity,
  content: Pick<
    TestimonialCardVideoValue,
    | "aspectRatio"
    | "captionsAvailable"
    | "playbackId"
    | "posterTimeSeconds"
    | "type"
  >,
): TestimonialCardVideoValue;
export function testimonialCardValue(
  identity: TestimonialCardIdentity,
  content: TestimonialCardContent,
): TestimonialCardValue {
  return { ...identity, ...content } as TestimonialCardValue;
}
