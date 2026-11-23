import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { SITE_URL } from "@/lib/site-url";
import { getSetting } from "@/server/queries/settings";
import { getSalonInfo } from "@/server/queries/storefront";
import "./globals.css";

// Söhne-тэй ойролцоо үнэгүй sans-serif. Лицензтэй font ирэхэд энд солино
// (next/font/local + ижил `--font-brand` хувьсагч).
const brandFont = Inter_Tight({
  variable: "--font-brand",
  // cyrillic-ext: Монгол ү (U+04AF), ө (U+04E9) энэ subset-д байдаг
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["300", "400", "500"],
  display: "swap",
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
    <html lang="mn" className={brandFont.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
