import { ArrowNote } from "@/components/doodles";
import {
  demoHomepageSelection,
  demoPricingSelection,
} from "@/lib/landing-demo";
import { defaultAccent } from "@/lib/templates-catalog";

import { DemoCardColumn, DemoCardMasonry } from "./demo-cards";
import {
  DemoLine,
  Eyebrow,
  LandingSection,
  SectionLead,
  SectionTitle,
} from "./landing-primitives";

/**
 * Two Widgets, two selections, on two pages of the same site. The panels are
 * 7:5 and the second one starts lower, so they read as two places rather
 * than a pair of matching cards; each one says what its Owner chose, and
 * neither implies the product picks for them.
 */
export function LandingSelection() {
  return (
    <LandingSection id="selection" labelledBy="selection-title" tone="quiet">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 lg:col-span-5">
          <SectionTitle id="selection-title">
            Answer their doubts with your customers&rsquo; words.
          </SectionTitle>
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-6 lg:col-start-7 lg:pt-1">
          <SectionLead>
            One visitor wants to know whether your offer fits their needs.
            Another wants to understand what it changes in practice.
          </SectionLead>
          <SectionLead>
            Choose the testimonials that belong on each page and arrange them in
            the order you want. Each Widget has its own selection, so your
            homepage, product pages and sales pages can highlight different
            customer experiences.
          </SectionLead>
        </div>
      </div>

      <div className="mt-14 grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 lg:col-span-7">
          <Eyebrow className="mb-4">On the homepage</Eyebrow>
          <DemoCardMasonry
            accentColor={defaultAccent}
            testimonials={demoHomepageSelection}
          />
          <p className="type-small text-ink-2 mt-1">
            Three testimonials, in the order this Owner set.
          </p>
        </div>

        <div className="min-w-0 lg:col-span-5 lg:mt-16">
          <Eyebrow className="mb-4">On the pricing page</Eyebrow>
          <DemoCardColumn
            accentColor={defaultAccent}
            testimonials={demoPricingSelection}
          />
          <p className="type-small text-ink-2 mt-4">
            Two others, chosen from the same workspace.
          </p>
          <ArrowNote arrow="rise" className="mt-4" size="sm">
            a different pick here
          </ArrowNote>
        </div>
      </div>

      <DemoLine className="mt-10">
        Fernhill Studio and every testimonial on this page are invented.
      </DemoLine>
    </LandingSection>
  );
}
