import { publicRichText } from "@convex/domain/testimonialRichText";
import type { WidgetConfig } from "@convex/domain/widgets";
import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { accentInk } from "@convex/domain/colorContrast";
import { testimonialCardHtml } from "@/components/testimonials/testimonial-card-markup";

export type WidgetPresentation = {
  config: WidgetConfig;
  googleFont?: string | null;
  customFont?: { id: string; url: string } | null;
  brandName: string;
  attributionRequired: boolean;
  testimonials: TestimonialCardValue[];
};

export function widgetPayload(value: WidgetPresentation) {
  const testimonials = value.testimonials.flatMap((original) => {
    const linksEnabled = value.config.testimonialLinksEnabled !== false;
    const testimonial = {
      ...original,
      ...(original.type === "text"
        ? { richText: publicRichText(original.richText, linksEnabled) }
        : {}),
      ...(original.source
        ? {
            source: {
              ...original.source,
              url: linksEnabled ? original.source.url : undefined,
            },
          }
        : {}),
    };
    if (value.config.layout !== "highlights") return [testimonial];
    if (testimonial.type !== "text") return [];
    const excerpts =
      testimonial.richText?.flatMap((block) =>
        block.children.flatMap((leaf) =>
          leaf.highlight && leaf.text.trim()
            ? [{ text: leaf.text, ...(leaf.href ? { href: leaf.href } : {}) }]
            : [],
        ),
      ) ?? [];
    if (!excerpts.length) return [];
    return [
      {
        ...testimonial,
        text: excerpts.map((leaf) => leaf.text).join(" … "),
        richText: [
          {
            type: "p" as const,
            children: excerpts.flatMap((leaf, index) =>
              index ? [{ text: " … " }, leaf] : [leaf],
            ),
          },
        ],
        images: undefined,
      },
    ];
  });
  return {
    schemaVersion: 1,
    config: value.config,
    customFont: value.customFont ?? null,
    googleFont: value.googleFont ?? null,
    brand: {
      name: value.brandName,
      accentColor: value.config.accentColor,
      accentInk: accentInk(value.config.accentColor),
      attributionRequired: value.attributionRequired,
      theme: "light",
      transparentEmbed: false,
    },
    testimonials: testimonials.map((testimonial) => ({
      ...testimonial,
      html: testimonialCardHtml({
        accentColor: value.config.accentColor,
        testimonial,
      }),
    })),
  };
}
export type WidgetPayload = ReturnType<typeof widgetPayload>;
