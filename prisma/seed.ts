/**
 * Idempotent seed: олон удаа ажиллуулж болно (upsert / тогтмол id).
 * Ажиллуулах: `bun run db:seed`
 *
 * Анхаар: бүх текст, үнэ нь PLACEHOLDER. Бодит үнэ, тайлбар, зургийг
 * дистрибьютер админ хэсгээс оруулна.
 */
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type BadgeType, type Role } from "../src/generated/prisma/client";
import type { SiteSettings } from "../src/lib/site-settings";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL (эсвэл DIRECT_URL) тохируулагдаагүй байна");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ───────────────────────── Хэрэглэгчид ─────────────────────────

async function seedUsers() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD (8+ тэмдэгт) .env-д тохируулна уу");
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const users: { email: string; name: string; role: Role; phone: string; baseSalary: number }[] = [
    { email: "admin@example.mn", name: "Админ", role: "ADMIN", phone: "99000001", baseSalary: 0 },
    { email: "manager@example.mn", name: "Ресепшн Менежер", role: "MANAGER", phone: "99000002", baseSalary: 1_800_000 },
    { email: "staff1@example.mn", name: "Гоо сайханч Сараа", role: "STAFF", phone: "99000003", baseSalary: 1_500_000 },
    { email: "staff2@example.mn", name: "Гоо сайханч Номин", role: "STAFF", phone: "99000004", baseSalary: 1_500_000 },
  ];

  for (const u of users) {
    // Давтан ажиллуулахад нууц үгийг дарж бичихгүй.
    await db.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: { name: u.name, role: u.role, phone: u.phone },
    });
  }
}

// ───────────────────────── Collection-ууд ─────────────────────────

const categories = [
  { slug: "cleansers-milks", name: "Цэвэрлэгч ба сүү", navGroup: "face", showOnHome: false },
  { slug: "lotion-p50", name: "Лосьон P50", navGroup: "face", showOnHome: true },
  { slug: "serums", name: "Серум", navGroup: "face", showOnHome: true },
  { slug: "creams", name: "Тос (крем)", navGroup: "face", showOnHome: true },
  { slug: "masks", name: "Маск", navGroup: "face", showOnHome: true },
  { slug: "eyes-lips", name: "Нүд ба уруул", navGroup: "face", showOnHome: false },
  { slug: "body", name: "Бие", navGroup: "body-hair", showOnHome: false },
  { slug: "hair", name: "Үс", navGroup: "body-hair", showOnHome: false },
];

const concerns = [
  { slug: "pigmentation", name: "Пигментаци" },
  { slug: "anti-ageing", name: "Хөгшрөлтийн эсрэг" },
  { slug: "blemishes", name: "Батга ба арьсны согог" },
  { slug: "hydration", name: "Чийгшүүлэлт" },
  { slug: "skin-texture", name: "Арьсны чанар" },
  { slug: "sensitive-skin", name: "Мэдрэг арьс" },
  { slug: "plumping", name: "Дүүргэлт" },
  { slug: "firming", name: "Чангалах" },
];

async function seedCollections() {
  for (const [i, c] of categories.entries()) {
    const data = {
      name: c.name,
      kind: "CATEGORY" as const,
      navGroup: c.navGroup,
      showOnHome: c.showOnHome,
      sortOrder: i,
      image: `/placeholders/category-${i + 1}.svg`,
      description: `${c.name} — тайлбар удахгүй нэмэгдэнэ.`,
    };
    await db.collection.upsert({ where: { slug: c.slug }, create: { slug: c.slug, ...data }, update: data });
  }
  for (const [i, c] of concerns.entries()) {
    const data = {
      name: c.name,
      kind: "CONCERN" as const,
      navGroup: "face",
      showOnHome: true,
      sortOrder: i,
      image: `/placeholders/concern-${i + 1}.svg`,
      description: `${c.name} — протоколын тайлбар удахгүй нэмэгдэнэ.`,
    };
    await db.collection.upsert({ where: { slug: c.slug }, create: { slug: c.slug, ...data }, update: data });
  }
}

