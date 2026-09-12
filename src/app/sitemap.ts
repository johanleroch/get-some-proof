import type { MetadataRoute } from "next";

import { getMetadataBase } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // The root redirects to authentication. Template details are noindex, and
  // customer Walls are discovered from their owners' links, not enumerated here.
  return [{ url: new URL("/templates", getMetadataBase()).toString() }];
}
