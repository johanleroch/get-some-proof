import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators:
    process.env.VISUAL_EVIDENCE_MODE === "true" ? false : undefined,
  typedRoutes: true,
};

export default nextConfig;
