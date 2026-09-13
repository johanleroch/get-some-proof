import Link from "next/link";

import { ArrowNote } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { demoHeroTestimonials } from "@/lib/landing-demo";
import { defaultAccent } from "@/lib/templates-catalog";

import { DemoCardColumn } from "./demo-cards";
import { Highlighted, PageTitle } from "./landing-primitives";

const [video, ...written] = demoHeroTestimonials;

/**
 * The hero leads with the result: the words on the left, published proof on
 * the right — the real Testimonial cards, on the paper, laid out as a Wall
 * is, with no frame drawn around them. The two columns of the Wall are
 * offset so it reads as a wall rather than a widget in a box, and the
 * handwritten note says what it is.
 */
export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="pt-12 pb-[clamp(3rem,8vw,5rem)] sm:pt-16"
    >
      <div className="mx-auto grid w-full max-w-[1280px] gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-16">
        <div className="min-w-0 lg:col-span-5">
          <PageTitle id="hero-title">
            Your <Highlighted>happy</Highlighted> customers can help win the
            next ones.
          </PageTitle>
          <p className="type-body text-ink-2 mt-6 max-w-[44ch] sm:text-[17px] sm:leading-7">
            Give visitors a reason to trust your business. Collect text and
            video testimonials, then add them to your sales pages with one
            simple workflow, from collection to publication.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Start for free</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/#how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
            <DemoCardColumn
              accentColor={defaultAccent}
              testimonials={written}
            />
            <DemoCardColumn
              accentColor={defaultAccent}
              className="sm:mt-14"
              testimonials={video ? [video] : []}
            />
          </div>
          <ArrowNote arrow="rise" className="mt-6">
            demo wall, nobody real yet
          </ArrowNote>
        </div>
      </div>
    </section>
  );
}
