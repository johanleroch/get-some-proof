import type { CSSProperties } from "react";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export type PublicTextTestimonial = {
  avatarUrl: string | null;
  company?: string;
  id: string;
  name: string;
  publishedAt: number;
  rating?: number;
  role?: string;
  text: string;
  type: "text";
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function TestimonialCard({
  accentColor,
  attributionRequired,
  testimonial,
}: {
  accentColor: string;
  attributionRequired: boolean;
  testimonial: PublicTextTestimonial;
}) {
  const identity = [testimonial.role, testimonial.company]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className="mb-4 break-inside-avoid overflow-hidden rounded-xl shadow-xs"
      style={{ "--wall-accent": accentColor } as CSSProperties}
    >
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          {testimonial.avatarUrl ? (
            <Image
              alt=""
              className="size-11 rounded-full object-cover"
              height={44}
              src={testimonial.avatarUrl}
              unoptimized
              width={44}
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-muted grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold"
            >
              {initials(testimonial.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{testimonial.name}</p>
            {identity ? (
              <p className="text-muted-foreground truncate text-sm">
                {identity}
              </p>
            ) : null}
          </div>
        </div>

        {testimonial.rating ? (
          <div
            aria-label={`${testimonial.rating} out of 5 stars`}
            className="flex gap-1 text-(--wall-accent)"
            role="img"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                aria-hidden="true"
                className={
                  index < testimonial.rating!
                    ? "size-4 fill-current"
                    : "text-muted-foreground/35 size-4"
                }
                key={index}
              />
            ))}
          </div>
        ) : null}

        <blockquote className="text-[15px] leading-7 font-medium tracking-[-0.01em]">
          {testimonial.text}
        </blockquote>

        {attributionRequired ? (
          <Link
            className="text-muted-foreground hover:text-foreground inline-flex text-xs underline underline-offset-4"
            href="/?utm_source=public_wall&utm_medium=referral&utm_campaign=powered_by"
            rel="sponsored nofollow"
          >
            Powered by Get Some Proof
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
