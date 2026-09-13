import { EnvelopeSent } from "@/components/doodles";
import { productName } from "@/lib/brand";

import {
  LandingSection,
  SectionLead,
  SectionTitle,
} from "./landing-primitives";

/**
 * The friction, said once and loudly: the statement cut of the title, the
 * two paragraphs side by side under it so the block reads as one column of
 * words, and the sentence that answers them at `heading`. The envelope on
 * its way is the region's one hand-drawn element — the testimonial that
 * left the customer and never reached the website.
 */
export function LandingProblem() {
  return (
    <LandingSection id="why" labelledBy="problem-title" tone="quiet">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-14">
        <div className="min-w-0 lg:col-span-7">
          <SectionTitle id="problem-title" size="statement">
            A happy customer. Now what?
          </SectionTitle>
          <div className="mt-7 grid gap-x-10 gap-y-4 md:grid-cols-2">
            <SectionLead>
              You ask for a testimonial. Explain how to record a video. Chase
              down the file. Then figure out how to get it onto your website.
            </SectionLead>
            <SectionLead>
              Meanwhile, visitors are weighing up your offer without hearing
              from the people who have already chosen you.
            </SectionLead>
          </div>
          <p className="border-line type-heading text-ink mt-10 max-w-[34ch] border-t pt-7">
            {productName} brings testimonial collection, selection and
            publishing into one place.
          </p>
        </div>

        <div className="hidden lg:col-span-4 lg:col-start-9 lg:grid lg:place-items-center">
          <EnvelopeSent className="text-ink h-52 w-auto" float />
        </div>
      </div>
    </LandingSection>
  );
}
