import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local Playwright runs reuse a dev server bound to localhost while their
  // baseURL is 127.0.0.1; both origins must be able to load dev assets.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators:
    process.env.VISUAL_EVIDENCE_MODE === "true" ? false : undefined,
  async headers() {
    return [
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
        source: "/embed/v1.js",
      },
    ];
  },
  typedRoutes: true,
};

export default nextConfig;
