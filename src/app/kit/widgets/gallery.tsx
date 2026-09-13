"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WidgetConfig } from "@convex/domain/widgets";
import { Segmented } from "@/components/ui/segmented";
import {
  widgetPayload,
  type WidgetPayload,
  type WidgetPresentation,
} from "@/components/studio/widget-payload";
import { galleryTestimonials } from "./fixtures";

/**
 * The widget families, side by side, in both hands. A review page: it exists
 * to decide which families ship, so it renders them through the real embed
 * runtime rather than a React lookalike. What is on this page is exactly what
 * a Customer's visitor would get.
 */

type Hand = "clean" | "drawn";
/** The third axis: stars, quote and signature move together. */
type Align = "left" | "center" | "right";
/** "both" is not a hand: it puts the two side by side so the gap is visible. */
type HandChoice = Hand | "both";

type Family = {
  /** Unique on this page: a family can share a layout with another entry. */
  key: string;
  /** `data-layout` the runtime reads. */
  layout: string;
  /** The entrance is orthogonal to the layout, like the hand. */
  entrance?: "stagger";
  /** The poster quote alone takes one; the three variants are the family. */
  align?: Align;
  /**
   * The shipped layout the payload is serialised as. Chips need the excerpt
   * pass the highlights layout triggers; everything else keeps its own shape.
   */
  base?: WidgetConfig["layout"];
  title: string;
  note: string;
  /** How much of the review set this family is given. */
  take?: number;
  frame?: "wide" | "narrow" | "page";
  shipped?: boolean;
};

