/**
 * SiteSetting-ийн key болон value-ийн төрлүүд. Seed болон UI хоёул эндээс ашиглана.
 * Админ хэсэг (дараагийн ээлжүүдэд) эдгээр бүтцийг засна.
 */

export type Link = { label: string; href: string };
export type Image = { src: string; alt: string };

export type AnnouncementSetting = { messages: string[]; intervalMs: number };

export type BrandSetting = {
  /** Лого ирэх хүртэлх текст wordmark — мөр бүр тусдаа */
  wordmark: string[];
  siteName: string;
  description: string;
};

/** Цэсний бүлэг: DB-ийн Collection-оос автоматаар бөглөгдөнө */
export type NavCollectionSource = {
  title: string;
  kind: "CATEGORY" | "CONCERN";
  /** Collection.navGroup-ээр шүүнэ. Байхгүй бол тухайн kind бүгд */
  navGroup?: string;
};

export type NavItem = {
  label: string;
  href: string;
  groups?: NavCollectionSource[];
};

export type NavigationSetting = { items: NavItem[] };

export type HeroSetting = { image: Image; title: string[]; cta: Link };

export type PromoCard = { image: Image; title: string; text: string; cta: Link };
export type PromoTrioSetting = { items: PromoCard[] };

export type SplitPromoSetting = {
  eyebrow: string;
  title: string;
  text: string;
  cta: Link;
  image: Image;
};

export type FeaturedProductSetting = { title: string; productSlug: string; image: Image };

export type ProductCarouselSetting = { title: string; cta: Link };

export type BannerSetting = {
  eyebrow?: string;
  title: string;
  text?: string;
  cta: Link;
  image: Image;
};

export type GridSectionSetting = { title: string; labelPrefix?: string };

export type BenefitIcon = "gift" | "package" | "scan-face" | "shield-check" | "sparkles";
export type BenefitsSetting = { items: { icon: BenefitIcon; lines: [string, string] }[] };

export type FooterSetting = {
  columns: { title: string; links: Link[] }[];
  contact: { title: string; address: string; phone: string; email: string; hours: string[] };
  socials: { network: "instagram" | "facebook"; href: string; label: string }[];
  newsletter: { title: string; text: string; placeholder: string; button: string };
  copyright: string;
};

export type SiteSettings = {
  announcement: AnnouncementSetting;
  brand: BrandSetting;
  navigation: NavigationSetting;
  hero: HeroSetting;
  promoTrio: PromoTrioSetting;
  splitPromo: SplitPromoSetting;
  featuredProduct: FeaturedProductSetting;
  iconicCarousel: ProductCarouselSetting;
  salonBanner: BannerSetting;
  concernGrid: GridSectionSetting;
  categoryGrid: GridSectionSetting;
  servicesBanner: BannerSetting;
  benefits: BenefitsSetting;
  footer: FooterSetting;
};

export type SiteSettingKey = keyof SiteSettings;
