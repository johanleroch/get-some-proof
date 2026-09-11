"use client";
import { useState } from "react";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import { PublicWallSettings } from "@/components/organizations/public-wall-settings";

export function TestimonialSourcesFixture() {
  const [show, setShow] = useState(true);
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <PublicWallSettings
        settings={{
          accentColor: "#b86a08",
          canHideAttribution: false,
          hideAttribution: false,
          showSourceIcons: show,
          theme: "light",
          transparentEmbed: false,
          visibility: { avatar: true, company: true, rating: true, role: true },
        }}
        onSave={async (values) => setShow(values.showSourceIcons ?? true)}
      />
      <div className="space-y-5">
        <TestimonialCard
          accentColor="#b86a08"
          testimonial={{
            id: "source-text",
            type: "text",
            name: "Camille Laurent",
            company: "Atelier Rose",
            avatarUrl: null,
            publishedAt: 1,
            rating: 5,
            text: "Une équipe à l’écoute et un accompagnement précieux. Nous avons gagné un temps fou !",
            source: show
              ? {
                  platform: "google",
                  url: "https://www.google.com/maps/reviews/1",
                }
              : undefined,
          }}
        />
        <TestimonialCard
          accentColor="#b86a08"
          testimonial={{
            id: "source-video",
            type: "video",
            name: "Lina Martin",
            avatarUrl: null,
            publishedAt: 1,
            captionsAvailable: false,
            playbackId: "fixture",
            posterUrl: "/brand/testimonial-sample.svg",
            aspectRatio: "16:9",
            source: show
              ? {
                  platform: "linkedin",
                  url: "https://www.linkedin.com/posts/original",
                }
              : undefined,
          }}
        />
      </div>
    </div>
  );
}
