/** Canonical, OpenGraph, JSON-LD-д ашиглах сайтын үндсэн хаяг (.env: NEXT_PUBLIC_SITE_URL) */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:20267").replace(/\/+$/, "");

/** "/products/x" эсвэл "https://cdn…/a.jpg" → бүрэн URL. Гадаад хаягийг өөрчлөхгүй. */
export const absoluteUrl = (path: string) => new URL(path, `${SITE_URL}/`).toString();
