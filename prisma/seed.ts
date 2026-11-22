/**
 * Idempotent seed: олон удаа ажиллуулж болно (upsert / тогтмол id).
 * Ажиллуулах: `bun run db:seed`
 *
 * Анхаар: бүх текст, үнэ нь PLACEHOLDER. Бодит үнэ, тайлбар, зургийг
 * дистрибьютер админ хэсгээс оруулна.
 */
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../src/generated/prisma/client";
import { CLINICAL_NOTE, ENVIRONMENTAL, PERFECT_MATCH, bundleItems, collections, products } from "./seed-data/catalog";
import type { SiteSettings } from "../src/lib/site-settings";

// Production DB-д seed санамсаргүй ажиллахаас хамгаална (туршилтын үйлчлүүлэгч, тест нууц үг үүсгэдэг)
if (process.env.NODE_ENV === "production") {
  throw new Error("Seed нь NODE_ENV=production үед ажиллахгүй.");
}

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

// ───────────────────────── Каталог ─────────────────────────

function skuFor(slug: string, size: string) {
  // SKU латин үсэгтэй: "30 мл" → "30ML", "1 багц" → "SET"
  const latin = size.replace(/мл/gi, "ml").replace(/1\s*багц/i, "set").replace(/\s+/g, "");
  return `BR-${slug}-${latin}`.toUpperCase();
}

const TX = { maxWait: 15_000, timeout: 60_000 } as const;

// ───────────────────────── Салбар, POS ─────────────────────────

/** StockMovement-д ашиглана (seedBranch-аар оноогдоно) */
let BRANCH_ID = "";

async function seedBranch() {
  // Нэр, хаяг, утсыг админ дараа нь засна — зөвхөн байхгүй үед үүсгэнэ
  const branch = await db.branch.upsert({
    where: { code: "CL" },
    create: { code: "CL", name: "CLÉSS", address: "Улаанбаатар (хаяг тодорхойлогдоно)", phone: "+976 0000 0000" },
    update: {},
  });
  BRANCH_ID = branch.id;
}

