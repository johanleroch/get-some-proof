import {
  IconCode,
  IconMessage2,
  IconPaperclip,
  IconVideo,
} from "@tabler/icons-react";

import { ArrowNote } from "@/components/doodles";
import { productName } from "@/lib/brand";

import {
  LandingSection,
  SectionLead,
  SectionTitle,
} from "./landing-primitives";

/** The four chores the sentence on the left describes, drawn as a chain. */
const chores = [
  { icon: IconMessage2, label: "Ask for a testimonial" },
  { icon: IconVideo, label: "Explain how to record a video" },
  { icon: IconPaperclip, label: "Chase down the file" },
  { icon: IconCode, label: "Work out how to publish it" },
];

/**
 * The friction, on the quiet band: the words on the left, the same four
 * chores on the right as a chain whose last link goes nowhere. The
 * handwritten note is this region's one hand-drawn element.
 */
export function LandingProblem() {
  return (
    <LandingSection id="why" labelledBy="problem-title" tone="quiet">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-14">
        <div className="min-w-0 lg:col-span-6">
          <SectionTitle id="problem-title">
            A happy customer. Now what?
          </SectionTitle>
          <div className="mt-5 space-y-4">
            <SectionLead>
              You ask for a testimonial. Explain how to record a video. Chase
              down the file. Then figure out how to get it onto your website.
            </SectionLead>
            <SectionLead>
              Meanwhile, visitors are weighing up your offer without hearing
              from the people who have already chosen you.
            </SectionLead>
          </div>
          <p className="border-line type-subheading text-ink mt-8 max-w-[46ch] border-t pt-6">
            {productName} brings testimonial collection, selection and
            publishing into one place.
          </p>
        </div>

        <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:pt-2">
          <ol className="space-y-5">
            {chores.map(({ icon: Icon, label }, index) => (
              <li className="relative flex items-center gap-4" key={label}>
                {index < chores.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="bg-line absolute top-9 left-[17px] h-5 w-px"
                  />
                ) : null}
                <span className="border-line bg-surface text-ink-2 grid size-9 shrink-0 place-items-center rounded-full border">
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <span className="type-ui text-ink-2">{label}</span>
              </li>
            ))}
          </ol>
          <span
            aria-hidden="true"
            className="border-line mt-1 ml-[17px] block h-8 border-l border-dashed"
          />
          <ArrowNote arrow="rise" className="mt-1 ml-2">
            still nothing on your site
          </ArrowNote>
        </div>
      </div>
    </LandingSection>
  );
}