// ───────────────────────── Бүтээгдэхүүн ─────────────────────────

type SeedVariant = { size: string; price: number; cost: number; stock: number };
type SeedProduct = {
  slug: string;
  name: string;
  subtitle: string;
  badge: BadgeType | null;
  collections: string[];
  variants: SeedVariant[];
};

const products: SeedProduct[] = [
  {
    slug: "lotion-p50",
    name: "Lotion P50",
    subtitle: "Гуужуулах / Тэнцвэржүүлэх / Арьсны чанар",
    badge: "ICONIC",
    collections: ["lotion-p50", "skin-texture", "blemishes"],
    variants: [
      { size: "250 ml", price: 280_000, cost: 150_000, stock: 14 },
      { size: "150 ml", price: 190_000, cost: 100_000, stock: 9 },
      { size: "50 ml", price: 80_000, cost: 40_000, stock: 0 },
    ],
  },
  {
    slug: "lotion-p50-pigm-400",
    name: "Lotion P50 PIGM 400",
    subtitle: "Пигментаци / Гэрэлтүүлэх",
    badge: "ICONIC",
    collections: ["lotion-p50", "pigmentation"],
    variants: [
      { size: "250 ml", price: 320_000, cost: 170_000, stock: 6 },
      { size: "150 ml", price: 220_000, cost: 115_000, stock: 0 },
    ],
  },
  {
    slug: "serum-vivant",
    name: "Sérum Vivant",
    subtitle: "Цэвэршүүлэх / Батга",
    badge: "ICONIC",
    collections: ["serums", "blemishes"],
    variants: [
      { size: "30 ml", price: 240_000, cost: 120_000, stock: 11 },
      { size: "8 ml", price: 85_000, cost: 40_000, stock: 4 },
    ],
  },
  {
    slug: "masque-vivant",
    name: "Masque Vivant",
    subtitle: "Цэвэршүүлэх / Нүх сүв",
    badge: "ICONIC",
    collections: ["masks", "blemishes", "skin-texture"],
    variants: [{ size: "100 ml", price: 260_000, cost: 130_000, stock: 7 }],
  },
  {
    slug: "creme-mec",
    name: "Crème M.E.C.",
    subtitle: "Хөгшрөлтийн эсрэг / Чангалах",
    badge: "ICONIC",
    collections: ["creams", "anti-ageing", "firming"],
    variants: [{ size: "50 ml", price: 450_000, cost: 230_000, stock: 5 }],
  },
  {
    slug: "progeskin",
    name: "Progeskin",
    subtitle: "Дүүргэлт / Хөгшрөлтийн эсрэг",
    badge: "NEW",
    collections: ["serums", "plumping", "anti-ageing"],
    variants: [
      { size: "30 ml", price: 420_000, cost: 210_000, stock: 8 },
      { size: "8 ml", price: 140_000, cost: 70_000, stock: 0 },
    ],
  },
  {
    slug: "serum-colostrum",
    name: "Sérum Colostrum",
    subtitle: "Мэдрэг арьс / Тайвшруулах",
    badge: "NEW",
    collections: ["serums", "sensitive-skin"],
    variants: [
      { size: "30 ml", price: 260_000, cost: 130_000, stock: 12 },
      { size: "8 ml", price: 90_000, cost: 45_000, stock: 3 },
    ],
  },
  {
    slug: "lait-vip-o2",
    name: "Lait VIP O2",
    subtitle: "Цэвэрлэх / Хүчилтөрөгчөөр баяжуулах",
    badge: null,
    collections: ["cleansers-milks", "skin-texture"],
    variants: [
      { size: "250 ml", price: 180_000, cost: 90_000, stock: 10 },
      { size: "100 ml", price: 95_000, cost: 48_000, stock: 2 },
    ],
  },
  {
    slug: "creme-dermopurifiante",
    name: "Crème Dermopurifiante",
    subtitle: "Батга / Тэнцвэржүүлэх",
    badge: null,
    collections: ["creams", "blemishes"],
    variants: [{ size: "50 ml", price: 210_000, cost: 105_000, stock: 0 }],
  },
  {
    slug: "creme-masque-vernix",
    name: "Crème Masque Vernix",
    subtitle: "Чийгшүүлэлт / Нөхөн сэргээх",
    badge: "NEW",
    collections: ["masks", "hydration", "sensitive-skin"],
    variants: [{ size: "100 ml", price: 300_000, cost: 150_000, stock: 6 }],
  },
  {
    slug: "serum-contour-des-yeux",
    name: "Sérum Contour des Yeux",
    subtitle: "Нүдний орчим / Хавангийн эсрэг",
    badge: null,
    collections: ["eyes-lips", "anti-ageing"],
    variants: [{ size: "15 ml", price: 230_000, cost: 115_000, stock: 9 }],
  },
  {
    slug: "creme-corps",
    name: "Crème Corps",
    subtitle: "Бие / Чийгшүүлэлт / Чангалах",
    badge: null,
    collections: ["body", "hydration", "firming"],
    variants: [{ size: "200 ml", price: 190_000, cost: 95_000, stock: 20 }],
  },
];

