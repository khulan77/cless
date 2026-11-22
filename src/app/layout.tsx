import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { getSetting } from "@/server/queries/settings";
import "./globals.css";

// Söhne-тэй ойролцоо үнэгүй sans-serif. Лицензтэй font ирэхэд энд солино
// (next/font/local + ижил `--font-brand` хувьсагч).
const brandFont = Inter_Tight({
  variable: "--font-brand",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getSetting("brand");
  const siteName = brand?.siteName ?? "Biologique Recherche";
  return {
    title: { default: siteName, template: `%s · ${siteName}` },
    description: brand?.description,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={brandFont.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
