import Link from "next/link";

import { Blob } from "@/components/brand/blob";
import { MarkerHighlight } from "@/components/doodles";
import { publicTemplates } from "@/lib/templates-catalog";

import { PublicSiteFooter, PublicSiteHeader } from "./public-site-chrome";
import { TemplatesGallery } from "./templates-gallery";

/**
 * The public templates page at `/templates`: the title and one sentence,
 * the template browser right under them so the first preview shows without
 * scrolling, and one closing call to action on ink with the mascot. The
 * header already carries sign in and the primary action.
 */
export function TemplatesPage() {
  return (
    <div className="bg-paper text-ink min-h-svh">
      <PublicSiteHeader />
      <main>
        <section
          aria-labelledby="templates-title"
          className="mx-auto max-w-[1280px] px-5 pt-8 pb-8 sm:px-8 lg:pt-10"
        >
          <div className="max-w-3xl space-y-3">
            <h1
              className="type-display-xl text-balance lg:text-[3.25rem] lg:leading-[1.05]"
              id="templates-title"
            >
              Proof, laid out{" "}
              <span className="relative inline-block whitespace-nowrap">
                <MarkerHighlight
                  className="absolute inset-x-[-0.12em] bottom-[0.02em] h-[0.78em] w-[calc(100%+0.24em)]"
                  draw
                />
                <span className="relative">your way</span>
              </span>
            </h1>
            <p className="type-body text-ink-2 sm:text-[17px] sm:leading-7">
              {publicTemplates.length} layouts for your Testimonials, from a
              full Wall to a single line. Try one in your color.
            </p>
          </div>
        </section>

        <section
          aria-label="Browse the templates"
          className="mx-auto max-w-[1280px] scroll-mt-20 px-5 pb-16 sm:px-8"
          id="gallery"
        >
          <TemplatesGallery mode="public" templates={publicTemplates} />
        </section>

        <section
          aria-labelledby="cta-title"
          className="mx-auto max-w-[1280px] px-5 pb-16 sm:px-8 lg:pb-24"
        >
          <div className="bg-ink text-paper relative overflow-hidden rounded-xl p-8 sm:p-12">
            <div className="relative z-10 max-w-xl space-y-4">
              <h2
                className="font-display text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-4xl"
                id="cta-title"
              >
                Collect first. Choose the layout after.
              </h2>
              <p className="text-paper/80 text-base leading-7 sm:text-lg">
                Start on the Free plan, collect text and video, then pick any
                template above. Change your mind anytime: the proof stays.
              </p>
              <div className="pt-2">
                <Link
                  className="bg-brand text-brand-ink hover:bg-brand-strong focus-visible:outline-brand inline-flex h-11 items-center justify-center rounded-md px-6 text-[15px] font-semibold transition-[background-color,translate] duration-150 outline-none focus-visible:outline-3 focus-visible:outline-offset-3 active:translate-y-px motion-reduce:transition-none"
                  href="/sign-up"
                >
                  Create your Brand
                </Link>
              </div>
            </div>
            {/* The mascot, oversized on purpose: cropped by the panel on three
                sides and tilted to the left, the one place it breaks the 200px
                rule. Below 1280px it sits under the text, still cropped. */}
            <Blob
              className="absolute -top-6 -right-14 hidden -rotate-8 xl:block"
              expression="happy"
              size={420}
            />
            <div className="mt-2 -mr-16 -mb-16 flex justify-end xl:hidden">
              <Blob className="-rotate-8" expression="happy" size={280} />
            </div>
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
