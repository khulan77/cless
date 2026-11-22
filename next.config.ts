import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-ийг http://127.0.0.1:20267-оор нээдэг (localhost-ийн бусад төслийн cookie-оос
  // болж 431 гардаг). Үүнгүй бол /_next/hmr, chunk-ууд блоклогдож hydration болохгүй.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    agentFeedback: true,
    // forbidden() / unauthorized() — эрхгүй хуудсанд 403
    authInterrupts: true,
    // Зургийг нэг нэгээр нь upload хийнэ (≤5MB + multipart overhead)
    serverActions: { bodySizeLimit: "6mb" },
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
