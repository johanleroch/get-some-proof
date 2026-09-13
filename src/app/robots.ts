import type { MetadataRoute } from "next";

import { getMetadataBase } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // Let crawlers read noindex on private/auth pages and fetch share images.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/mcp"] },
    sitemap: new URL("/sitemap.xml", getMetadataBase()).toString(),
  };
}
