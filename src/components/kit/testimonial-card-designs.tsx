"use client";

import { useState } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";

import { Sparkle } from "@/components/doodles";
import { TemplateStage } from "@/components/templates/template-stage";
import { CardDesignRender } from "@/components/testimonials/designs/card-design-registry";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { type Segment, Segmented } from "@/components/ui/segmented";
import { cardDesignSamples } from "@/lib/card-design-samples";
import {
  type CardDesignDefinition,
  cardDesigns,
  shippedCardDesign,
} from "@/lib/card-designs-catalog";
import {
  accentPresets,
  defaultAccent,
  type WallTheme,
} from "@/lib/templates-catalog";

const themes: ReadonlyArray<Segment<WallTheme>> = [
  { icon: IconSun, key: "light", label: "Light" },
  { icon: IconMoon, key: "dark", label: "Dark" },
];

const textSamples = cardDesignSamples.filter(
  (sample) => sample.testimonial.type === "text",
);
const videoSample = cardDesignSamples.find(
  (sample) => sample.testimonial.type === "video",
);

/** A wall column at three columns on a laptop: the width a card is judged at. */
const columnWidth = "w-[340px] max-w-full";
/** Wide enough for the four text forms and their gaps to sit on one row. */
const pageWidth = "mx-auto max-w-[1560px]";

/**
 * Development review of the Testimonial card designs (DESIGN.md section 7).
 * Every design in `src/lib/card-designs-catalog.ts` is drawn against every
 * form a Customer can send, on the Brand accent and the Wall theme of your
 * choice. One design ships; the rest are drafts kept to be finished or
 * dropped.
 *
 * Video is one treatment shared by every design, so it is shown once at the
 * end rather than four identical times. When a design draws its own video
 * card, move the sample into the design rows.
 */
export function TestimonialCardDesigns() {
  const [accent, setAccent] = useState<string>(defaultAccent);
  const [theme, setTheme] = useState<WallTheme>("light");

  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div
          className={`${pageWidth} flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3`}
        >
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading flex items-center gap-2">
              Testimonial card
              <Sparkle className="text-brand size-5" />
            </h1>
            <p className="text-muted-foreground type-small">
              {cardDesigns.length} designs, each drawn against every form a
              Customer can send. Development only.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/kit">Kit</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/kit/templates">Templates</a>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className={`${pageWidth} space-y-14 px-6 py-10`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <dl className="type-small text-ink-2 flex max-w-3xl flex-wrap gap-x-6 gap-y-1">
            {cardDesignSamples.map((sample) => (
              <div className="flex gap-1.5" key={sample.key}>
                <dt className="text-ink font-semibold whitespace-nowrap">
                  {sample.label}
                </dt>
                <dd>{sample.note}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center">
              <span className="type-small text-ink-2 mr-1">Accent</span>
              <ColorPicker
                legend="Brand accent for the cards"
                onChange={setAccent}
                presets={accentPresets}
                value={accent}
              />
            </div>
            <Segmented
              label="Wall theme"
              onChange={setTheme}
              options={themes}
              value={theme}
            />
          </div>
        </div>

        {cardDesigns.map((design) => (
          <section className="space-y-4" key={design.slug}>
            <DesignHeading design={design} />
            <TemplateStage
              accentColor={accent}
              className="rounded-lg border"
              theme={theme}
            >
              <div className="flex flex-wrap items-start gap-5">
                {textSamples.map((sample) => (
                  <div className={columnWidth} key={sample.key}>
                    <p className="type-micro text-ink-2 mb-2 uppercase">
                      {sample.label}
                    </p>
                    <CardDesignRender
                      accentColor={accent}
                      slug={design.slug}
                      testimonial={sample.testimonial}
                    />
                  </div>
                ))}
              </div>
            </TemplateStage>
          </section>
        ))}

        {videoSample ? (
          <section className="space-y-4">
            <div className="max-w-prose space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="type-heading">Video card</h2>
                <Badge variant="brand">Shipped</Badge>
              </div>
              <p className="type-body text-ink-2">
                The poster fills the card, the identity sits on the shade, and
                the 48px play button loads the player only when a visitor
                reaches for it.
              </p>
              <p className="type-small text-ink-2">
                One treatment, shared by every design above, which is why it is
                drawn once. It follows the source ratio, so a phone recording
                stays portrait.
              </p>
            </div>
            <TemplateStage
              accentColor={accent}
              className="rounded-lg border"
              theme={theme}
            >
              <div className={columnWidth}>
                <CardDesignRender
                  accentColor={accent}
                  slug={shippedCardDesign.slug}
                  testimonial={videoSample.testimonial}
                />
              </div>
            </TemplateStage>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function DesignHeading({ design }: { design: CardDesignDefinition }) {
  const shipped = design.status === "shipped";
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2">
      <div className="max-w-prose min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="type-heading">{design.name}</h2>
          <Badge variant={shipped ? "brand" : "neutral"}>
            {shipped ? "Shipped" : "Draft"}
          </Badge>
        </div>
        <p className="type-body text-ink-2">{design.description}</p>
        <p className="type-small text-ink-2">{design.note}</p>
      </div>
      <p className="text-ink-3 shrink-0 font-mono text-[12px]">{design.file}</p>
    </div>
  );
}
