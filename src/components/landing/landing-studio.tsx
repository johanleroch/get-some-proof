"use client";

import { useId, useState } from "react";

import { widgetTemplates } from "@/components/studio/catalog";
import type { WidgetPresentation } from "@/components/studio/widget-payload";
import { WidgetPreview } from "@/components/studio/widget-preview";
import { ArrowNote } from "@/components/doodles";
import { ColorPicker } from "@/components/ui/color-picker";
import { EmbedCode } from "@/components/ui/embed-code";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WidgetConfig } from "@convex/domain/widgets";
import {
  demoBrandName,
  demoEmbedSnippet,
  demoStudioTestimonials,
  demoWidgetConfig,
} from "@/lib/landing-demo";
import { accentPresets } from "@/lib/templates-catalog";

import {
  DemoFrame,
  LandingSection,
  SectionLead,
  SectionTitle,
} from "./landing-primitives";

/**
 * The three templates this demonstration can offer honestly: Testimonial
 * highlights needs marked phrases and Avatar stack needs customer photos,
 * and the sample set has neither. The Studio offers all five, and names the
 * Pro ones exactly as they are named here.
 */
const demoLayouts: WidgetConfig["layout"][] = [
  "masonry",
  "carousel",
  "individual",
];

const templateOptions = demoLayouts.map((layout) => {
  const template = widgetTemplates.find((item) => item.layout === layout)!;
  return {
    label: `${template.title}${layout === "masonry" ? "" : " · Pro"}`,
    layout,
  };
});

/**
 * Presentation and installation, played on the real thing: the controls are
 * the Studio's own primitives, with its own template names, and the preview
 * is the embed runtime a customer site loads, rendering in its own shadow
 * root. Changing a template or an accent here does what it does in the
 * Studio; nothing is published from this page.
 */
export function LandingStudio() {
  const [layout, setLayout] = useState<WidgetConfig["layout"]>("masonry");
  const [accentColor, setAccentColor] = useState(demoWidgetConfig.accentColor);
  const accentLabelId = useId();
  const snippetId = useId();
  const templateId = useId();

  // The Studio refuses to publish an Individual testimonial Widget with
  // anything but one Testimonial selected, so the demonstration selects one
  // too rather than showing a state an Owner could not save.
  const testimonials =
    layout === "individual"
      ? demoStudioTestimonials.slice(0, 1)
      : demoStudioTestimonials;
  const presentation: WidgetPresentation = {
    attributionRequired: false,
    brandName: demoBrandName,
    config: { ...demoWidgetConfig, accentColor, layout },
    testimonials,
  };

  return (
    <LandingSection id="publish" labelledBy="studio-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <SectionTitle id="studio-title">
              Give customer proof a place on your website.
            </SectionTitle>
            <div className="mt-5 space-y-4">
              <SectionLead>
                Choose a template, match its appearance to your brand and add
                the embed code to your page.
              </SectionLead>
              <SectionLead>
                Then manage your Widget&rsquo;s selection and publish changes
                from the Studio.
              </SectionLead>
            </div>

            <div className="border-line mt-8 space-y-5 border-t pt-6">
              <div className="space-y-2">
                <Label htmlFor={templateId}>Template</Label>
                <Select
                  onValueChange={(value) =>
                    setLayout(value as WidgetConfig["layout"])
                  }
                  value={layout}
                >
                  <SelectTrigger className="w-full" id={templateId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateOptions.map((option) => (
                      <SelectItem key={option.layout} value={option.layout}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <Label id={accentLabelId}>Accent</Label>
                <div className="flex min-w-0 items-center gap-2">
                  <ColorPicker
                    labelledBy={accentLabelId}
                    legend="Accent"
                    onChange={setAccentColor}
                    presets={accentPresets}
                    value={accentColor}
                  />
                  <span className="text-ink-2 hidden font-mono text-xs sm:inline">
                    {accentColor}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={snippetId}>Embed code</Label>
                <EmbedCode code={demoEmbedSnippet()} id={snippetId} />
                <ArrowNote arrow="rise" size="sm">
                  paste this on your site
                </ArrowNote>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-8">
          <DemoFrame
            caption="The embed runtime a website loads, rendering this Widget in its own frame."
            contentClassName="min-h-[420px] sm:min-h-[460px]"
            label="Your website"
          >
            <WidgetPreview value={presentation} />
          </DemoFrame>
        </div>
      </div>
    </LandingSection>
  );
}