const groups: { title: string; blurb: string; families: Family[] }[] = [
  {
    title: "A. Section blocks",
    blurb: "These take a whole section of the page.",
    families: [
      {
        key: "masonry",
        layout: "masonry",
        title: "Column wall",
        note: "Text and video in their natural shape.",
        shipped: true,
      },
      {
        key: "carousel",
        layout: "carousel",
        title: "Carousel",
        note: "One swipe at a time.",
        shipped: true,
      },
      {
        key: "editorial",
        layout: "editorial",
        title: "Editorial list",
        note: "One narrow column, rules instead of cards. Reads like an article.",
        take: 5,
      },
      {
        key: "mosaic",
        layout: "mosaic",
        title: "Mosaic",
        note: "A dense grid where sizes alternate, so it never falls into three equal tiles.",
      },
      {
        key: "videos",
        layout: "videos",
        title: "Video gallery",
        note: "Posters first, each video at the shape it was filmed, plays in place.",
      },
      {
        key: "blocks",
        layout: "blocks",
        title: "Blocks",
        note: "Edge to edge, no gutter, no radius, the tone alternating paper, ink and accent. The competitor does this in neon on black. The one family the hand leaves alone: a block with wobbly corners is not a block.",
        take: 6,
      },
      {
        key: "faces",
        layout: "faces",
        title: "Face wall",
        note: "The grid of customers is the navigation: touch a face, read what they said.",
      },
      {
        key: "masonry-stagger",
        layout: "masonry",
        entrance: "stagger",
        title: "Wall that fills in",
        note: "The same wall, arriving as the visitor reaches it. The entrance is an option, not a family: any of these can wear it.",
        take: 6,
      },
    ],
  },
  {
    title: "B. Supporting proof",
    blurb: "Small. Sits beside a button or a price.",
    families: [
      {
        key: "individual",
        layout: "individual",
        title: "Single testimonial",
        note: "One voice, right where it matters.",
        take: 1,
        frame: "narrow",
        shipped: true,
      },
      {
        key: "avatars",
        layout: "avatars",
        title: "Row of faces",
        note: "A familiar row beside a call to action.",
        frame: "narrow",
        shipped: true,
      },
      {
        key: "rating",
        layout: "rating",
        title: "Rating badge",
        note: "The average, the stars, the count. The drawn hand circles the score.",
        frame: "narrow",
      },
      {
        key: "metric",
        layout: "metric",
        title: "Key figure",
        note: "The number, then the faces behind it and the average. A figure on its own is an assertion; the row under it is the evidence.",
        frame: "narrow",
      },
      {
        key: "hero-center",
        layout: "hero",
        align: "center",
        title: "Poster quote, centred",
        note: "One quote at the scale of a headline. At this size the marker swash is the design. Stars, quote and signature align as one.",
        take: 1,
      },
      {
        key: "hero-left",
        layout: "hero",
        align: "left",
        title: "Poster quote, ranged left",
        note: "The same quote against a left margin, for a page built on a column.",
        take: 1,
      },
      {
        key: "hero-right",
        layout: "hero",
        align: "right",
        title: "Poster quote, ranged right",
        note: "The mirror, for a quote that sits beside something on its left.",
        take: 1,
      },
      {
        key: "band",
        layout: "band",
        title: "Band",
        note: "The photo runs the full height on the left, the quote reads on the right. Written testimonials only: a video has no words to set beside the face.",
        take: 3,
      },
      {
        key: "highlights",
        layout: "highlights",
        title: "Marked passages",
        note: "Only the words the Owner marked.",
        take: 4,
        shipped: true,
      },
    ],
  },
  {
    title: "C. Proof that moves",
    blurb: "Little room, catches the eye.",
    families: [
      {
        key: "marquee",
        layout: "marquee",
        title: "Scrolling band",
        note: "One continuous row, seamless, pauses on hover. Written testimonials only: a band that never stops has nothing to press.",
      },
      {
        key: "chips",
        layout: "chips",
        base: "highlights",
        title: "Chips",
        note: "The marked words alone, as pills, on two rows that pass each other.",
      },
      {
        key: "spotlight",
        layout: "spotlight",
        title: "Living wall",
        note: "One card, the testimonials take turns in a cross-fade. The turn waits while a video is playing.",
        frame: "narrow",
      },
      {
        key: "bubble",
        layout: "bubble",
        title: "Floating bubble",
        note: "The corner of the page, after a beat. Shown here inside a frame.",
        frame: "page",
        take: 3,
      },
    ],
  },
  {
    title: "D. Where it came from",
    blurb: "The origin is the argument.",
    families: [
      {
        key: "social",
        layout: "social",
        title: "Social feed",
        note: "The platform mark leads the card instead of trailing it.",
        take: 6,
      },
    ],
  },
];

const shippedLayouts = new Set<WidgetConfig["layout"]>([
  "wall",
  "individual",
  "carousel",
  "masonry",
  "highlights",
  "avatars",
]);

let loading: Promise<void> | undefined;
function loadRuntime() {
  if (window.__getSomeProofEmbedV2) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/embed/v2.js";
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      script.remove();
      reject(new Error("Preview unavailable"));
    };
    document.head.append(script);
  });
  return loading;
}

function GalleryWidget({
  accentColor,
  align,
  family,
  hand,
}: {
  accentColor: string;
  align?: Align;
  family: Family;
  hand: Hand;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    /* The payload is built through the real serializer, then the layout is
       widened: the new families are not in the Convex validator yet, and this
       page is what decides whether they ever will be. */
    const layout = family.layout as WidgetConfig["layout"];
    const value: WidgetPresentation = {
      config: {
        accentColor,
        backgroundColor: "#ffffff",
        font: "inherit",
        layout:
          family.base ?? (shippedLayouts.has(layout) ? layout : "masonry"),
        textColor: "#2e2a25",
      },
      brandName: "Fernhill Studio",
      attributionRequired: false,
      testimonials: galleryTestimonials.slice(0, family.take ?? 9),
    };
    const base = widgetPayload(value);
    const payload = {
      ...base,
      /* A widget on someone else's page should not paint a white box behind
         itself; the review page judges the widget, not its container. */
      brand: { ...base.brand, transparentEmbed: true },
      config: {
        ...value.config,
        ...(align ? { align } : {}),
        entrance: family.entrance,
        hand,
        layout: family.layout,
      },
      inlineOverlay: family.frame === "page",
    };
    void loadRuntime().then(() => {
      if (!cancelled && host.current)
        /* The widened layout is the whole point of this page: the runtime
           reads `data-layout` as a string, the validator has not caught up. */
        window.__getSomeProofEmbedV2?.renderWidget(
          host.current,
          payload as unknown as WidgetPayload,
        );
    });
    return () => {
      cancelled = true;
    };
  }, [accentColor, align, family, hand]);
  return <div ref={host} />;
}

