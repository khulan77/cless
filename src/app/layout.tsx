import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { SITE_URL } from "@/lib/site-url";
import { getSetting } from "@/server/queries/settings";
import { getSalonInfo } from "@/server/queries/storefront";
import "./globals.css";

// BR сайтын Söhne-ийн оронд (арилжааны лиценз, Монгол үсэг бүрэн биш): гарчиг Inter Tight, текст Inter.
// Бүх subset self-host (next/font). Жин 400 — 500 зөвхөн үнэ, идэвхтэй tab.
// Лицензтэй font ирэхэд зөвхөн энд солино (`--font-brand`, `--font-brand-heading`).
const bodyFont = Inter({
  variable: "--font-brand",
  // cyrillic-ext: Монгол ү (U+04AF), ө (U+04E9)
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500"],
  display: "swap",
});
const headingFont = Inter_Tight({
  variable: "--font-brand-heading",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500"],
  display: "swap",
  // Body text (Inter) is the LCP; headings swap in a moment later — 4 fewer preloaded files
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  // Сайтын нэр — Сайтын контент → Брэнд ("Сайтын нэр"), title template, OG, copyright нэг эх сурвалж
  const [brand, { siteName }] = await Promise.all([getSetting("brand"), getSalonInfo()]);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: siteName, template: `%s · ${siteName}` },
    description: brand?.description,
    openGraph: { type: "website", siteName, locale: "mn_MN", title: siteName, description: brand?.description },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
