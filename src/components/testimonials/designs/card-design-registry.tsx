import type { ComponentType } from "react";

import type { CardDesignProps } from "./card-design-types";
import { ClassicRowDesign } from "./classic-row";
import { CompactDesign } from "./compact";
import { EditorialDesign } from "./editorial";
import { QuoteFirstDesign } from "./quote-first";

/**
 * Slug to renderer. Every entry of `cardDesigns` in
 * `src/lib/card-designs-catalog.ts` must have one; the catalog test checks it.
 */
export const cardDesignComponents: Record<
  string,
  ComponentType<CardDesignProps>
> = {
  "classic-row": ClassicRowDesign,
  compact: CompactDesign,
  editorial: EditorialDesign,
  "quote-first": QuoteFirstDesign,
};

export function CardDesignRender({
  slug,
  ...props
}: CardDesignProps & { slug: string }) {
  const Design = cardDesignComponents[slug];
  return Design ? <Design {...props} /> : null;
}
