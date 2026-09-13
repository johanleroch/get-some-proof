import {
  demoHomepageSelection,
  demoPricingSelection,
} from "@/lib/landing-demo";
import { defaultAccent } from "@/lib/templates-catalog";

import { DemoCardColumn, DemoCardMasonry } from "./demo-cards";
import {
  DemoFrame,
  LandingSection,
  SectionLead,
  SectionTitle,
} from "./landing-primitives";

/**
 * Two Widgets, two selections: the same workspace answering two different
 * questions. The panels are 7:5 rather than a pair of equal cards, and each
 * one says in a caption what its Owner chose — a selection and an order,
 * never automatic targeting.
 */
export function LandingSelection() {
  return (
    <LandingSection id="selection" labelledBy="selection-title">
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

      <div className="mt-12 grid items-start gap-6 lg:mt-14 lg:grid-cols-12 lg:gap-8">
        <DemoFrame
          caption="Three testimonials, in the order this Owner set."
          className="lg:col-span-7"
          label="Widget on the homepage"
        >
          <DemoCardMasonry
            accentColor={defaultAccent}
            testimonials={demoHomepageSelection}
          />
        </DemoFrame>

        <DemoFrame
          caption="A different selection on the pricing page, from the same workspace."
          className="lg:col-span-5"
          label="Widget on the pricing page"
        >
          <DemoCardColumn
            accentColor={defaultAccent}
            testimonials={demoPricingSelection}
          />
        </DemoFrame>
      </div>
    </LandingSection>
  );
}
