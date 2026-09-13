import { CollectionFormPreview } from "@/components/organizations/collection-form-preview";
import { demoBrandName } from "@/lib/landing-demo";
import { defaultAccent } from "@/lib/templates-catalog";

import {
  DemoFrame,
  LandingSection,
  SectionLead,
  SectionTitle,
} from "./landing-primitives";

/**
 * Collection, shown with the real Collection Form: its first step, the two
 * formats with their drawings, exactly what a Submitter opens. The visual
 * leads on wide screens, the words follow: the section before it put them
 * the other way round, so the page alternates rather than settling into a
 * column of identical splits.
 */
export function LandingCollection() {
  return (
    <LandingSection id="collect" labelledBy="collection-title">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 lg:col-span-6">
          <DemoFrame
            caption="The first step of the Collection Form. Your customer opens it from one link."
            className="mx-auto max-w-[460px]"
            label={
              <span className="font-mono normal-case">/c/fernhill-studio</span>
            }
          >
            <CollectionFormPreview
              accentColor={defaultAccent}
              description="Tell us what changed for you."
              logoUrl={null}
              name={demoBrandName}
              title={`Share your ${demoBrandName} story`}
            />
          </DemoFrame>
        </div>

        <div className="min-w-0 lg:col-span-5 lg:col-start-8">
          <SectionTitle id="collection-title">
            Make it easy for customers to share their experience.
          </SectionTitle>
          <div className="mt-5 space-y-4">
            <SectionLead>
              Send your collection link. Your customer can write a testimonial,
              record a video or upload an existing file.{" "}
              <strong className="text-ink font-semibold">
                No account needed.
              </strong>
            </SectionLead>
            <SectionLead>
              They choose the format that works for them. You receive their
              testimonial in your workspace, ready to review.
            </SectionLead>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
