import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site-url";

/** /robots.txt — админ, API, сагс/бүртгэлийг индексжүүлэхгүй */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/cart", "/account", "/search"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
