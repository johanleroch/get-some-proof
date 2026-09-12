import type { Metadata } from "next";

import { productDescription, productName } from "./brand";

/** Public origin only: never derive crawler URLs from incoming request headers. */
export function getMetadataBase(): URL {
  const configured = URL.parse(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (configured && ["http:", "https:"].includes(configured.protocol)) {
    return new URL(configured.origin);
  }
  // Preserve the existing SetupRequired screen when configuration is invalid.
  return new URL("https://www.getsomeproof.com");
}

export const socialImage = {
  url: "/brand/social-card.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Get Some Proof — customer testimonials, with our amber mascot and Gelica wordmark.",
};

export function publicPageMetadata({
  title = productName,
  description = productDescription,
  path,
}: { title?: string; description?: string; path?: string } = {}): Metadata {
  return {
    title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      type: "website",
      siteName: productName,
      locale: "en_US",
      title,
      description,
      ...(path ? { url: path } : {}),
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}