function skuFor(slug: string, size: string) {
  return `BR-${slug}-${size.replace(/\s+/g, "").toLowerCase()}`.toUpperCase();
}

async function seedProducts(adminId: string) {
  const collectionIds = new Map(
    (await db.collection.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );

  for (const [i, p] of products.entries()) {
    const data = {
      name: p.name,
      subtitle: p.subtitle,
      badge: p.badge,
      isPublished: true,
      sortOrder: i,
      description:
        "Биологик Решерш лабораторийн бүтээгдэхүүн. Дэлгэрэнгүй тайлбарыг удахгүй албан ёсны материалаас нэмнэ.",
      howToUse: "Өглөө, орой цэвэрлэсэн арьсанд түрхэнэ. Гоо сайханчаасаа зөвлөгөө аваарай.",
      ingredients: null,
    };
    const product = await db.product.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...data },
      update: data,
    });

    await db.productImage.upsert({
      where: { id: `seed-img-${p.slug}` },
      create: {
        id: `seed-img-${p.slug}`,
        productId: product.id,
        url: `/placeholders/product-${i + 1}.svg`,
        alt: `${p.name} — бүтээгдэхүүний зураг`,
      },
      update: { url: `/placeholders/product-${i + 1}.svg`, alt: `${p.name} — бүтээгдэхүүний зураг` },
    });

    for (const [ci, slug] of p.collections.entries()) {
      const collectionId = collectionIds.get(slug);
      if (!collectionId) throw new Error(`Collection олдсонгүй: ${slug}`);
      await db.productCollection.upsert({
        where: { productId_collectionId: { productId: product.id, collectionId } },
        create: { productId: product.id, collectionId, sortOrder: ci },
        update: { sortOrder: ci },
      });
    }

    for (const [vi, v] of p.variants.entries()) {
      const sku = skuFor(p.slug, v.size);
      const existing = await db.variant.findUnique({ where: { sku } });
      if (existing) {
        // Үлдэгдлийг seed дахин ажиллахад өөрчлөхгүй — movement түүх бүрэн байна.
        await db.variant.update({ where: { sku }, data: { size: v.size, sortOrder: vi } });
        continue;
      }
      // Шинэ хувилбар: анхны үлдэгдлийг PURCHASE movement-тэй хамт нэг transaction-д.
      await db.$transaction(async (tx) => {
        const variant = await tx.variant.create({
          data: {
            productId: product.id,
            sku,
            size: v.size,
            price: v.price,
            costPrice: v.cost,
            stock: v.stock,
            sortOrder: vi,
          },
        });
        if (v.stock > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: variant.id,
              type: "PURCHASE",
              qty: v.stock,
              unitCost: v.cost,
              note: "Seed: анхны үлдэгдэл",
              createdById: adminId,
            },
          });
        }
      });
    }
  }
}