function Frame({ family, children }: { family: Family; children: ReactNode }) {
  if (family.frame === "page")
    return (
      <div className="border-line bg-surface-2 relative h-[420px] overflow-hidden rounded-lg border">
        <div className="space-y-3 p-6 opacity-40">
          <div className="bg-line h-6 w-40 rounded" />
          <div className="bg-line h-3 w-full rounded" />
          <div className="bg-line h-3 w-4/5 rounded" />
          <div className="bg-line h-3 w-2/3 rounded" />
        </div>
        {children}
      </div>
    );
  return (
    <div className={family.frame === "narrow" ? "max-w-lg" : undefined}>
      {children}
    </div>
  );
}

export function WidgetGallery() {
  const [hand, setHand] = useState<HandChoice>("clean");
  const [accentColor, setAccentColor] = useState("#ffbb16");
  return (
    <div className="bg-paper min-h-svh">
      <header className="border-line bg-paper/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-5">
          <div>
            <h1 className="font-display text-ink text-[28px] leading-tight font-semibold tracking-[-0.02em]">
              Widget families
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Every family through the real embed runtime. 20 of them, two
              hands.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
              Brand accent
              <input
                aria-label="Brand accent"
                className="border-line size-9 cursor-pointer rounded-md border bg-transparent"
                onChange={(event) => setAccentColor(event.target.value)}
                type="color"
                value={accentColor}
              />
            </label>
            <Segmented
              label="Hand"
              onChange={setHand}
              options={[
                { key: "clean", label: "Clean" },
                { key: "drawn", label: "Drawn" },
                { key: "both", label: "Side by side" },
              ]}
              value={hand}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-12 px-8 py-12">
        {groups.map((group) => (
          <section key={group.title} className="space-y-6">
            <div>
              <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.015em]">
                {group.title}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {group.blurb}
              </p>
            </div>
            <div className="space-y-8">
              {group.families.map((family) => (
                <article
                  key={family.key}
                  className="border-line bg-paper rounded-lg border p-6"
                >
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <h3 className="text-ink text-[15px] font-semibold">
                        {family.title}
                        {family.shipped ? null : (
                          <span className="bg-brand-soft text-brand-text ml-2 rounded-sm px-1.5 py-0.5 align-middle text-[11px] font-medium">
                            new
                          </span>
                        )}
                      </h3>
                      <p className="text-muted-foreground mt-1 text-[13px]">
                        {family.note}
                      </p>
                    </div>
                    <code className="text-muted-foreground text-[11px]">
                      {family.entrance
                        ? `${family.layout} + ${family.entrance}`
                        : family.layout}
                    </code>
                  </div>
                  {hand === "both" ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {(["clean", "drawn"] as const).map((side) => (
                        <div key={side} className="min-w-0">
                          <p className="text-muted-foreground mb-3 text-[11px] tracking-[0.08em] uppercase">
                            {side === "clean" ? "Clean" : "Drawn"}
                          </p>
                          <Frame family={family}>
                            <GalleryWidget
                              accentColor={accentColor}
                              align={family.align}
                              family={family}
                              hand={side}
                            />
                          </Frame>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Frame family={family}>
                      <GalleryWidget
                        accentColor={accentColor}
                        align={family.align}
                        family={family}
                        hand={hand}
                      />
                    </Frame>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
