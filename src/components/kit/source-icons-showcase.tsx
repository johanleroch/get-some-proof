"use client";

/*
The "before" column below still holds the @tabler/icons-react 3.46.0 redraws
(MIT, Copyright (c) 2020-2026 Pawel Kuna, https://github.com/tabler/tabler-icons)
the wall shipped until this review. They exist only so the swap can be judged
side by side, and leave with the review. Nothing outside this file reads them.
*/

import { useState } from "react";

import {
  sourceIconSvg,
  sourceIcons,
  type SourcePlatform,
} from "@/components/testimonials/source-icons";
import { Segmented } from "@/components/ui/segmented";
import { sourcePlatforms } from "@convex/domain/testimonialSource";

const previous: Partial<
  Record<SourcePlatform, { color: string; markup: string }>
> = {
  x: {
    color: "#000000",
    markup:
      '<g stroke="none" fill="currentColor"><path d="M8.267 3a1 1 0 0 1 .73 .317l.076 .092l4.274 5.828l5.946 -5.944a1 1 0 0 1 1.497 1.32l-.083 .094l-6.163 6.162l6.262 8.54a1 1 0 0 1 -.697 1.585l-.109 .006h-4.267a1 1 0 0 1 -.73 -.317l-.076 -.092l-4.276 -5.829l-5.944 5.945a1 1 0 0 1 -1.497 -1.32l.083 -.094l6.161 -6.163l-6.26 -8.539a1 1 0 0 1 .697 -1.585l.109 -.006h4.267z"></path></g>',
  },
  linkedin: {
    color: "#0a66c2",
    markup:
      '<g stroke="none" fill="currentColor"><path d="M17 2a5 5 0 0 1 5 5v10a5 5 0 0 1 -5 5h-10a5 5 0 0 1 -5 -5v-10a5 5 0 0 1 5 -5zm-9 8a1 1 0 0 0 -1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0 -1 -1m6 0a3 3 0 0 0 -1.168 .236l-.125 .057a1 1 0 0 0 -1.707 .707v5a1 1 0 0 0 2 0v-3a1 1 0 0 1 2 0v3a1 1 0 0 0 2 0v-3a3 3 0 0 0 -3 -3m-6 -3a1 1 0 0 0 -.993 .883l-.007 .127a1 1 0 0 0 1.993 .117l.007 -.127a1 1 0 0 0 -1 -1"></path></g>',
  },
  facebook: {
    color: "#1877f2",
    markup:
      '<g stroke="none" fill="currentColor"><path d="M18 2a1 1 0 0 1 .993 .883l.007 .117v4a1 1 0 0 1 -.883 .993l-.117 .007h-3v1h3a1 1 0 0 1 .991 1.131l-.02 .112l-1 4a1 1 0 0 1 -.858 .75l-.113 .007h-2v6a1 1 0 0 1 -.883 .993l-.117 .007h-4a1 1 0 0 1 -.993 -.883l-.007 -.117v-6h-2a1 1 0 0 1 -.993 -.883l-.007 -.117v-4a1 1 0 0 1 .883 -.993l.117 -.007h2v-1a6 6 0 0 1 5.775 -5.996l.225 -.004h3z"></path></g>',
  },
  instagram: {
    color: "#e4405f",
    markup:
      '<path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4l0 -8"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path><path d="M16.5 7.5v.01"></path>',
  },
  youtube: {
    color: "#ff0000",
    markup:
      '<g stroke="none" fill="currentColor"><path d="M18 3a5 5 0 0 1 5 5v8a5 5 0 0 1 -5 5h-12a5 5 0 0 1 -5 -5v-8a5 5 0 0 1 5 -5zm-9 6v6a1 1 0 0 0 1.514 .857l5 -3a1 1 0 0 0 0 -1.714l-5 -3a1 1 0 0 0 -1.514 .857z"></path></g>',
  },
  reddit: {
    color: "#ff4500",
    markup:
      '<path d="M12 8c2.648 0 5.028 .826 6.675 2.14a2.5 2.5 0 0 1 2.326 4.36c0 3.59 -4.03 6.5 -9 6.5c-4.875 0 -8.845 -2.8 -9 -6.294l-1 -.206a2.5 2.5 0 0 1 2.326 -4.36c1.646 -1.313 4.026 -2.14 6.674 -2.14l.999 0"></path><path d="M12 8l1 -5l6 1"></path><path d="M18 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M8.5 13a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0" fill="currentColor"></path><path d="M14.5 13a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0" fill="currentColor"></path><path d="M10 17c.667 .333 1.333 .5 2 .5s1.333 -.167 2 -.5"></path>',
  },
  producthunt: {
    color: "#da552f",
    markup:
      '<path d="M10 16v-8h2.5a2.5 2.5 0 1 1 0 5h-2.5"></path><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>',
  },
  github: {
    color: "#181717",
    markup:
      '<g stroke="none" fill="currentColor"><path d="M5.315 2.1c.791 -.113 1.9 .145 3.333 .966l.272 .161l.16 .1l.397 -.083a13.3 13.3 0 0 1 4.59 -.08l.456 .08l.396 .083l.161 -.1c1.385 -.84 2.487 -1.17 3.322 -1.148l.164 .008l.147 .017l.076 .014l.05 .011l.144 .047a1 1 0 0 1 .53 .514a5.2 5.2 0 0 1 .397 2.91l-.047 .267l-.046 .196l.123 .163c.574 .795 .93 1.728 1.03 2.707l.023 .295l.007 .272c0 3.855 -1.659 5.883 -4.644 6.68l-.245 .061l-.132 .029l.014 .161l.008 .157l.004 .365l-.002 .213l-.003 3.834a1 1 0 0 1 -.883 .993l-.117 .007h-6a1 1 0 0 1 -.993 -.883l-.007 -.117v-.734c-1.818 .26 -3.03 -.424 -4.11 -1.878l-.535 -.766c-.28 -.396 -.455 -.579 -.589 -.644l-.048 -.019a1 1 0 0 1 .564 -1.918c.642 .188 1.074 .568 1.57 1.239l.538 .769c.76 1.079 1.36 1.459 2.609 1.191l.001 -.678l-.018 -.168a5.03 5.03 0 0 1 -.021 -.824l.017 -.185l.019 -.12l-.108 -.024c-2.976 -.71 -4.703 -2.573 -4.875 -6.139l-.01 -.31l-.004 -.292a5.6 5.6 0 0 1 .908 -3.051l.152 -.222l.122 -.163l-.045 -.196a5.2 5.2 0 0 1 .145 -2.642l.1 -.282l.106 -.253a1 1 0 0 1 .529 -.514l.144 -.047l.154 -.03z"></path></g>',
  },
  tiktok: {
    color: "#000000",
    markup:
      '<g stroke="none"><g fill="#25f4ee" transform="translate(-.6,-.6)"><path d="M16.083 2h-4.083a1 1 0 0 0 -1 1v11.5a1.5 1.5 0 1 1 -2.519 -1.1l.12 -.1a1 1 0 0 0 .399 -.8v-4.326a1 1 0 0 0 -1.23 -.974a7.5 7.5 0 0 0 1.73 14.8l.243 -.005a7.5 7.5 0 0 0 7.257 -7.495v-2.7l.311 .153c1.122 .53 2.333 .868 3.59 .993a1 1 0 0 0 1.099 -.996v-4.033a1 1 0 0 0 -.834 -.986a5.005 5.005 0 0 1 -4.097 -4.096a1 1 0 0 0 -.986 -.835z"></path></g><g fill="#fe2c55" transform="translate(.6,.6)"><path d="M16.083 2h-4.083a1 1 0 0 0 -1 1v11.5a1.5 1.5 0 1 1 -2.519 -1.1l.12 -.1a1 1 0 0 0 .399 -.8v-4.326a1 1 0 0 0 -1.23 -.974a7.5 7.5 0 0 0 1.73 14.8l.243 -.005a7.5 7.5 0 0 0 7.257 -7.495v-2.7l.311 .153c1.122 .53 2.333 .868 3.59 .993a1 1 0 0 0 1.099 -.996v-4.033a1 1 0 0 0 -.834 -.986a5.005 5.005 0 0 1 -4.097 -4.096a1 1 0 0 0 -.986 -.835z"></path></g><g fill="currentColor"><path d="M16.083 2h-4.083a1 1 0 0 0 -1 1v11.5a1.5 1.5 0 1 1 -2.519 -1.1l.12 -.1a1 1 0 0 0 .399 -.8v-4.326a1 1 0 0 0 -1.23 -.974a7.5 7.5 0 0 0 1.73 14.8l.243 -.005a7.5 7.5 0 0 0 7.257 -7.495v-2.7l.311 .153c1.122 .53 2.333 .868 3.59 .993a1 1 0 0 0 1.099 -.996v-4.033a1 1 0 0 0 -.834 -.986a5.005 5.005 0 0 1 -4.097 -4.096a1 1 0 0 0 -.986 -.835z"></path></g></g>',
  },
};

