import { averageRating, Stars, TemplateAvatar } from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * Overlapping avatars, stars and one line: social proof for the space under
 * a call to action. Avatars fall back to initials tinted with the accent.
 */
export function AvatarStack({ testimonials }: TemplateRenderProps) {
  const faces = testimonials.slice(0, 5);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex -space-x-2">
        {faces.map((testimonial) => (
          <TemplateAvatar
            className="ring-background relative ring-2"
            key={testimonial.id}
            size={40}
            testimonial={testimonial}
          />
        ))}
      </div>
      <div className="space-y-1">
        <Stars rating={averageRating(testimonials)} size={16} />
        <p className="text-sm font-semibold tracking-[-0.008em]">
          Trusted by {testimonials.length} customers
        </p>
      </div>
    </div>
  );
}
