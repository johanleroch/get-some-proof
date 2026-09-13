import { ArrowNote } from "@/components/doodles";
import { CollectionFormPreview } from "@/components/organizations/collection-form-preview";
import { demoBrandName } from "@/lib/landing-demo";
import { defaultAccent } from "@/lib/templates-catalog";

import {
  LandingSection,
  SectionLead,
  SectionTitle,
} from "./landing-primitives";

/**
 * Collection, shown as the Submitter sees it: the real first step of the
 * Collection Form, with the two formats and the drawings that belong to that
 * screen. The visual leads here and the words follow, the reverse of the
 * section above it, so the page alternates instead of settling into one
 * split repeated down the page.
 */
export function LandingCollection() {
  return (
    <LandingSection id="collect" labelledBy="collection-title">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="min-w-0 lg:col-span-6">
          <div className="mx-auto max-w-[440px]">
            <CollectionFormPreview
              accentColor={defaultAccent}
              description="Tell us what changed for you."
              logoUrl={null}
              name={demoBrandName}
              title={`Share your ${demoBrandName} story`}
            />
            <ArrowNote arrow="rise" className="mt-5" size="sm">
              what your customers open
            </ArrowNote>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-5 lg:col-start-8">
          <SectionTitle id="collection-title">
            Make it easy for customers to share their experience.
          </SectionTitle>
          <div className="mt-6 space-y-4">
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
          <p className="border-line type-small text-ink-2 mt-8 border-t pt-5 font-mono">
            getsomeproof.com/c/fernhill-studio
          </p>
        </div>
      </div>
    </LandingSection>
  );
}
