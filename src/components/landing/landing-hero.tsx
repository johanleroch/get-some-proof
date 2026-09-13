import Link from "next/link";

import { Button } from "@/components/ui/button";
import { demoBrandName, demoHeroTestimonials } from "@/lib/landing-demo";
import { defaultAccent } from "@/lib/templates-catalog";

import { DemoCardColumn } from "./demo-cards";
import { DemoFrame, Highlighted } from "./landing-primitives";

const [video, ...written] = demoHeroTestimonials;

/**
 * The hero leads with the result: the headline and one call to action on the
 * left, a real Widget on the right, so a visitor sees published proof before
 * reading how it is collected (issue #181). The proof panel starts above the
 * headline on wide screens and the columns are 5:7, never a centred stack.
 */
export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="pt-10 pb-[clamp(3rem,8vw,5rem)] sm:pt-14"
    >
      <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-14">
        <div className="min-w-0 lg:col-span-5 lg:pt-10">
          <h1
            className="font-display text-ink text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.06] font-bold tracking-[-0.02em] text-balance"
            id="hero-title"
          >
            Your <Highlighted>happy</Highlighted> customers can help win the
            next ones.
          </h1>
          <p className="type-body text-ink-2 mt-5 max-w-[46ch] sm:text-[17px] sm:leading-7">
            Give visitors a reason to trust your business. Collect text and
            video testimonials, then add them to your sales pages with one
            simple workflow, from collection to publication.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Start for free</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/#how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <DemoFrame
            caption={`A Widget on ${demoBrandName}'s website, published from the Studio.`}
            label={`${demoBrandName} · homepage`}
          >
            <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
              <DemoCardColumn
                accentColor={defaultAccent}
                className="order-2 sm:order-1"
                testimonials={video ? [video] : []}
              />
              <DemoCardColumn
                accentColor={defaultAccent}
                className="order-1 sm:order-2"
                testimonials={written}
              />
            </div>
          </DemoFrame>
        </div>
      </div>
    </section>
  );
}
