import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { StorefrontProvider } from "@/components/salon/StorefrontContext";
import { cacheLife, cacheTag } from "next/cache";
import { resolveFooterColumns, resolveNavigation } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";
import { getSalonInfo } from "@/server/queries/storefront";
import { isCheckoutOnlyHref } from "@/lib/shop-mode";
import { t } from "@/i18n";

/**
 * Header/Footer-ийн бүх өгөгдөл нэг кэш entry-д. Тусдаа кэштэй дуудлагуудын waterfall
 * (settings → collections) navigation-ий validation-д "uncached data" гэж бүртгэгддэг байсан.
 * Админ хадгалахад updateTag("settings" | "catalog") шинэчилнэ.
 */
async function getShellData() {
  "use cache";
  // Цэс, footer зөвхөн админаас өөрчлөгддөг бөгөөд хадгалах бүрт updateTag шууд
  // шинэчилнэ. Тиймээс хугацаагаар (60 сек) дахин тооцоолох шаардлагагүй — хугацаа нь
  // дууссан entry-г dev-ийн instant validation "uncached data" гэж тэмдэглэдэг байсан.
  // Тодорхой outer cacheLife нь дотоод getSetting/getCollections-ийн хугацааг давж ажиллана.
  cacheLife({ stale: 300, revalidate: 86400, expire: 604800 });
  cacheTag("settings", "catalog", "collections");

  const [announcement, brand, navigation, footer] = await Promise.all([
    getSetting("announcement"),
    getSetting("brand"),
    getSetting("navigation"),
    getSetting("footer"),
  ]);
  const [nav, footerColumns] = await Promise.all([
    resolveNavigation(navigation?.items ?? []),
    resolveFooterColumns(footer?.columns ?? []),
  ]);
  return { announcement, brand, footer, nav, footerColumns };
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [{ announcement, brand, footer, nav: rawNav, footerColumns }, salon] = await Promise.all([getShellData(), getSalonInfo()]);
  const wordmark = brand?.wordmark ?? [];
  const siteName = salon.siteName;
  const nav = salon.shopMode === "CATALOG" ? rawNav.filter((i) => !isCheckoutOnlyHref(i.href)) : rawNav;
  const contact = { phone: salon.phone, instagram: salon.instagram, messenger: salon.messenger, address: salon.address, mapsUrl: salon.mapsUrl, hoursLines: salon.hoursLines };

  return (
    <StorefrontProvider value={{ mode: salon.shopMode, salon: contact }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-white focus:px-4 focus:py-2"
      >
        {t.common.skipToContent}
      </a>
      {announcement && <AnnouncementBar messages={announcement.messages} intervalMs={announcement.intervalMs} />}
      <Header wordmark={wordmark} siteName={siteName} nav={nav} salon={contact} shopMode={salon.shopMode} />
      <main id="main" className="flex-1">
        {children}
      </main>
      {footer && <Footer footer={footer} columns={footerColumns} wordmark={wordmark} salon={salon} />}
    </StorefrontProvider>
  );
}