/** Where each shipped mark comes from, so provenance is never a guess. */
const origin: Record<SourcePlatform, string> = {
  google: "Google brand assets",
  x: "Simple Icons 16.30.0, stroked",
  linkedin: "Simple Icons 13.21.0",
  facebook: "Simple Icons 16.30.0",
  instagram: "Simple Icons 16.30.0",
  youtube: "Simple Icons 16.30.0",
  reddit: "Simple Icons 16.30.0, uncased",
  producthunt: "Simple Icons 16.30.0, uncased",
  github: "Octicons 19.15.1, masked",
  tiktok: "Simple Icons 16.30.0",
};

const note: Record<SourcePlatform, string> = {
  google: "The official multicolour G. The one mark that was already right.",
  x: "The official X, stroked 0.7 wider: their mark is thin and went weightless beside nine solid ones. Any bolder and the slivers between the arms close up.",
  linkedin:
    "The official in bug. LinkedIn had it pulled from the public set, so this is the last published file: swap it for the download from brand.linkedin.com.",
  facebook:
    "The official f knocked out of Meta\u2019s blue disc, and their current blue: #0866ff replaces the #1877f2 we carried.",
  instagram:
    "The official camera glyph, kept simple and monochrome in Instagram\u2019s current pink: #ff0069 replaces the #e4405f we carried.",
  youtube:
    "The official play badge: a wider rounded rectangle, triangle on the optical centre.",
  reddit: "The official Snoo, lifted out of the speech bubble it is drawn in.",
  producthunt: "The official P, lifted out of its disc.",
  github:
    "GitHub draws its cat as negative space inside a disc. Masking that mark with its own disc leaves that cat alone, with no line redrawn.",
  tiktok:
    "The official note in black. The cyan-and-pink logo is brand artwork, not three copies nudged apart.",
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

/** The retired glyph, with the stroke attributes it shipped with. */
function PreviousGlyph({
  chip,
  platform,
  size,
}: {
  chip: boolean;
  platform: SourcePlatform;
  size: number;
}) {
  const retired = previous[platform];
  if (!retired) return null;
  const chipStyle = chip
    ? ";background:white;border-radius:4px;padding:3px;box-sizing:content-box"
    : "";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      dangerouslySetInnerHTML={{
        __html: `<svg aria-hidden="true" style="color:${retired.color}${chipStyle}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${retired.markup}</svg>`,
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
          Every glyph here is the exact markup the card and the embed render.
          Each tile holds the redraw we shipped against the official mark that
          replaces it, then both at the size the wall serves.
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
          Ten filled marks now carry one optical weight. The chip is still
          hardcoded white, so on a dark wall each badge is a white square.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sourcePlatforms.map((platform) => {
          const { color, label } = sourceIcons[platform];
          const retired = previous[platform];
          return (
            <div
              className="bg-card space-y-3 rounded-lg border p-4"
              key={platform}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="type-ui truncate">{label}</p>
                <p className="text-muted-foreground type-small shrink-0 font-mono">
                  {platform}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <figure className="space-y-2">
                  <div className="bg-surface-2 grid h-24 place-items-center rounded-md border">
                    {retired ? (
                      <PreviousGlyph
                        chip={false}
                        platform={platform}
                        size={56}
                      />
                    ) : (
                      <span className="text-muted-foreground type-small">
                        Unchanged
                      </span>
                    )}
                  </div>
                  <figcaption className="text-muted-foreground type-small">
                    {retired ? "Redraw, retired" : "Nothing to replace"}
                  </figcaption>
                </figure>
                <figure className="space-y-2">
                  <div className="bg-surface-2 border-brand grid h-24 place-items-center rounded-md border-2">
                    <Glyph chip={false} platform={platform} size={56} />
                  </div>
                  <figcaption className="type-small">Official mark</figcaption>
                </figure>
              </div>

              <div className="flex items-center justify-center gap-3 rounded-md border bg-white py-2">
                {retired ? (
                  <>
                    <PreviousGlyph chip platform={platform} size={pixels} />
                    <span
                      aria-hidden="true"
                      className="type-small"
                      style={{ color: "#a8a29e" }}
                    >
                      &rarr;
                    </span>
                  </>
                ) : null}
                <Glyph chip platform={platform} size={pixels} />
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
                <span className="text-muted-foreground type-small">
                  &middot; {origin[platform]}
                </span>
              </div>
              <p className="text-muted-foreground type-small">
                {note[platform]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
