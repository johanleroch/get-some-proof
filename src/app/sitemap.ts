import type { MetadataRoute } from "next";

import { getMetadataBase } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // The landing page and the templates gallery are our two public pages.
  // Template details are noindex, and customer Walls are discovered from
  // their owners' links, not enumerated here.
  const base = getMetadataBase();
  return [
    { url: new URL("/", base).toString() },
    { url: new URL("/templates", base).toString() },
  ];
}