/** POS, татвар, QPay тохиргоо — create-only (админы засварыг дарж бичихгүй) */
async function seedPosSettings() {
  const values: Record<string, object> = {
    pos: { maxManagerDiscountPercent: 10, allowNegativeStock: false, staleLockMinutes: 30 },
    tax: { vatIncluded: true, vatRateBp: 1000 },
    qpay: { mode: "manual" },
  };
  for (const [key, value] of Object.entries(values)) {
    await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

/** Туршилтын 3 үйлчлүүлэгч (dev) */
async function seedDemoCustomers() {
  const customers = [
    { phone: "99110001", name: "Туршилт Сараа", email: "test.saraa@example.mn", skinType: "COMBINATION" as const },
    { phone: "99110002", name: "Туршилт Болор", email: "test.bolor@example.mn", skinType: "SENSITIVE" as const },
    { phone: "99110003", name: "Туршилт Номин", email: null, skinType: "DRY" as const },
  ];
  for (const c of customers) {
    await db.customer.upsert({ where: { phone: c.phone }, create: c, update: {} });
  }
}

async function seedCollections() {
  // Эцэг ангиллыг эхэлж (жагсаалтын дарааллаар)
  for (const [i, c] of collections.entries()) {
    const parentId = c.parent ? (await db.collection.findUniqueOrThrow({ where: { slug: c.parent } })).id : null;
    const data = {
      name: c.name,
      kind: c.kind,
      parentId,
      heading: c.heading ?? null,
      intro: c.intro,
      seoText: c.seoText,
      bannerImage: c.banner ? `/placeholders/banner-${c.banner}.svg` : null,
      tileImage: c.tile ?? null,
      showInMenu: c.showInMenu ?? true,
      showOnHome: c.showOnHome ?? false,
      sortOrder: i,
    };
    await db.collection.upsert({ where: { slug: c.slug }, create: { slug: c.slug, ...data }, update: data });
  }

  // Серумын редакцийн нүд (grid-ийн 8 дахь нүд)
  const serum = await db.collection.findUniqueOrThrow({ where: { slug: "serum" } });
  const tile = {
    collectionId: serum.id,
    position: 8,
    image: "/placeholders/tile-serum-vivant.svg",
    eyebrow: "ШИНЭ",
    title: "SÉRUM VIVANT",
    text: "Батга гарах хандлагатай арьсанд зориулсан шинэ серум",
    ctaLabel: "Дэлгэрэнгүй",
    ctaHref: "/products/serum-vivant",
  };
  await db.collectionTile.upsert({ where: { id: "seed-tile-serum" }, create: { id: "seed-tile-serum", ...tile }, update: tile });
}

async function seedProducts(adminId: string) {
  const collectionIds = new Map(
    (await db.collection.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );
  const idOf = (slug: string) => {
    const id = collectionIds.get(slug);
    if (!id) throw new Error(`Collection олдсонгүй: ${slug}`);
    return id;
  };

  for (const [i, p] of products.entries()) {
    const n = i + 1;
    const data = {
      name: p.name,
      kind: p.kind ?? ("SINGLE" as const),
      badge: p.badge ?? null,
      tagline: p.tagline,
      recommendedFor: p.recommendedFor,
      benefits: p.benefits,
      description: p.description,
      skinScience: p.skinScience,
      howToUse: p.howToUse,
      ingredients: p.ingredients,
      environmental: ENVIRONMENTAL,
      clinicalNotes: p.clinical ? [CLINICAL_NOTE] : [],
      isPublished: true,
      sortOrder: i,
    };
    const product = await db.product.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: data });

    // Зураг: үндсэн + 2 өнцөг
    const images = [`/placeholders/product-${n}.svg`, `/placeholders/product-${n}-2.svg`, `/placeholders/product-${n}-3.svg`];
    for (const [k, url] of images.entries()) {
      const id = k === 0 ? `seed-img-${p.slug}` : `seed-img-${p.slug}-${k + 1}`;
      const img = { url, alt: `${p.name} — ${k === 0 ? "бүтээгдэхүүний зураг" : `зураг ${k + 1}`}`, sortOrder: k };
      await db.productImage.upsert({ where: { id }, create: { id, productId: product.id, ...img }, update: img });
    }

    // Ангилал (position = ангилал доторх дараалал; CONCERN-д арчилгааны алхам)
    const memberships = [
      ...p.categories.map((slug) => ({ collectionId: idOf(slug), position: i })),
      ...p.concerns.map((slug) => ({ collectionId: idOf(slug), position: p.step * 100 + i })),
    ];
    await db.productCollection.deleteMany({
      where: { productId: product.id, collectionId: { notIn: memberships.map((m) => m.collectionId) } },
    });
    for (const m of memberships) {
      await db.productCollection.upsert({
        where: { productId_collectionId: { productId: product.id, collectionId: m.collectionId } },
        create: { productId: product.id, ...m },
        update: { position: m.position },
      });
    }

    for (const [vi, v] of p.variants.entries()) {
      const sku = skuFor(p.slug, v.size);
      const existing = await db.variant.findUnique({ where: { sku } });
      if (existing) {
        // Үнэ, үлдэгдлийг дахин seed-д өөрчлөхгүй (PriceHistory / StockMovement-ээр л)
        await db.variant.update({ where: { sku }, data: { size: v.size, sortOrder: vi, isActive: true } });
        continue;
      }
      await db.$transaction(async (tx) => {
        const variant = await tx.variant.create({
          data: { productId: product.id, sku, size: v.size, price: v.price, costPrice: v.cost, stock: v.stock, sortOrder: vi },
        });
        await tx.priceHistory.create({
          data: { variantId: variant.id, oldPrice: 0, newPrice: v.price, oldCost: 0, newCost: v.cost, changedById: adminId },
        });
        if (v.stock > 0) {
          await tx.stockMovement.create({
            data: { branchId: BRANCH_ID, variantId: variant.id, type: "PURCHASE", qty: v.stock, unitCost: v.cost, note: "Seed: анхны үлдэгдэл", createdById: adminId },
          });
        }
      }, TX);
    }
  }
}

async function seedBundles() {
  for (const [bundleSlug, items] of Object.entries(bundleItems)) {
    const bundle = await db.product.findUniqueOrThrow({ where: { slug: bundleSlug } });
    const wanted: { variantId: string; qty: number; position: number }[] = [];
    for (const [pos, [slug, size, qty]] of items.entries()) {
      const variant = await db.variant.findUniqueOrThrow({ where: { sku: skuFor(slug, size) } });
      wanted.push({ variantId: variant.id, qty, position: pos });
    }
    await db.bundleItem.deleteMany({ where: { bundleProductId: bundle.id, variantId: { notIn: wanted.map((w) => w.variantId) } } });
    for (const w of wanted) {
      await db.bundleItem.upsert({
        where: { bundleProductId_variantId: { bundleProductId: bundle.id, variantId: w.variantId } },
        create: { bundleProductId: bundle.id, ...w },
        update: { qty: w.qty, position: w.position },
      });
    }
  }
}

/**
 * PROTOCOL: эхний арьсны хэрэгцээний алхмын дараалал (≤5).
 * SIMILAR: ижил үндсэн (хамгийн гүн) CATEGORY-ийн бусад бараа — PROTOCOL-д орсныг хасна.
 *   Хүрэлцэхгүй бол эцэг ангиллын модны бусад бараагаар нөхнө.
 * BUNDLE_SUGGESTION ("Төгс хослол"): PERFECT_MATCH-ийн тодорхой хослол, эсвэл батганы багц.
 */
async function seedRelations() {
  const ids = new Map((await db.product.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
  const parentOf = new Map(collections.map((c) => [c.slug, c.parent]));
  /** Ангилал + түүний бүх үр удам */
  const subtree = (root: string) => {
    const out = new Set([root]);
    // Массивын дарааллаас үл хамааран шинэ үр удам нэмэгдэхээ болтол давтана
    let size = 0;
    while (size !== out.size) {
      size = out.size;
      for (const c of collections) if (c.parent && out.has(c.parent)) out.add(c.slug);
    }
    return out;
  };

  for (const p of products) {
    const id = ids.get(p.slug)!;
    const concern = p.concerns[0];
    const protocol = concern
      ? products
          .filter((o) => o.slug !== p.slug && o.kind !== "BUNDLE" && o.concerns.includes(concern))
          .sort((a, b) => a.step - b.step)
          .slice(0, 5)
      : [];

    const taken = new Set([p.slug, ...protocol.map((o) => o.slug)]);
    const pool = products.filter((o) => !taken.has(o.slug) && o.kind !== "BUNDLE");
    const similar: typeof products = [];
    // Хамгийн гүн ангиллаас эхлээд эцэг рүү өгсөж нөхнө (Хөгшрөлтийн эсрэг → Серум → Нүүрний арчилгаа)
    for (let cat: string | undefined = p.categories[p.categories.length - 1]; cat && similar.length < 8; cat = parentOf.get(cat)) {
      const tree = subtree(cat);
      for (const o of pool) {
        if (similar.length >= 8) break;
        if (!similar.includes(o) && o.categories.some((c) => tree.has(c))) similar.push(o);
      }
    }

    const match = PERFECT_MATCH[p.slug] ?? (p.kind !== "BUNDLE" && p.concerns.includes("blemishes") ? "routine-imperfections" : undefined);
    // PROTOCOL-д аль хэдийн байгаа барааг "Төгс хослол"-д давтахгүй
    const suggestion = match && !taken.has(match) && ids.has(match) ? [match] : [];

    const rows = [
      ...protocol.map((o, k) => ({ relatedId: ids.get(o.slug)!, type: "PROTOCOL" as const, position: k })),
      ...similar.map((o, k) => ({ relatedId: ids.get(o.slug)!, type: "SIMILAR" as const, position: k })),
      ...suggestion.map((s, k) => ({ relatedId: ids.get(s)!, type: "BUNDLE_SUGGESTION" as const, position: k })),
    ];
    await db.$transaction([
      db.productRelation.deleteMany({ where: { productId: id } }),
      db.productRelation.createMany({ data: rows.map((r) => ({ productId: id, ...r })) }),
    ]);
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
      { sku: skuFor("lait-vip-o2", "250 мл"), qty: 0.04 },
      { sku: skuFor("lotion-p50", "250 мл"), qty: 0.03 },
      { sku: skuFor("creme-masque-vernix", "100 мл"), qty: 0.1 },
    ],
  },
  {
    slug: "facial-anti-ageing-90",
    name: "Нүүрний эмчилгээ — Хөгшрөлтийн эсрэг",
    description: "Чангалах, дүүргэх үр дүнтэй 90 минутын бүрэн протокол.",
    durationMin: 90,
    price: 380_000,
    consumables: [
      { sku: skuFor("lait-vip-o2", "250 мл"), qty: 0.04 },
      { sku: skuFor("lotion-p50", "250 мл"), qty: 0.03 },
      { sku: skuFor("progeskin", "30 мл"), qty: 0.05 },
      { sku: skuFor("creme-mec", "50 мл"), qty: 0.04 },
    ],
  },
  {
    slug: "pigmentation-protocol-75",
    name: "Пигментацийн протокол",
    description: "Толбо, жигд бус өнгийг багасгах 75 минутын эмчилгээ.",
    durationMin: 75,
    price: 320_000,
    consumables: [
      { sku: skuFor("lotion-p50-pigm-400", "250 мл"), qty: 0.04 },
      { sku: skuFor("masque-vivant", "100 мл"), qty: 0.1 },
    ],
  },
  {
    slug: "purifying-facial-60",
    name: "Цэвэршүүлэх нүүрний эмчилгээ",
    description: "Батга, нүх сүвний асуудалтай арьсанд зориулсан 60 минутын эмчилгээ.",
    durationMin: 60,
    price: 230_000,
    consumables: [
      { sku: skuFor("lotion-p50", "250 мл"), qty: 0.03 },
      { sku: skuFor("serum-vivant", "30 мл"), qty: 0.05 },
      { sku: skuFor("masque-vivant", "100 мл"), qty: 0.1 },
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
      "Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютер",
    ],
  },
  brand: {
    wordmark: ["BIOLOGIQUE", "RECHERCHE", "PARIS"],
    siteName: "Biologique Recherche Mongolia",
    description: "Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютер — СПА салон ба онлайн дэлгүүр.",
  },
  navigation: {
    items: [
      { label: "Бэлэг", href: "/collections/gifts" },
      {
        label: "Нүүрний арчилгаа",
        href: "/collections/face-care",
        groups: [
          { title: "Ангилал", kind: "CATEGORY", parentSlug: "face-care" },
          { title: "Арьсны хэрэгцээгээр", kind: "CONCERN" },
        ],
      },
      {
        label: "Бие ба үс",
        href: "/collections/body",
        groups: [{ title: "Ангилал", kind: "CATEGORY", slugs: ["body", "hair"] }],
      },
      { label: "Үйлчилгээ", href: "/services" },
      { label: "Бидний тухай", href: "/about" },
      { label: "Холбоо барих", href: "/contact" },
    ],
  },
  hero: {
    image: { src: "/placeholders/hero.svg", alt: "Арьс арчилгааны ритуал — hero зураг" },
    title: ["Арьс бүр өвөрмөц", "Арчилгаа ч мөн адил"],
    cta: { label: "Дэлгүүр үзэх", href: "/collections" },
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
        cta: { label: "Серум үзэх", href: "/collections/serum" },
      },
      {
        image: { src: "/placeholders/promo-3.svg", alt: "Бэлгийн багц" },
        title: "Бэлгийн багц",
        text: "Хайртай хүмүүстээ зориулсан тусгай хайрцагтай бэлэг.",
        cta: { label: "Бэлэг сонгох", href: "/collections/gifts" },
      },
    ],
  },
  splitPromo: {
    eyebrow: "Хязгаарлагдмал",
    title: "Өвлийн арчилгааны багц",
    text: "Хүйтэн, хуурай агаарт арьсаа хамгаалах чийгшүүлэх протокол. Тоо хэмжээ хязгаартай.",
    cta: { label: "Багц үзэх", href: "/collections/gifts" },
    image: { src: "/placeholders/split.svg", alt: "Өвлийн арчилгааны багц" },
  },
  featuredProduct: {
    title: "Шинэ серум",
    productSlug: "progeskin",
    image: { src: "/placeholders/featured.svg", alt: "Progeskin серумын lifestyle зураг" },
  },
  iconicCarousel: {
    title: "Иконик бүтээгдэхүүн",
    cta: { label: "Бүгдийг харах", href: "/collections" },
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
  productBenefits: {
    // "Үнэгүй хүргэлт" нөхцөл тодорхой болмогц админаас нэмнэ (#13)
    items: [
      { icon: "gift", label: "Захиалга бүрт 3 дээж бэлэг" },
      { icon: "shield-check", label: "Аюулгүй төлбөр" },
      { icon: "scan-face", label: "Салон дээр арьсны оношлогоо" },
    ],
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
        // Ангиллууд DB-ээс (Collection.slug) автоматаар нэмэгдэнэ
        collections: { kind: "CATEGORY" },
        links: [{ label: "Бүх ангилал", href: "/collections" }],
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
    // Create-only: админы засварласан контентыг seed дахин ажиллахад дарж бичихгүй
    await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

// ─────────────────────────────────────────────────────────────

async function main() {
  await seedBranch();
  await seedPosSettings();
  await seedUsers();
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@example.mn" } });
  await seedCollections();
  await seedProducts(admin.id);
  await seedBundles();
  await seedRelations();
  await seedServices();
  await seedCommissionRules();
  await seedSettings();
  await seedDemoCustomers();

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
