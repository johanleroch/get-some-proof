"use client";
import { useState } from "react";
import { publicRichText } from "@convex/domain/testimonialRichText";
import { AccountTestimonialLinksView } from "@/components/account/account-testimonial-links";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import { PageHeader } from "@/components/page-header";

export function TestimonialLinksFixture() {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Testimonial links"
        description="One setting for all your Projects."
      />
      <AccountTestimonialLinksView
        enabled={enabled}
        onChange={async (value) => setEnabled(value)}
      />
      <div className="max-w-lg">
        <h2 className="type-heading mb-4">Public testimonial</h2>
        <TestimonialCard
          accentColor="#b86a08"
          testimonial={{
            id: "links-fixture",
            type: "text",
            name: "Camille Laurent",
            company: "Atelier Rose",
            avatarUrl: null,
            publishedAt: 1,
            text: "Merci @atelierrose et @lina pour votre accompagnement. Une équipe formidable !",
            richText: publicRichText(
              [
                {
                  type: "p",
                  children: [
                    { text: "Merci " },
                    {
                      text: "@atelierrose",
                      href: "https://example.com/atelierrose",
                    },
                    { text: " et " },
                    {
                      text: "@lina",
                      href: "https://example.com/lina",
                      highlight: true,
                    },
                    {
                      text: " pour votre accompagnement. Une équipe formidable !",
                    },
                  ],
                },
              ],
              enabled,
            ),
          }}
        />
      </div>
    </div>
  );
}
