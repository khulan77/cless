import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { resolveNavigation } from "@/server/queries/catalog";
import { getSetting } from "@/server/queries/settings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [announcement, brand, navigation, footer] = await Promise.all([
    getSetting("announcement"),
    getSetting("brand"),
    getSetting("navigation"),
    getSetting("footer"),
  ]);
  const nav = await resolveNavigation(navigation?.items ?? []);
  const wordmark = brand?.wordmark ?? [];
  const siteName = brand?.siteName ?? "";

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-white focus:px-4 focus:py-2"
      >
        Үндсэн агуулга руу шилжих
      </a>
      {announcement && <AnnouncementBar messages={announcement.messages} intervalMs={announcement.intervalMs} />}
      <Header wordmark={wordmark} siteName={siteName} nav={nav} />
      <main id="main" className="flex-1">
        {children}
      </main>
      {footer && <Footer footer={footer} wordmark={wordmark} siteName={siteName} />}
    </>
  );
}