// ───────────────────────── Үйлчилгээ ─────────────────────────

const services = [
  {
    slug: "skin-diagnosis",
    name: "Арьсны оношлогоо ба зөвлөгөө",
    description: "Арьсны төлөв байдлыг тодорхойлж, хувийн арчилгааны протокол санал болгоно.",
    durationMin: 30,
    price: 50_000,
    consumables: [] as { sku: string; qty: number }[],
  },
  {
    slug: "facial-hydration-60",
    name: "Нүүрний эмчилгээ — Чийгшүүлэх",
    description: "Чийгшүүлэх, тайвшруулах 60 минутын нүүрний эмчилгээ.",
    durationMin: 60,
    price: 250_000,
    consumables: [
      { sku: skuFor("lait-vip-o2", "250 ml"), qty: 0.04 },
      { sku: skuFor("lotion-p50", "250 ml"), qty: 0.03 },
      { sku: skuFor("creme-masque-vernix", "100 ml"), qty: 0.1 },
    ],
  },
  {
    slug: "facial-anti-ageing-90",
    name: "Нүүрний эмчилгээ — Хөгшрөлтийн эсрэг",
    description: "Чангалах, дүүргэх үр дүнтэй 90 минутын бүрэн протокол.",
    durationMin: 90,
    price: 380_000,
    consumables: [
      { sku: skuFor("lait-vip-o2", "250 ml"), qty: 0.04 },
      { sku: skuFor("lotion-p50", "250 ml"), qty: 0.03 },
      { sku: skuFor("progeskin", "30 ml"), qty: 0.05 },
      { sku: skuFor("creme-mec", "50 ml"), qty: 0.04 },
    ],
  },
  {
    slug: "pigmentation-protocol-75",
    name: "Пигментацийн протокол",
    description: "Толбо, жигд бус өнгийг багасгах 75 минутын эмчилгээ.",
    durationMin: 75,
    price: 320_000,
    consumables: [
      { sku: skuFor("lotion-p50-pigm-400", "250 ml"), qty: 0.04 },
      { sku: skuFor("masque-vivant", "100 ml"), qty: 0.1 },
    ],
  },
  {
    slug: "purifying-facial-60",
    name: "Цэвэршүүлэх нүүрний эмчилгээ",
    description: "Батга, нүх сүвний асуудалтай арьсанд зориулсан 60 минутын эмчилгээ.",
    durationMin: 60,
    price: 230_000,
    consumables: [
      { sku: skuFor("lotion-p50", "250 ml"), qty: 0.03 },
      { sku: skuFor("serum-vivant", "30 ml"), qty: 0.05 },
      { sku: skuFor("masque-vivant", "100 ml"), qty: 0.1 },
    ],
  },
];

async function seedServices() {
  for (const [i, s] of services.entries()) {
    const data = {
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      price: s.price,
      sortOrder: i,
      isActive: true,
      image: "/placeholders/services.svg",
    };
    const service = await db.service.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, ...data },
      update: data,
    });
    for (const c of s.consumables) {
      const variant = await db.variant.findUniqueOrThrow({ where: { sku: c.sku } });
      await db.serviceConsumable.upsert({
        where: { serviceId_variantId: { serviceId: service.id, variantId: variant.id } },
        create: { serviceId: service.id, variantId: variant.id, qtyPerService: c.qty },
        update: { qtyPerService: c.qty },
      });
    }
  }
}

// ───────────────────────── Урамшууллын жишээ дүрэм ─────────────────────────

