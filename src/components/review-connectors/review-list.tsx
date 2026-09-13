import type { ReactNode } from "react";
import { Stars } from "@/components/templates/template-primitives";
import type { ConnectedReview } from "./types";

export function ReviewList({
  reviews,
  source,
}: {
  reviews: ConnectedReview[];
  source: ReactNode;
}) {
  return (
    <ul className="divide-border divide-y">
      {reviews.map((review) => (
        <li key={review.id} className="py-4">
          <article className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{review.author}</p>
              <div className="flex items-center gap-3">
                {review.stars !== undefined && (
                  <Stars rating={review.stars} className="text-brand" />
                )}
                <span className="type-small text-ink-2 inline-flex items-center gap-1.5">
                  {source}
                </span>
              </div>
            </div>
            <p className="type-body max-w-prose whitespace-pre-wrap">
              {review.body || "Rating only"}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
