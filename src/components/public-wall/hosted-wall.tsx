import { Fragment, type CSSProperties } from "react";
import Link from "next/link";

import {
  TestimonialCard,
  type PublicTestimonial,
} from "@/components/testimonials/testimonial-card";
import { Button } from "@/components/ui/button";

export type PublicWallValue = {
  accentColor: string;
  attributionRequired: boolean;
  brandName: string;
  publicSlug: string;
  theme: "light" | "dark" | "system";
  testimonials: PublicTestimonial[];
  transparentEmbed: boolean;
};

function FreeWallPromotion() {
  return (
    <aside
      aria-label="Get Some Proof"
      className="mb-5 break-inside-avoid overflow-hidden rounded-xl bg-[#6d5dfc] p-6 text-white shadow-xs sm:p-8"
      data-gsp-promotion=""
    >
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Testimonials made easy
      </h2>
      <p className="mt-5 text-base leading-7 text-white sm:text-lg">
        Collect text and video testimonials. Share them everywhere! Free,
        forever.
      </p>
      <Link
        className="mt-7 flex min-h-12 w-full items-center justify-center rounded-lg bg-black px-5 py-3 text-center font-semibold text-white transition-colors hover:bg-black/85 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white motion-reduce:transition-none"
        href="/sign-up?utm_source=public_wall&utm_medium=referral&utm_campaign=powered_by"
        rel="sponsored nofollow"
      >
        Sign up for free
      </Link>
    </aside>
  );
}

export function HostedWall({
  canLoadMore = false,
  loadingMore = false,
  onLoadMore,
  wall,
}: {
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  wall: PublicWallValue;
}) {
  return (
    <main
      className="public-wall-theme bg-background text-foreground min-h-svh px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
      data-wall-theme={wall.theme}
      style={{ "--wall-accent": wall.accentColor } as CSSProperties}
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <p className="text-muted-foreground text-sm font-medium">
            Customer proof
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {wall.brandName}
          </h1>
          <div className="mx-auto mt-5 h-1 w-12 rounded-full bg-(--wall-accent)" />
        </header>

        {wall.testimonials.length === 0 ? (
          <section className="bg-card mx-auto max-w-xl rounded-xl border border-dashed px-6 py-12 text-center shadow-xs">
            <h2 className="font-semibold">No public testimonials yet.</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Published customer proof will appear here.
            </p>
          </section>
        ) : (
          <section
            aria-label={`${wall.brandName} testimonials`}
            className="columns-1 gap-5 md:columns-2"
            data-testid="public-wall-grid"
          >
            {wall.testimonials.map((testimonial, index) => (
              <Fragment key={testimonial.id}>
                <TestimonialCard
                  accentColor={wall.accentColor}
                  attributionRequired={wall.attributionRequired}
                  testimonial={testimonial}
                />
                {wall.attributionRequired && index === 0 ? (
                  <FreeWallPromotion />
                ) : null}
              </Fragment>
            ))}
          </section>
        )}
        {canLoadMore && onLoadMore ? (
          <div className="mt-8 flex justify-center">
            <Button
              disabled={loadingMore}
              onClick={onLoadMore}
              type="button"
              variant="outline"
            >
              {loadingMore ? "Loading…" : "Load more testimonials"}
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
