import Link from "next/link";

import { Blob } from "@/components/brand/blob";
import { Button } from "@/components/ui/button";

/**
 * The closing panel: the same ink poster the templates page ends on, so our
 * two public pages close the same way, with the starstruck face the other
 * posters wear (the sidebar plan card, the Pro offer). The mascot is
 * oversized and cropped by the panel, the founder's exception to the
 * 96–200px range (DESIGN.md section 4).
 */
export function LandingCta() {
  return (
    <section
      aria-labelledby="closing-title"
      className="mx-auto w-full max-w-[1280px] px-5 pt-[clamp(1rem,4vw,2rem)] pb-[clamp(3rem,8vw,6rem)] sm:px-8"
    >
      <div className="bg-ink text-paper relative overflow-hidden rounded-xl p-8 sm:p-12">
        <div className="relative z-10 max-w-xl space-y-4">
          <h2
            className="font-display text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.12] font-bold tracking-[-0.02em] text-balance"
            id="closing-title"
          >
            Let the people who chose you have their say.
          </h2>
          <p className="text-paper/80 text-base leading-7 sm:text-[17px]">
            Create your collection link and start gathering the testimonials
            your next customers can read and watch.
          </p>
          <div className="pt-2">
            <Button asChild size="lg">
              <Link href="/sign-up">Start for free</Link>
            </Button>
          </div>
        </div>
        <Blob
          className="absolute -top-6 -right-14 hidden -rotate-8 xl:block"
          expression="starstruck"
          size={420}
        />
        <div className="mt-2 -mr-16 -mb-16 flex justify-end xl:hidden">
          <Blob className="-rotate-8" expression="starstruck" size={280} />
        </div>
      </div>
    </section>
  );
}
