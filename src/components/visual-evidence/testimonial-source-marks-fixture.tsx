"use client";

import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import { sourceIcons } from "@/components/testimonials/source-icons";
import { sourcePlatforms } from "@convex/domain/testimonialSource";

/** One synthetic quotation per platform, so every badge is proved on a real card. */
const quotations: Record<(typeof sourcePlatforms)[number], string> = {
  google: "Found them on a Saturday, booked by Sunday. Worth every minute.",
  trustpilot: "Third order this year. Nothing has gone wrong yet.",
  x: "The embed took one line and it still looks like us.",
  linkedin: "We saved five hours every week. Our customers noticed.",
  facebook: "The team answered on a Sunday. That never happens.",
  instagram: "Sent them a photo, got the whole thing back styled.",
  youtube: "Watched the walkthrough twice and set it up myself.",
  reddit: "Been recommending this in three threads now. It holds up.",
  producthunt: "Shipped the day we launched. Support replied in minutes.",
  github: "Read the source, opened one issue, had a fix by Friday.",
  tiktok: "Filmed it on my phone in one take and the wall looked clean.",
};

const names = [
  "Camille Laurent",
  "Noor Haddad",
  "Priya Natarajan",
  "Alex Morgan",
  "Sofia Ferreira",
  "Tomas Novak",
  "Ines Bouchard",
  "Marcus Reed",
  "Lena Fischer",
  "Yuki Tanaka",
  "Diego Salas",
];

export function TestimonialSourceMarksFixture() {
  return (
    <div className="space-y-6">
      <h1 className="type-heading">Source marks</h1>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sourcePlatforms.map((platform, index) => (
          <TestimonialCard
            accentColor="#b86a08"
            key={platform}
            testimonial={{
              avatarUrl: null,
              company: sourceIcons[platform].label,
              id: `source-${platform}`,
              name: names[index] ?? "Alex Morgan",
              publishedAt: Date.UTC(2026, 8, 3),
              rating: 5,
              role: "Customer",
              source: { platform },
              text: quotations[platform],
              type: "text",
            }}
          />
        ))}
      </div>
    </div>
  );
}
