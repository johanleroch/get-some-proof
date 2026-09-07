import type { ComponentType } from "react";

import { AvatarStack } from "./avatar-stack";
import { BubbleList } from "./bubble-list";
import { Carousel } from "./carousel";
import { GridWall } from "./grid-wall";
import { HeroQuote } from "./hero-quote";
import { ListWall } from "./list-wall";
import { Marquee } from "./marquee";
import { MasonryWall } from "./masonry-wall";
import { ProofStrip } from "./proof-strip";
import { QuoteGrid } from "./quote-grid";
import { RatingBadge } from "./rating-badge";
import { SingleVideo } from "./single-video";
import { SplitHighlights } from "./split-highlights";
import type { TemplateRenderProps } from "./template-types";

/**
 * Slug to renderer. Every entry of `templates` in
 * `src/lib/templates-catalog.ts` must have one; the catalog test checks it.
 */
export const templateComponents: Record<
  string,
  ComponentType<TemplateRenderProps>
> = {
  "avatar-stack": AvatarStack,
  "bubble-list": BubbleList,
  carousel: Carousel,
  "grid-wall": GridWall,
  "hero-quote": HeroQuote,
  "list-wall": ListWall,
  marquee: Marquee,
  "masonry-wall": MasonryWall,
  "proof-strip": ProofStrip,
  "quote-grid": QuoteGrid,
  "rating-badge": RatingBadge,
  "single-video": SingleVideo,
  "split-highlights": SplitHighlights,
};

export function TemplateRender({
  slug,
  ...props
}: TemplateRenderProps & { slug: string }) {
  const Template = templateComponents[slug];
  return Template ? <Template {...props} /> : null;
}
