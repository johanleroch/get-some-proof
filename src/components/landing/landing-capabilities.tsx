import { WallFrames } from "@/components/doodles";

import { LandingSection, SectionTitle } from "./landing-primitives";

const capabilities = [
  {
    body: "New testimonials stay private until you choose to publish them.",
    title: "Review before publishing.",
  },
  {
    body: "Bring your published testimonials together on a hosted Wall you can share with a link.",
    title: "Share a public page.",
  },
  {
    body: "Adjust your Widgets’ appearance and the order of their testimonials.",
    title: "Make it your own.",
  },
  {
    body: "Organize testimonials for different products or businesses in their own Projects.",
    title: "Keep projects separate.",
  },
] as const;

/**
 * The page's one amber field, the poster the sidebar plan card and the Pro
 * offer are cut from: the promise on the left with the Wall drawing under
 * it, the four capabilities as rows with hairlines on the right. No icon
 * tiles, no four matching cards — the words carry it.
 */
export function LandingCapabilities() {
  return (
    <LandingSection id="control" labelledBy="capabilities-title" tone="poster">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-14">
        <div className="min-w-0 lg:col-span-4">
          <SectionTitle id="capabilities-title">
            Stay in control of your testimonials.
          </SectionTitle>
          <WallFrames className="text-ink mt-10 hidden h-44 w-auto lg:block" />
        </div>
        <dl className="min-w-0 lg:col-span-7 lg:col-start-6">
          {capabilities.map(({ body, title }) => (
            <div
              className="border-ink/12 grid gap-x-8 gap-y-1 border-t py-5 sm:grid-cols-5"
              key={title}
            >
              <dt className="type-subheading text-ink sm:col-span-2">
                {title}
              </dt>
              <dd className="type-body text-ink-2 max-w-[44ch] sm:col-span-3">
                {body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </LandingSection>
  );
}
