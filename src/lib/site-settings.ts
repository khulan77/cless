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

/**
 * Цэсний бүлэг: DB-ийн Collection-оос автоматаар бөглөгдөнө (showInMenu=true).
 * parentSlug өгвөл тухайн ангиллын хүүхдүүд; slugs өгвөл яг тэдгээр; аль нь ч үгүй бол
 * тухайн kind-ийн дээд түвшний ангиллууд.
 */
export type NavCollectionSource = {
  title: string;
  kind: "CATEGORY" | "CONCERN";
  parentSlug?: string;
  slugs?: string[];
};

export type NavItem = {
  label: string;
  href: string;
  groups?: NavCollectionSource[];
};

export type NavigationSetting = { items: NavItem[] };

export type HeroSetting = {
  image: Image;
  title: string[];
  cta: Link;
  /** Focal point in % (object-position) — keeps the subject in frame when cropped */
  focal?: { x: number; y: number };
  /** Separate portrait image for phones (optional) */
  mobileImage?: Image | null;
  /**
   * "center" (as on biologique-recherche.com): on md+ the image keeps a natural scale, centred and
   * anchored to the top, edges feathered into `background` — for portrait / low-res shots on a plain backdrop.
   * "cover" (default): fills the whole hero.
   */
  layout?: "cover" | "center";
  /** Backdrop colour for "center" — match the photo's background */
  background?: string;
  /** "dark": navy logo and icons over a light photo */
  headerTone?: "light" | "dark";
};

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

export type BenefitIcon = "gift" | "package" | "scan-face" | "shield-check" | "sparkles" | "truck";
export type BenefitsSetting = { items: { icon: BenefitIcon; lines: [string, string] }[] };

/** Бүтээгдэхүүний хуудасны давуу талын мөр (icon + нэг мөр текст) */
export type ProductBenefitsSetting = { items: { icon: BenefitIcon; label: string }[] };

export type FooterColumn = {
  title: string;
  links: Link[];
  /** Өгвөл линкүүдийг DB-ийн Collection-оос автоматаар нэмнэ (slug → /collections/[slug]) */
  collections?: { kind: "CATEGORY" | "CONCERN"; parentSlug?: string; slugs?: string[] };
};

export type FooterSetting = {
  columns: FooterColumn[];
  contact: { title: string; address: string; phone: string; email: string; hours: string[]; mapsUrl?: string };
  socials: { network: "instagram" | "facebook"; href: string; label: string }[];
  newsletter: { title: string; text: string; placeholder: string; button: string };
  copyright: string;
};

/** /about — гарчиг, удиртгал, 2–3 хэсэг (гарчиг + текст + зураг) */
export type AboutPageSetting = {
  title: string;
  intro: string;
  sections: { title: string; text: string; image: Image }[];
};

/** /privacy — энгийн markdown (SafeMarkdown-оор render, HTML зөвшөөрөхгүй) */
export type PrivacyPageSetting = { title: string; body: string };

/** /contact — холбоо барих мэдээлэл нь footer-оос; энд зөвхөн нэмэлт */
export type ContactPageSetting = { mapEmbedUrl: string };

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
  productBenefits: ProductBenefitsSetting;
  footer: FooterSetting;
  // Контент хуудсууд — заавал биш (seed-д байхгүй; байхгүй бол placeholder харагдана)
  aboutPage?: AboutPageSetting;
  privacyPage?: PrivacyPageSetting;
  contactPage?: ContactPageSetting;
};

export type SiteSettingKey = keyof SiteSettings;
