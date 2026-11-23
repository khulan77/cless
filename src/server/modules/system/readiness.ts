/**
 * "Нээлтийн бэлэн байдал" — хянах самбар (ADMIN) ба scripts/preflight.ts хоёулаа ашиглана.
 * ЗӨВХӨН уншина.
 */
import { db } from "@/server/db";
import { workerStatus } from "@/server/modules/outbox/heartbeat";
import { qpayEnvConfigured } from "@/server/modules/payments/providers/qpay";
import { getEmailSettings, getQPaySettings, getSystemSettings } from "@/server/modules/settings/pos-settings";
import type { FooterSetting } from "@/lib/site-settings";
import { bookingSettingsSchema } from "@/server/modules/settings/schema";

export type ReadinessItem = { key: string; ok: boolean; label: string; detail?: string; href: string };

/** Seed-ийн туршилтын өгөгдлийн тэмдэг */
export const SEED_EMAIL_DOMAIN = "@example.mn";
export const DEMO_CUSTOMER_PHONES = ["99110001", "99110002", "99110003"];

export async function readiness(now = new Date()): Promise<{ items: ReadinessItem[]; ready: boolean; launchedAt: string | null }> {
  const [branch, footerRow, services, staff, products, emailSettings, qpayRow, qpay, worker, seedUsers, demoCustomers, sales, system, bookingRow] = await Promise.all([
    db.branch.findFirst({ where: { code: "CL" } }),
    db.siteSetting.findUnique({ where: { key: "footer" } }),
    db.service.count({ where: { isActive: true, bookable: true } }),
    db.user.count({ where: { isActive: true, isBookable: true, schedules: { some: {} } } }),
    db.product.count({ where: { isPublished: true, images: { some: { url: { not: { startsWith: "/placeholders/" } } } } } }),
    getEmailSettings(),
    db.siteSetting.findUnique({ where: { key: "qpay" } }),
    getQPaySettings(),
    workerStatus(now),
    db.user.count({ where: { isActive: true, email: { endsWith: SEED_EMAIL_DOMAIN } } }),
    db.customer.count({ where: { phone: { in: DEMO_CUSTOMER_PHONES } } }),
    db.sale.count({ where: { status: { not: "DRAFT" } } }),
    getSystemSettings(),
    db.siteSetting.findUnique({ where: { key: "booking" } }),
  ]);
  // Сайтын зураг: dev placeholder (/placeholders/…) зураг тооцогдохгүй
  const realImage = { url: { not: { startsWith: "/placeholders/" } } };
  const [publicProducts, productsWithImage, heroRow] = await Promise.all([
    db.product.count({ where: { isPublished: true } }),
    db.product.count({ where: { isPublished: true, images: { some: realImage } } }),
    db.siteSetting.findUnique({ where: { key: "hero" } }),
  ]);
  const heroSrc = (heroRow?.value as { image?: { src?: string } } | undefined)?.image?.src ?? "";
  const heroOk = Boolean(heroSrc) && !heroSrc.startsWith("/placeholders/");
  const imagePct = publicProducts ? Math.floor((productsWithImage / publicProducts) * 100) : 0;
  const contact = (footerRow?.value as FooterSetting | undefined)?.contact;
  const openDays = Object.values(bookingSettingsSchema.parse(bookingRow?.value ?? {}).hours).filter((d) => d && d.length > 0).length;
  const salonOk = Boolean(branch?.name && branch.address && branch.phone && contact?.email && openDays > 0);
  const emailFrom = emailSettings.fromAddress || process.env.EMAIL_FROM;
  const emailOk = Boolean(process.env.RESEND_API_KEY && emailFrom);
  const qpayOk = Boolean(qpayRow) && (qpay.mode === "manual" || qpayEnvConfigured());
  const leftovers = [
    seedUsers ? `${seedUsers} seed хэрэглэгч (${SEED_EMAIL_DOMAIN})` : null,
    demoCustomers ? `${demoCustomers} туршилтын үйлчлүүлэгч` : null,
    sales && !system.launchedAt ? `${sales} туршилтын борлуулалт (scripts/reset-transactions.ts)` : null,
  ].filter(Boolean) as string[];

  const items: ReadinessItem[] = [
    { key: "salon", ok: salonOk, label: "Салоны мэдээлэл (нэр, хаяг, утас, имэйл, ажлын цаг)", href: "/admin/settings?tab=salon" },
    { key: "services", ok: services > 0, label: "Цаг захиалж болох ≥1 идэвхтэй үйлчилгээ", detail: `${services}`, href: "/admin/services" },
    { key: "staff", ok: staff > 0, label: "Хуваарьтай ≥1 bookable ажилтан", detail: `${staff}`, href: "/admin/staff-schedules" },
    { key: "products", ok: products > 0, label: "Зурагтай ≥1 нийтлэгдсэн бүтээгдэхүүн", detail: `${products}`, href: "/admin/products" },
    { key: "hero", ok: heroOk, label: "Нүүр хуудасны hero зурагтай", detail: heroOk ? undefined : "placeholder эсвэл хоосон", href: "/admin/content" },
    {
      key: "productImages",
      ok: publicProducts > 0 && imagePct >= 90,
      label: "≥90% нийтэд харагдах бүтээгдэхүүн зурагтай",
      detail: `${productsWithImage}/${publicProducts} (${imagePct}%)`,
      href: "/admin/products",
    },
    {
      key: "email",
      ok: emailOk,
      label: "Имэйл тохирсон (Resend түлхүүр + илгээгч)",
      detail: emailOk ? emailFrom : !process.env.RESEND_API_KEY ? "RESEND_API_KEY алга" : "Илгээгч алга",
      href: "/admin/settings?tab=email",
    },
    { key: "qpay", ok: qpayOk, label: "QPay горим сонгосон", detail: qpay.mode === "api" ? "API" : "Гараар", href: "/admin/settings?tab=qpay" },
    {
      key: "worker",
      ok: !worker.stale,
      label: "Worker ажиллаж байна",
      detail: worker.minutesAgo === null ? "хэзээ ч ажиллаагүй" : `${worker.minutesAgo} мин өмнө`,
      href: "/admin/system",
    },
    { key: "testData", ok: leftovers.length === 0, label: "Туршилтын/seed өгөгдөл үлдээгүй", detail: leftovers.join(", ") || undefined, href: "/admin/users" },
  ];
  return { items, ready: items.every((i) => i.ok), launchedAt: system.launchedAt };
}

/** ADMIN: "Нээлт хийгдсэн" — үүнээс хойш seed / reset-transactions ажиллахгүй. Бүх шалгалт OK үед л. */
export async function markLaunched(actorId: string, now = new Date()) {
  const { ready, launchedAt } = await readiness(now);
  if (launchedAt) return launchedAt;
  if (!ready) {
    const { UserError } = await import("@/server/errors");
    throw new UserError("Нээлтийн бэлэн байдлын бүх шалгалт биелээгүй байна.");
  }
  const { audit } = await import("@/server/audit");
  const value = { launchedAt: now.toISOString() };
  await db.$transaction(async (tx) => {
    await tx.siteSetting.upsert({ where: { key: "system" }, create: { key: "system", value }, update: { value } });
    await audit(tx, { userId: actorId, action: "system.launched", entity: "SiteSetting", entityId: "system", after: value });
  });
  return value.launchedAt;
}
