import { identityLine, Stars, textTestimonials } from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * Draft. One line of proof: stars, the shortest quote and who said it, for
 * the space under a button or beside a form field.
 */
export function ProofStrip({ testimonials }: TemplateRenderProps) {
  const shortest = [...textTestimonials(testimonials)].sort(
    (a, b) => a.text.length - b.text.length,
  )[0];
  if (!shortest) return null;
  const meta = identityLine(shortest);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {shortest.rating ? <Stars rating={shortest.rating} size={14} /> : null}
      <span className="font-medium">&ldquo;{shortest.text}&rdquo;</span>
      <span className="text-muted-foreground">
        {shortest.name}
        {meta ? `, ${meta}` : ""}
      </span>
    </p>
  );
}