async function seedCommissionRules() {
  const rules = [
    { id: "seed-commission-service-default", kind: "SERVICE" as const, value: 1000 }, // 10%
    { id: "seed-commission-product-default", kind: "PRODUCT" as const, value: 500 }, // 5%
  ];
  for (const r of rules) {
    await db.commissionRule.upsert({
      where: { id: r.id },
      create: { id: r.id, kind: r.kind, type: "PERCENT", value: r.value },
      update: { kind: r.kind, type: "PERCENT", value: r.value },
    });
  }
}

// ───────────────────────── Сайтын контент ─────────────────────────

const settings: SiteSettings = {
  announcement: {
    intervalMs: 5000,
    messages: [
      "Захиалга бүрт 3 дээж бэлэг",
      "Салон дээр арьсны үнэгүй оношлогоо — урьдчилан цаг аваарай",
      "Улаанбаатар хотод 2 өдрийн дотор хүргэнэ",
    ],
  },
  brand: {
    wordmark: ["BIOLOGIQUE", "RECHERCHE", "PARIS"],
    siteName: "Biologique Recherche Mongolia",
    description: "Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютер — СПА салон ба онлайн дэлгүүр.",
  },
  navigation: {
    items: [
      { label: "Бэлэг", href: "/gifts" },
      {
        label: "Нүүрний арчилгаа",
        href: "/face",
        groups: [
          { title: "Ангилал", kind: "CATEGORY", navGroup: "face" },
          { title: "Арьсны асуудлаар", kind: "CONCERN" },
        ],
      },
      {
        label: "Бие ба үс",
        href: "/body-hair",
        groups: [{ title: "Ангилал", kind: "CATEGORY", navGroup: "body-hair" }],
      },
      { label: "Үйлчилгээ", href: "/services" },
      { label: "Бидний тухай", href: "/about" },
      { label: "Холбоо барих", href: "/contact" },
    ],
  },
  hero: {
    image: { src: "/placeholders/hero.svg", alt: "Арьс арчилгааны ритуал — hero зураг" },
    title: ["Арьс бүр өвөрмөц", "Арчилгаа ч мөн адил"],
    cta: { label: "Дэлгүүр үзэх", href: "/face" },
  },
  promoTrio: {
    items: [
      {
        image: { src: "/placeholders/promo-1.svg", alt: "Lotion P50 цуглуулга" },
        title: "Lotion P50",
        text: "Арьсны тэнцвэрийг сэргээх брэндийн хамгийн алдартай лосьон.",
        cta: { label: "Дэлгэрэнгүй", href: "/collections/lotion-p50" },
      },
      {
        image: { src: "/placeholders/promo-2.svg", alt: "Серумын цуглуулга" },
        title: "Серумын цуглуулга",
        text: "Арьсны асуудал бүрт зориулсан өндөр идэвхт серумууд.",
        cta: { label: "Серум үзэх", href: "/collections/serums" },
      },
      {
        image: { src: "/placeholders/promo-3.svg", alt: "Бэлгийн багц" },
        title: "Бэлгийн багц",
        text: "Хайртай хүмүүстээ зориулсан тусгай хайрцагтай бэлэг.",
        cta: { label: "Бэлэг сонгох", href: "/gifts" },
      },
    ],
  },
  splitPromo: {
    eyebrow: "Хязгаарлагдмал",
    title: "Өвлийн арчилгааны багц",
    text: "Хүйтэн, хуурай агаарт арьсаа хамгаалах чийгшүүлэх протокол. Тоо хэмжээ хязгаартай.",
    cta: { label: "Багц үзэх", href: "/gifts" },
    image: { src: "/placeholders/split.svg", alt: "Өвлийн арчилгааны багц" },
  },
  featuredProduct: {
    title: "Шинэ серум",
    productSlug: "progeskin",
    image: { src: "/placeholders/featured.svg", alt: "Progeskin серумын lifestyle зураг" },
  },
  iconicCarousel: {
    title: "Иконик бүтээгдэхүүн",
    cta: { label: "Бүгдийг харах", href: "/face" },
  },
  salonBanner: {
    eyebrow: "Шинэ",
    title: "Манай салон",
    text: "Улаанбаатарын төвд байрлах манай салонд брэндийн протоколоор мэргэшсэн гоо сайханчид үйлчилнэ.",
    cta: { label: "Үйлчилгээ үзэх", href: "/services" },
    image: { src: "/placeholders/salon.svg", alt: "Салоны дотор орчин" },
  },
  concernGrid: { title: "Арьсны асуудлаар сонгох", labelPrefix: "Протокол" },
  categoryGrid: { title: "Ангиллаар сонгох" },
  servicesBanner: {
    title: "Салоны үйлчилгээ",
    text: "Арьсны оношлогооноос эхлэн бүрэн протокол хүртэл.",
    cta: { label: "Бүгдийг харах", href: "/services" },
    image: { src: "/placeholders/services.svg", alt: "Салоны үйлчилгээ" },
  },
  benefits: {
    items: [
      { icon: "gift", lines: ["Захиалга бүрт", "3 дээж бэлэг"] },
      { icon: "package", lines: ["Бэлгийн хайрцаг", "үнэгүй"] },
      { icon: "scan-face", lines: ["Салон дээр", "арьсны оношлогоо"] },
      { icon: "shield-check", lines: ["QPay-ээр", "аюулгүй төлбөр"] },
    ],
  },
  footer: {
    columns: [
      {
        title: "Дэлгүүр",
        links: [
          { label: "Нүүрний арчилгаа", href: "/face" },
          { label: "Бие ба үс", href: "/body-hair" },
          { label: "Бэлэг", href: "/gifts" },
        ],
      },
      {
        title: "Үйлчилгээ",
        links: [
          { label: "Салоны үйлчилгээ", href: "/services" },
          { label: "Арьсны оношлогоо", href: "/services" },
        ],
      },
      {
        title: "Компани",
        links: [
          { label: "Бидний тухай", href: "/about" },
          { label: "Хүргэлт ба буцаалт", href: "/shipping" },
          { label: "Нууцлалын бодлого", href: "/privacy" },
        ],
      },
    ],
    contact: {
      title: "Холбоо барих",
      address: "Улаанбаатар, Сүхбаатар дүүрэг (хаяг тодорхойлогдоно)",
      phone: "+976 0000 0000",
      email: "info@example.mn",
      hours: ["Даваа–Баасан 10:00–20:00", "Бямба–Ням 11:00–18:00"],
    },
    socials: [
      { network: "instagram", href: "https://instagram.com/", label: "Instagram" },
      { network: "facebook", href: "https://facebook.com/", label: "Facebook" },
    ],
    newsletter: {
      title: "Мэдээлэл авах",
      text: "Шинэ бүтээгдэхүүн, урамшууллын мэдээг имэйлээр аваарай.",
      placeholder: "Имэйл хаяг",
      button: "Бүртгүүлэх",
    },
    copyright: "Biologique Recherche Mongolia. Бүх эрх хуулиар хамгаалагдсан.",
  },
};

async function seedSettings() {
  for (const [key, value] of Object.entries(settings)) {
    await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}

// ─────────────────────────────────────────────────────────────

async function main() {
  await seedUsers();
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@example.mn" } });
  await seedCollections();
  await seedProducts(admin.id);
  await seedServices();
  await seedCommissionRules();
  await seedSettings();

  const counts = await Promise.all([
    db.user.count(),
    db.collection.count(),
    db.product.count(),
    db.variant.count(),
    db.service.count(),
    db.siteSetting.count(),
  ]);
  console.log(
    `Seed дууслаа: users=${counts[0]} collections=${counts[1]} products=${counts[2]} variants=${counts[3]} services=${counts[4]} settings=${counts[5]}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
