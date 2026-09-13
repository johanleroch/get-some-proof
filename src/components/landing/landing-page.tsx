import type { Route } from "next";

import {
  PublicSiteFooter,
  PublicSiteHeader,
} from "@/components/templates/public-site-chrome";
import { demoDisclosure } from "@/lib/landing-demo";

import { LandingCapabilities } from "./landing-capabilities";
import { LandingCollection } from "./landing-collection";
import { LandingCta } from "./landing-cta";
import { LandingFaq } from "./landing-faq";
import { LandingHero } from "./landing-hero";
import { LandingProblem } from "./landing-problem";
import { LandingSelection } from "./landing-selection";
import { LandingSteps } from "./landing-steps";
import { LandingStudio } from "./landing-studio";

const headerLinks: ReadonlyArray<{ href: Route; label: string }> = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/templates", label: "Templates" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * The public landing page (issue #181). It shows the result first — a real
 * Widget of published proof — then the friction, then how proof is
 * collected, chosen and published, and closes on the one call to action the
 * page repeats: Start for free. Every demonstration is fictional and says
 * so, here and on each frame.
 */
export function LandingPage() {
  return (
    <div className="bg-paper text-ink min-h-svh">
      <PublicSiteHeader links={headerLinks} />
      <main>
        <LandingHero />
        <LandingProblem />
        <LandingCollection />
        <LandingSelection />
        <LandingStudio />
        <LandingSteps />
        <LandingCapabilities />
        <LandingFaq />
        <LandingCta />
        <p className="type-small text-ink-2 mx-auto max-w-[1280px] px-5 pb-10 sm:px-8">
          {demoDisclosure}
        </p>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
