import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
