import { Fragment, type CSSProperties } from "react";
import Link from "next/link";

import { Sparkle, WallFrames } from "@/components/doodles";
import {
  TestimonialCard,
  type PublicTestimonial,
} from "@/components/testimonials/testimonial-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

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
      className="bg-ink text-paper mb-5 break-inside-avoid overflow-hidden rounded-lg p-6 sm:p-8"
      data-gsp-promotion=""
    >
      <Sparkle className="text-brand size-10" />
      <h2 className="font-display mt-4 text-2xl leading-tight font-bold tracking-[-0.025em] sm:text-3xl">
        Testimonials made easy
      </h2>
      <p className="text-paper/80 mt-4 text-base leading-7 sm:text-lg">
        Collect text and video testimonials. Share them everywhere! Free,
        forever.
      </p>
      <Link
        className="bg-brand text-brand-ink hover:bg-brand-strong focus-visible:outline-brand mt-7 flex min-h-12 w-full items-center justify-center rounded-md px-5 py-3 text-center font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 motion-reduce:transition-none"
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
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 sm:mb-12">
          <div className="max-w-2xl space-y-3">
            <p className="type-micro text-muted-foreground">Customer proof</p>
            <h1 className="type-display-xl flex items-start gap-3 text-balance">
              <span>{wall.brandName}</span>
              <Sparkle
                className="mt-1 size-9 shrink-0 text-(--wall-accent) sm:size-10"
              />
            </h1>
          </div>
          {wall.testimonials.length > 0 ? (
            <Badge variant="outline">
              {wall.testimonials.length}
              {canLoadMore ? "+" : ""} proofs
            </Badge>
          ) : null}
        </header>

        {wall.testimonials.length === 0 ? (
          <section className="bg-card mx-auto max-w-xl rounded-lg border">
            <EmptyState
              description="Published customer proof will appear here."
              headingLevel={2}
              illustration={<WallFrames className="h-28" />}
              title="No public testimonials yet."
            />
          </section>
        ) : (
          <section
            aria-label={`${wall.brandName} testimonials`}
            className="columns-1 gap-5 sm:columns-2 lg:columns-3"
            data-testid="public-wall-grid"
          >
            {wall.testimonials.map((testimonial, index) => (
              <Fragment key={testimonial.id}>
                <TestimonialCard
                  accentColor={wall.accentColor}
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
              loading={loadingMore}
              onClick={onLoadMore}
              size="lg"
              type="button"
              variant="outline"
            >
              Load more testimonials
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
