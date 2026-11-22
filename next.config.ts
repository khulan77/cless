import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
