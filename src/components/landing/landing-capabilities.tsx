import {
  IconEyeCheck,
  IconFolders,
  IconPalette,
  IconWorldShare,
} from "@tabler/icons-react";

import { LandingSection, SectionTitle } from "./landing-primitives";

const capabilities = [
  {
    body: "New testimonials stay private until you choose to publish them.",
    icon: IconEyeCheck,
    title: "Review before publishing.",
  },
  {
    body: "Bring your published testimonials together on a hosted Wall you can share with a link.",
    icon: IconWorldShare,
    title: "Share a public page.",
  },
  {
    body: "Adjust your Widgets’ appearance and the order of their testimonials.",
    icon: IconPalette,
    title: "Make it your own.",
  },
  {
    body: "Organize testimonials for different products or businesses in their own Projects.",
    icon: IconFolders,
    title: "Keep projects separate.",
  },
] as const;

/**
 * The supporting capabilities as a list with hairlines, beside a heading
 * that holds its own column: four rows in two columns, never a row of equal
 * cards wearing coloured icon tiles.
 */
export function LandingCapabilities() {
  return (
    <LandingSection id="control" labelledBy="capabilities-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 lg:col-span-4">
          <SectionTitle className="lg:sticky lg:top-24" id="capabilities-title">
            Stay in control of your testimonials.
          </SectionTitle>
        </div>
        <div className="grid min-w-0 gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          {capabilities.map(({ body, icon: Icon, title }) => (
            <div className="border-line border-t pt-5" key={title}>
              <Icon aria-hidden="true" className="text-ink size-5" />
              <h3 className="type-subheading text-ink mt-3">{title}</h3>
              <p className="type-body text-ink-2 mt-1.5 max-w-[42ch]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
