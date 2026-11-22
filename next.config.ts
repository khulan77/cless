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
  // Админ: хайлтын системд индексжүүлэхгүй, хөтөч/прокси кэшлэхгүй (хувийн өгөгдөл)
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
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
