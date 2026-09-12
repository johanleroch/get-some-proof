"use client";

import { useState } from "react";

import {
  sourceIconSvg,
  sourceIcons,
  type SourcePlatform,
} from "@/components/testimonials/source-icons";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { sourcePlatforms } from "@convex/domain/testimonialSource";

/** What each glyph actually is today, so a swap is a decision and not a guess. */
const inventory: Record<
  SourcePlatform,
  {
    /** Solid, outline or multicolour: the mix is what breaks the family. */
    treatment: "Solid" | "Outline" | "Multicolour";
    /** Badge = the platform container is drawn, bare = the mark alone. */
    shape: "Badge" | "Bare mark";
    origin: string;
  }
> = {
  google: {
    treatment: "Multicolour",
    shape: "Bare mark",
    origin: "Official Google G (fonts.gstatic.com)",
  },
  x: { treatment: "Solid", shape: "Bare mark", origin: "Tabler brand-x" },
  linkedin: {
    treatment: "Solid",
    shape: "Badge",
    origin: "Tabler brand-linkedin (filled)",
  },
  facebook: {
    treatment: "Solid",
    shape: "Bare mark",
    origin: "Tabler brand-facebook (filled)",
  },
  instagram: {
    treatment: "Outline",
    shape: "Badge",
    origin: "Tabler brand-instagram (stroke)",
  },
  youtube: {
    treatment: "Solid",
    shape: "Badge",
    origin: "Tabler brand-youtube-filled",
  },
  reddit: {
    treatment: "Outline",
    shape: "Bare mark",
    origin: "Tabler brand-reddit (stroke)",
  },
  producthunt: {
    treatment: "Outline",
    shape: "Badge",
    origin: "Tabler brand-producthunt (stroke)",
  },
  github: {
    treatment: "Solid",
    shape: "Bare mark",
    origin: "Tabler brand-github-filled",
  },
  tiktok: {
    treatment: "Multicolour",
    shape: "Bare mark",
    origin: "Tabler brand-tiktok-filled, three offset layers",
  },
};

const sizes = [
  { key: "20", label: "20px · wall" },
  { key: "24", label: "24px" },
  { key: "32", label: "32px" },
] as const;

function Glyph({
  chip,
  platform,
  size,
}: {
  chip: boolean;
  platform: SourcePlatform;
  size: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      dangerouslySetInnerHTML={{
        __html: sourceIconSvg(platform, { chip, size }),
      }}
    />
  );
}

export function SourceIconsShowcase() {
  const [size, setSize] = useState<(typeof sizes)[number]["key"]>("20");
  const pixels = Number(size);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Badge size"
          onChange={setSize}
          options={sizes}
          value={size}
        />
        <p className="text-muted-foreground type-small max-w-prose">
          The wall ships 20px on a white chip inside a 44px target. Every glyph
          here is the exact markup the card and the embed render: each tile
          shows the drawing at 56px, then the shipped chip on the wall&rsquo;s
          paper.
        </p>
      </div>

      <div className="space-y-3">
        <p className="type-ui">The family, side by side</p>
        <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-4">
          {sourcePlatforms.map((platform) => (
            <Glyph chip key={platform} platform={platform} size={pixels} />
          ))}
        </div>
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border p-4"
          style={{ background: "#1c1a17", borderColor: "#2c2926" }}
        >
          {sourcePlatforms.map((platform) => (
            <Glyph chip key={platform} platform={platform} size={pixels} />
          ))}
        </div>
        <p className="text-muted-foreground type-small">
          The chip is hardcoded white, so on a dark wall each badge is a white
          square. Solid marks read heavier than the three outlines next to them.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sourcePlatforms.map((platform) => {
          const { color, label } = sourceIcons[platform];
          const { origin, shape, treatment } = inventory[platform];
          return (
            <div
              className="bg-card space-y-3 rounded-lg border p-4"
              key={platform}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-ui truncate">{label}</p>
                  <p className="text-muted-foreground type-small font-mono">
                    {platform}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Badge
                    variant={treatment === "Outline" ? "warning" : "neutral"}
                  >
                    {treatment}
                  </Badge>
                  <Badge variant="outline">{shape}</Badge>
                </div>
              </div>

              <div className="flex items-stretch gap-3">
                <div className="bg-surface-2 grid h-24 flex-1 place-items-center rounded-md border">
                  <Glyph chip={false} platform={platform} size={56} />
                </div>
                <div className="grid w-24 place-items-center rounded-md border bg-white">
                  <Glyph chip platform={platform} size={pixels} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full border"
                  style={{ background: color }}
                />
                <span className="text-muted-foreground type-small font-mono">
                  {color}
                </span>
              </div>
              <p className="text-muted-foreground type-small">{origin}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
