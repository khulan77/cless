import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker image-д л (Dockerfile: NEXT_OUTPUT=standalone). Локал `next start` (E2E) standalone-той ажилладаггүй.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
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
  // CATALOG горим (онлайн төлбөр/хүргэлт 2-р үе шатанд): сагс, бүртгэл, checkout, хүргэлтийн
  // хуудас байхгүй. Түр (307) — CHECKOUT нээгдэхэд (CHECKOUT_AVAILABLE) эндээс хасна.
  async redirects() {
    return [
      { source: "/cart", destination: "/collections", permanent: false },
      { source: "/checkout/:path*", destination: "/collections", permanent: false },
      { source: "/account/:path*", destination: "/", permanent: false },
      { source: "/shipping", destination: "/salon", permanent: false },
    ];
  },
  images: {
    // Hero is served at quality 90 (sharp edges on large screens); everything else at the default 75
    qualities: [75, 85, 90],
    // NEXT_IMAGE_UNOPTIMIZED=1: serve files as they are, skipping /_next/image (Vercel Hobby's
    // optimization quota returns 402 once used up). Defaults and uploads are already webp from sharp.
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
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
