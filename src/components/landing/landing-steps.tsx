import { CircleAround } from "@/components/doodles";

import { LandingSection, SectionTitle } from "./landing-primitives";

const steps = [
  {
    body: "Invite customers to share their experience in text or video.",
    title: "Share your link",
  },
  {
    body: "Review incoming testimonials and select the ones you want to publish.",
    title: "Choose what goes live",
  },
  {
    body: "Create your Widget, customize it and embed it on your website.",
    title: "Add them to your pages",
  },
] as const;

/**
 * The journey in three steps, as rows rather than three equal cards
 * (DESIGN.md section 10): the count at `kpi` in the amber that reads on
 * paper, the verb at `heading`, the sentence at the end of the row. The ring
 * around "three" is this region's one hand-drawn element.
 */
export function LandingSteps() {
  return (
    <LandingSection id="how-it-works" labelledBy="steps-title" tone="quiet">
      <div className="lg:max-w-[42ch]">
        <SectionTitle id="steps-title" size="statement">
          From request to website in{" "}
          <span className="relative inline-block">
            <CircleAround className="absolute -inset-x-5 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+2.5rem)]" />
            <span className="relative">three</span>
          </span>{" "}
          steps.
        </SectionTitle>
      </div>

      <ol className="mt-12">
        {steps.map((step, index) => (
          <li
            className="border-line grid items-baseline gap-x-6 gap-y-2 border-t py-7 last:border-b md:grid-cols-12 md:py-9"
            key={step.title}
          >
            <span
              aria-hidden="true"
              className="font-display text-brand-text text-[2.5rem] leading-none font-bold tracking-[-0.02em] tabular-nums md:col-span-1"
            >
              {index + 1}
            </span>
            <h3 className="type-heading text-ink md:col-span-5">
              {step.title}
            </h3>
            <p className="type-body text-ink-2 max-w-[46ch] sm:text-[17px] sm:leading-7 md:col-span-6">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </LandingSection>
  );
}
