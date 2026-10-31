import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.E2E_TEST === "1" ? ".next-e2e" : ".next",
  devIndicators: false,
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
