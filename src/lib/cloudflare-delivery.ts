import { z } from "zod";
import {
  widgetPayload,
  type WidgetPresentation,
} from "@/components/studio/widget-payload";
import { sourcePlatforms } from "@convex/domain/testimonialSource";

export const MAX_PUBLICATION_BYTES = 1_000_000;
export const PUBLIC_WIDGET_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const configSchema = z.object({
  layout: z.enum([
    "wall",
    "individual",
    "carousel",
    "masonry",
    "highlights",
    "avatars",
  ]),
  font: z.enum(["inherit", "sans", "serif", "mono"]),
  accentColor: color,
  backgroundColor: color,
  textColor: color,
  testimonialLinksEnabled: z.boolean().optional(),
});
const cardSchema = z.object({
  id: z.string().max(100),
  type: z.literal("text"),
  name: z.string().max(300),
  avatarUrl: z.null(),
  avatarVisible: z.boolean().optional(),
  publishedAt: z.number().finite(),
  rating: z.number().min(1).max(5).optional(),
  role: z.string().max(500).optional(),
  company: z.string().max(500).optional(),
  text: z.string().max(8000),
  richText: z
    .array(
      z.object({
        type: z.literal("p"),
        children: z
          .array(
            z.object({
              text: z.string().max(8000),
              highlight: z.boolean().optional(),
              href: z.string().max(2048).optional(),
            }),
          )
          .max(2000),
      }),
    )
    .max(100)
    .optional(),
  source: z
    .object({
      platform: z.enum(sourcePlatforms),
      url: z.string().max(2048).optional(),
    })
    .optional(),
});
const metadataSchema = z
  .object({
    publicId: z.string().regex(PUBLIC_WIDGET_ID),
    revision: z.number().int().nonnegative(),
    policyRevision: z.number().int().nonnegative(),
    generatedAt: z.number().int().nonnegative(),
    validUntil: z.number().int().nonnegative(),
    allowedOrigins: z
      .array(
        z
          .string()
          .max(2048)
          .refine((value) => {
            try {
              const url = new URL(value);
              return (
                url.origin === value &&
                !value.includes("*") &&
                (url.protocol === "https:" ||
                  (url.protocol === "http:" &&
                    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
              );
            } catch {
              return false;
            }
          }),
      )
      .min(1)
      .max(20),
  })
  .refine(
    (m) =>
      m.validUntil > m.generatedAt &&
      m.validUntil <= m.generatedAt + 86_400_000,
  );
export type DeliveryMetadata = z.infer<typeof metadataSchema>;
const payloadSchema = z.object({
  schemaVersion: z.literal(1),
  config: configSchema,
  googleFont: z.null(),
  customFont: z.null(),
  brand: z.object({
    name: z.string().max(300),
    accentColor: color,
    accentInk: color,
    attributionRequired: z.boolean(),
    theme: z.literal("light"),
    transparentEmbed: z.literal(false),
  }),
  testimonials: z
    .array(cardSchema.extend({ html: z.string().max(MAX_PUBLICATION_BYTES) }))
    .max(50),
});
const publicationSchema = metadataSchema.and(
  z.object({
    schemaVersion: z.literal(1),
    surface: z.literal("widget"),
    payload: payloadSchema,
  }),
);

/** Publication boundary: whitelist public fields and use the existing product renderer. */
export function prepareDeliveryPublication(
  value: WidgetPresentation,
  metadata: DeliveryMetadata,
) {
  if (
    value.googleFont ||
    value.customFont ||
    value.config.googleFont ||
    value.config.customFontId ||
    value.testimonials.some(
      (card) => card.type !== "text" || card.avatarUrl || card.images?.length,
    )
  )
    throw new Error("CANARY_TEXT_ONLY");
  const safeMetadata = metadataSchema.parse(metadata);
  const testimonials = z
    .array(cardSchema)
    .max(50)
    .parse(value.testimonials)
    .map((card, index) => ({ ...card, id: `proof-${index + 1}` }));
  const payload = widgetPayload({
    config: configSchema.parse(value.config),
    brandName: value.brandName,
    attributionRequired: value.attributionRequired,
    testimonials,
  });
  return parseDeliveryPublication(
    JSON.stringify({
      schemaVersion: 1,
      surface: "widget",
      ...safeMetadata,
      payload,
    }),
  );
}

/** KV is a versioned provider boundary, not an unchecked browser payload. */
export function parseDeliveryPublication(raw: string) {
  if (new TextEncoder().encode(raw).byteLength > MAX_PUBLICATION_BYTES)
    throw new Error("PUBLICATION_TOO_LARGE");
  return publicationSchema.parse(JSON.parse(raw));
}
export type DeliveryPublication = z.infer<typeof publicationSchema>;
