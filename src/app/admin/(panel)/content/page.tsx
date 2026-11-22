import Link from "next/link";
import {
  AnnouncementForm, BenefitsForm, FeaturedProductForm, HeroForm, PromoTrioForm, SplitPromoForm,
} from "@/components/admin/content/SettingForms";
import { EmptyState, PageHeader, btnClass } from "@/components/admin/ui";
import type { SiteSettings } from "@/lib/site-settings";
import type { EditableSettingKey } from "@/lib/validation/site-settings";
import { db } from "@/server/db";
import { requirePagePermission } from "@/server/auth/session";

export const metadata = { title: "Сайтын контент" };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

const TABS: { key: EditableSettingKey; label: string }[] = [
  { key: "announcement", label: "Announcement" },
  { key: "hero", label: "Hero" },
  { key: "promoTrio", label: "Promo (3)" },
  { key: "splitPromo", label: "Хоёр талт promo" },
  { key: "featuredProduct", label: "Онцлох бүтээгдэхүүн" },
  { key: "benefits", label: "Давуу талууд" },
];

// Тохиргоо байхгүй үед эхлэх утга
const EMPTY_IMAGE = { src: "", alt: "" };
const EMPTY_LINK = { label: "", href: "/" };
const DEFAULTS: { [K in EditableSettingKey]: SiteSettings[K] } = {
  announcement: { messages: [""], intervalMs: 5000 },
  hero: { image: EMPTY_IMAGE, title: [""], cta: EMPTY_LINK },
  promoTrio: { items: [0, 1, 2].map(() => ({ image: EMPTY_IMAGE, title: "", text: "", cta: EMPTY_LINK })) },
  splitPromo: { eyebrow: "", title: "", text: "", cta: EMPTY_LINK, image: EMPTY_IMAGE },
  featuredProduct: { title: "", productSlug: "", image: EMPTY_IMAGE },
  benefits: { items: [0, 1, 2, 3].map(() => ({ icon: "gift" as const, lines: ["", ""] as [string, string] })) },
};

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePagePermission("settings:write");
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? "announcement";

  const row = await db.siteSetting.findUnique({ where: { key: tab } });
  const value = (row?.value ?? DEFAULTS[tab]) as never;

  return (
    <>
      <PageHeader
        title="Сайтын контент"
        description="Нүүр хуудасны текст, зураг. Хадгалмагц сайтад шууд харагдана."
        actions={<Link href="/" target="_blank" className={btnClass("secondary")}>Сайт харах ↗</Link>}
      />
      <nav className="mb-5 flex flex-wrap gap-1 border-b border-line" aria-label="Контентын хэсгүүд">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/content?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] ${t.key === tab ? "border-navy font-medium" : "border-transparent text-navy/60 hover:text-navy"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="max-w-[860px]" key={tab}>
        {tab === "announcement" && <AnnouncementForm initial={value} />}
        {tab === "hero" && <HeroForm initial={value} />}
        {tab === "promoTrio" && <PromoTrioForm initial={value} />}
        {tab === "splitPromo" && <SplitPromoForm initial={value} />}
        {tab === "featuredProduct" && <FeaturedProduct initial={value} />}
        {tab === "benefits" && <BenefitsForm initial={value} />}
        {!TABS.some((t) => t.key === tab) && <EmptyState title="Хэсэг олдсонгүй" />}
      </div>
    </>
  );
}

async function FeaturedProduct({ initial }: { initial: SiteSettings["featuredProduct"] }) {
  const products = await db.product.findMany({
    where: { isPublished: true },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });
  return <FeaturedProductForm initial={initial} products={products} />;
}
