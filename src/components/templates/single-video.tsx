import { TestimonialCard } from "@/components/testimonials/testimonial-card";

import { identityLine, Stars, videoTestimonials } from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * One video Testimonial: the shared video card (poster, play button, name
 * over the shade) beside the person set large, so the layout reads on a
 * page even before anyone presses play.
 */
export function SingleVideo({
  accentColor,
  testimonials,
}: TemplateRenderProps) {
  const video = videoTestimonials(testimonials)[0];
  if (!video) return null;
  const meta = identityLine(video);
  return (
    <div className="grid items-center gap-8 @xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <div className="[&_article]:mb-0">
        <TestimonialCard accentColor={accentColor} testimonial={video} />
      </div>
      <div className="space-y-4">
        {video.rating ? <Stars rating={video.rating} size={20} /> : null}
        <div className="space-y-1">
          <p className="type-heading">{video.name}</p>
          {meta ? <p className="text-muted-foreground">{meta}</p> : null}
        </div>
        <p className="text-muted-foreground type-small">
          Video Testimonial, recorded in the Collection Form.
        </p>
      </div>
    </div>
  );
}
