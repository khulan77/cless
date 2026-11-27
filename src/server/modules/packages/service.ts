/**
 * Багц үйлчилгээ (PROMPT 27 §4, docs/plan-packages.md).
 *
 * Загвар (PackageTemplate): нэр, үйлчилгээ (1+), төлөх тоо + бонус = нийт удаа, үнэ (анхдагч = үйлчилгээний үнэ ×
 *   төлөх тоо), хүчинтэй хоног. ACCOUNTANT / ADMIN.
 * Худалдах: POS-ийн мөр (SaleItem SERVICE + packageTemplateId). Борлуулалт БҮТЭН төлөгдөхөд (applyPayment → PAID)
 *   CustomerPackage үүснэ: нийт удаа, ашигласан 0, дуусах огноо, төлсөн дүн (мөрийн бодит дүн).
 * Ашиглах: цагт багц холбоно (Appointment.customerPackageId) → цаг «Орсон» (DONE) болоход 1 удаа хасна.
 *   «Ороогүй» — тохиргоо (анхдагч: хасахгүй). Цуцалсан — хасахгүй. Нэг цагт нэг redemption (unique) +
 *   CustomerPackage мөрийг FOR UPDATE түгжинэ.
 * Орлого: 1 удаагийн өртөг = төлсөн ÷ нийт удаа (бонус удаа үнэ буулгана); сүүлийн удаа үлдэгдлийг авна —
 *   бүх удаагийн нийлбэр = төлсөн дүн. Худалдах үеийн мөнгө — «Курс/багц — урьдчилгаа».
 * Буцаах (ADMIN): үлдсэн дүн (төлсөн − ашигласан удаагийн өртөг) − торгууль % → Refund + REFUNDED.
 */
import { z } from "zod";
import type { PayMethod, Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { enqueue } from "@/server/modules/outbox/service";

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof db;

// ───────────────────────── Тохиргоо ─────────────────────────

const SETTINGS_KEY = "packages";
export const packageSettingsSchema = z.object({
  /** «Ороогүй» цагт багцаас хасах эсэх (анхдагч — үгүй) */
  noShowConsumes: z.boolean().catch(false).default(false),
  /** Багц цуцлахад торгууль (%) */
  refundPenaltyPct: z.number().min(0).max(100).catch(0).default(0),
});
export type PackageSettings = z.infer<typeof packageSettingsSchema>;

export async function getPackageSettings(client: Client = db): Promise<PackageSettings> {
  const row = await client.siteSetting.findUnique({ where: { key: SETTINGS_KEY }, select: { value: true } });
  return packageSettingsSchema.parse(row?.value ?? {});
}

export async function savePackageSettings(raw: z.input<typeof packageSettingsSchema>, actorId: string) {
  const value = packageSettingsSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const before = await tx.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
    await tx.siteSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
    await audit(tx, { userId: actorId, action: "package.settings", entity: "SiteSetting", entityId: SETTINGS_KEY, before: before?.value, after: value });
  });
  return value;
}

// ───────────────────────── Загвар ─────────────────────────

export const templateSchema = z
  .object({
    name: z.string().trim().min(2, "Нэр заавал.").max(120),
    description: z.string().trim().max(1000).nullish().transform((v) => v || null),
    serviceIds: z.array(z.string().min(1)).min(1, "Үйлчилгээ сонгоно уу.").max(20),
    paidSessions: z.coerce.number().int().min(1, "1-ээс багагүй.").max(200),
    bonusSessions: z.coerce.number().int().min(0).max(100).default(0),
    /** null = анхдагч (үйлчилгээний үнэ × төлөх тоо) */
    price: z.coerce.number().int().min(0).max(1_000_000_000).nullish(),
    validDays: z.coerce.number().int().min(1).max(3650).nullish().transform((v) => v ?? null),
    isActive: z.boolean().default(true),
    isPublic: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
  });

/** Анхдагч үнэ: үйлчилгээ (эхнийх) × төлөх тоо */
export async function defaultPackagePrice(serviceIds: string[], paidSessions: number, client: Client = db) {
  const s = await client.service.findFirst({ where: { id: serviceIds[0] }, select: { price: true } });
  return (s?.price ?? 0) * paidSessions;
}

export async function saveTemplate(id: string | null, raw: z.input<typeof templateSchema>, actorId: string) {
  const v = templateSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const services = await tx.service.findMany({ where: { id: { in: v.serviceIds } }, select: { id: true } });
    if (services.length !== v.serviceIds.length) throw new UserError("Үйлчилгээ олдсонгүй.");
    const price = v.price ?? (await defaultPackagePrice(v.serviceIds, v.paidSessions, tx));
    const data = { name: v.name, description: v.description, paidSessions: v.paidSessions, bonusSessions: v.bonusSessions, price, validDays: v.validDays, isActive: v.isActive, isPublic: v.isPublic, sortOrder: v.sortOrder };
    const before = id ? await tx.packageTemplate.findUnique({ where: { id }, include: { services: true } }) : null;
    if (id && !before) throw new UserError("Багц олдсонгүй.");
    const t = id ? await tx.packageTemplate.update({ where: { id }, data }) : await tx.packageTemplate.create({ data });
    await tx.packageTemplateService.deleteMany({ where: { packageId: t.id } });
    await tx.packageTemplateService.createMany({ data: v.serviceIds.map((serviceId) => ({ packageId: t.id, serviceId })) });
    await audit(tx, {
      userId: actorId,
      action: id ? "package.template.update" : "package.template.create",
      entity: "PackageTemplate",
      entityId: t.id,
      before: before ? { name: before.name, price: before.price, paidSessions: before.paidSessions, bonusSessions: before.bonusSessions, validDays: before.validDays, isActive: before.isActive } : null,
      after: { ...data, serviceIds: v.serviceIds },
    });
    return t;
  });
}

export async function listTemplates(opts: { activeOnly?: boolean; publicOnly?: boolean } = {}) {
  return db.packageTemplate.findMany({
    where: { ...(opts.activeOnly ? { isActive: true } : {}), ...(opts.publicOnly ? { isPublic: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { services: { include: { service: { select: { id: true, name: true, price: true } } } }, _count: { select: { customerPackages: true } } },
  });
}

// ───────────────────────── Худалдах → идэвхжүүлэх ─────────────────────────

/** Борлуулалт бүтэн төлөгдөхөд (applyPayment-ийн transaction дотор). Idempotent (saleItemId unique). */
export async function activatePackagesForSale(tx: Tx, saleId: string, now = new Date()) {
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    select: {
      customerId: true,
      items: { where: { packageTemplateId: { not: null } }, select: { id: true, qty: true, lineTotal: true, packageTemplate: { include: { services: true } } } },
    },
  });
  if (!sale || sale.items.length === 0) return 0;
  if (!sale.customerId) throw new UserError("Багц худалдахад үйлчлүүлэгч заавал.");
  let created = 0;
  for (const it of sale.items) {
    const t = it.packageTemplate!;
    const exists = await tx.customerPackage.findUnique({ where: { saleItemId: it.id }, select: { id: true } });
    if (exists) continue;
    const total = t.paidSessions + t.bonusSessions;
    await tx.customerPackage.create({
      data: {
        customerId: sale.customerId,
        templateId: t.id,
        saleItemId: it.id,
        name: t.name,
        serviceIds: t.services.map((s) => s.serviceId),
        totalSessions: total * it.qty,
        paidAmount: it.lineTotal,
        purchasedAt: now,
        expiresAt: t.validDays ? new Date(now.getTime() + t.validDays * 86_400_000) : null,
      },
    });
    created++;
  }
  return created;
}

// ───────────────────────── Ашиглах ─────────────────────────

const isUsable = (p: { status: string; expiresAt: Date | null; usedSessions: number; totalSessions: number }, now: Date) =>
  p.status === "ACTIVE" && (!p.expiresAt || p.expiresAt > now) && p.usedSessions < p.totalSessions;

/** Тухайн үйлчилгээнд тохирох идэвхтэй багцууд — хамгийн түрүүнд дуусахыг эхэнд */
export async function usablePackages(customerId: string, serviceId: string, now = new Date(), client: Client = db) {
  const rows = await client.customerPackage.findMany({
    where: { customerId, status: "ACTIVE", serviceIds: { has: serviceId }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { purchasedAt: "asc" }],
    select: { id: true, name: true, totalSessions: true, usedSessions: true, expiresAt: true, status: true },
  });
  return rows.filter((p) => isUsable(p, now)).map((p) => ({ id: p.id, name: p.name, used: p.usedSessions, total: p.totalSessions, left: p.totalSessions - p.usedSessions, expiresAt: p.expiresAt }));
}

/** Цагт багц холбох / салгах (MANAGER). null — салгана. Хасалт «Орсон» үед. */
export async function attachPackage(appointmentId: string, customerPackageId: string | null, actorId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const a = await tx.appointment.findUnique({ where: { id: appointmentId }, select: { id: true, customerId: true, serviceId: true, status: true, customerPackageId: true, packageRedemption: { select: { reversedAt: true } } } });
    if (!a) throw new UserError("Цаг олдсонгүй.");
    if (a.packageRedemption && !a.packageRedemption.reversedAt) throw new UserError("Энэ цагт багцаас аль хэдийн хасагдсан.");
    if (customerPackageId) {
      const ok = (await usablePackages(a.customerId, a.serviceId, now, tx)).some((p) => p.id === customerPackageId);
      if (!ok) throw new UserError("Энэ үйлчилгээнд ашиглах идэвхтэй багц олдсонгүй (хугацаа дууссан эсвэл үлдэгдэлгүй).");
    }
    await tx.appointment.update({ where: { id: appointmentId }, data: { customerPackageId } });
    await audit(tx, { userId: actorId, action: customerPackageId ? "package.attach" : "package.detach", entity: "Appointment", entityId: appointmentId, before: { customerPackageId: a.customerPackageId }, after: { customerPackageId } });
    // Аль хэдийн «Орсон» бол шууд хасна
    if (customerPackageId && a.status === "DONE") await redeemForAppointment(tx, appointmentId, actorId, now);
  });
}

/** 1 удаагийн өртөг: floor(төлсөн ÷ нийт); сүүлийн удаа — үлдэгдэл (нийлбэр = төлсөн) */
export function unitValueFor(p: { paidAmount: number; totalSessions: number }, usedBefore: number, valuedBefore: number) {
  const isLast = usedBefore + 1 >= p.totalSessions;
  return isLast ? p.paidAmount - valuedBefore : Math.floor(p.paidAmount / p.totalSessions);
}

/**
 * Цаг «Орсон» (эсвэл тохиргоогоор «Ороогүй») болоход — appointments service-ийн төлөв солих transaction дотор.
 * Холбосон багцгүй, аль хэдийн хассан, хүчингүй бол юу ч хийхгүй (давхар хасалтгүй).
 */
export async function redeemForAppointment(tx: Tx, appointmentId: string, actorId: string | null, now = new Date()) {
  const a = await tx.appointment.findUnique({ where: { id: appointmentId }, select: { id: true, customerPackageId: true, serviceId: true, staffId: true } });
  if (!a?.customerPackageId) return null;
  // Багцын мөрийг түгжинэ — зэрэг хасалт цуваа болно
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CustomerPackage" WHERE "id" = ${a.customerPackageId} FOR UPDATE`;
  if (!rows[0]) return null;
  const existing = await tx.packageRedemption.findUnique({ where: { appointmentId } });
  if (existing && !existing.reversedAt) return existing; // давхар «Орсон» — ганц хасалт
  const p = await tx.customerPackage.findUniqueOrThrow({ where: { id: a.customerPackageId } });
  if (!isUsable(p, now)) return null;
  const agg = await tx.packageRedemption.aggregate({ where: { customerPackageId: p.id, reversedAt: null }, _sum: { unitValue: true }, _count: true });
  const unitValue = unitValueFor(p, agg._count, agg._sum.unitValue ?? 0);
  const r = existing
    ? await tx.packageRedemption.update({ where: { id: existing.id }, data: { reversedAt: null, reverseReason: null, unitValue, staffId: a.staffId, serviceId: a.serviceId, createdById: actorId, createdAt: now } })
    : await tx.packageRedemption.create({ data: { customerPackageId: p.id, appointmentId, serviceId: a.serviceId, staffId: a.staffId, unitValue, createdById: actorId, createdAt: now } });
  const used = p.usedSessions + 1;
  await tx.customerPackage.update({ where: { id: p.id }, data: { usedSessions: used, status: used >= p.totalSessions ? "USED_UP" : "ACTIVE" } });
  await audit(tx, { userId: actorId, action: "package.redeem", entity: "CustomerPackage", entityId: p.id, after: { appointmentId, used, total: p.totalSessions, unitValue } });
  return r;
}

/** Цагийн төлөв солигдоход (DONE / NO_SHOW) — appointments service дуудна */
export async function onAppointmentStatus(tx: Tx, appointmentId: string, to: string, actorId: string | null, now = new Date()) {
  if (to === "DONE") return redeemForAppointment(tx, appointmentId, actorId, now);
  if (to === "NO_SHOW" && (await getPackageSettings(tx)).noShowConsumes) return redeemForAppointment(tx, appointmentId, actorId, now);
  return null;
}

export const reverseSchema = z.object({ redemptionId: z.string().min(1), reason: z.string().trim().min(5, "Шалтгаан заавал (5+ тэмдэгт).").max(300) });

/** Буруу хасалтыг буцаах (MANAGER, шалтгаантай) — мөр устахгүй */
export async function reverseRedemption(raw: z.input<typeof reverseSchema>, actorId: string) {
  const v = reverseSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const r = await tx.packageRedemption.findUnique({ where: { id: v.redemptionId } });
    if (!r) throw new UserError("Хасалт олдсонгүй.");
    if (r.reversedAt) throw new UserError("Аль хэдийн буцаасан.");
    await tx.$queryRaw`SELECT "id" FROM "CustomerPackage" WHERE "id" = ${r.customerPackageId} FOR UPDATE`;
    const p = await tx.customerPackage.findUniqueOrThrow({ where: { id: r.customerPackageId } });
    if (p.status === "REFUNDED") throw new UserError("Цуцалсан багцын хасалтыг буцаахгүй.");
    await tx.packageRedemption.update({ where: { id: r.id }, data: { reversedAt: new Date(), reverseReason: v.reason } });
    const used = Math.max(0, p.usedSessions - 1);
    await tx.customerPackage.update({ where: { id: p.id }, data: { usedSessions: used, status: p.status === "USED_UP" ? "ACTIVE" : p.status } });
    await audit(tx, { userId: actorId, action: "package.redeem_reverse", entity: "CustomerPackage", entityId: p.id, after: { redemptionId: r.id, reason: v.reason, used } });
  });
}

// ───────────────────────── Буцаалт (цуцлах) ─────────────────────────

export const refundPackageSchema = z.object({
  customerPackageId: z.string().min(1),
  method: z.enum(["CASH", "CARD", "TRANSFER", "QPAY"]),
  reason: z.string().trim().min(5, "Шалтгаан заавал (5+ тэмдэгт).").max(300),
});

/** Буцаах дүн: (төлсөн − ашигласан удаагийн өртөг) − торгууль % */
export function refundCalc(p: { paidAmount: number }, usedValue: number, penaltyPct: number) {
  const remaining = Math.max(0, p.paidAmount - usedValue);
  const penalty = Math.round((remaining * penaltyPct) / 100);
  return { remaining, penalty, refund: remaining - penalty };
}

export async function refundPackage(raw: z.input<typeof refundPackageSchema>, actorId: string) {
  const v = refundPackageSchema.parse(raw);
  const settings = await getPackageSettings();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CustomerPackage" WHERE "id" = ${v.customerPackageId} FOR UPDATE`;
    const p = await tx.customerPackage.findUnique({ where: { id: v.customerPackageId }, include: { saleItem: { select: { id: true, saleId: true } } } });
    if (!p) throw new UserError("Багц олдсонгүй.");
    if (p.status === "REFUNDED") throw new UserError("Аль хэдийн цуцалсан.");
    const used = await tx.packageRedemption.aggregate({ where: { customerPackageId: p.id, reversedAt: null }, _sum: { unitValue: true } });
    const calc = refundCalc(p, used._sum.unitValue ?? 0, settings.refundPenaltyPct);
    if (calc.refund > 0 && p.saleItem) {
      const sale = await tx.sale.findUniqueOrThrow({ where: { id: p.saleItem.saleId }, select: { id: true, paidAmount: true, refundedAmount: true, status: true } });
      if (sale.refundedAmount + calc.refund > sale.paidAmount) throw new UserError("Буцаалт төлсөн дүнгээс хэтэрнэ.");
      await tx.refund.create({
        data: {
          saleId: sale.id,
          amount: calc.refund,
          method: v.method as PayMethod,
          status: "COMPLETED",
          reason: `Багц цуцалсан: ${v.reason}`,
          items: [{ saleItemId: p.saleItem.id, qty: 0, amount: calc.refund }],
          restock: false,
          requestedById: actorId,
          approvedById: actorId,
          completedAt: new Date(),
        },
      });
      await tx.sale.update({ where: { id: sale.id }, data: { refundedAmount: sale.refundedAmount + calc.refund, status: sale.refundedAmount + calc.refund >= sale.paidAmount ? "REFUNDED" : "PARTIALLY_REFUNDED", version: { increment: 1 } } });
    }
    await tx.customerPackage.update({ where: { id: p.id }, data: { status: "REFUNDED", refundAmount: calc.refund, refundPenalty: calc.penalty, refundedAt: new Date() } });
    await audit(tx, { userId: actorId, action: "package.refund", entity: "CustomerPackage", entityId: p.id, after: { ...calc, method: v.method, reason: v.reason } });
    return calc;
  });
}

// ───────────────────────── Хугацаа ─────────────────────────

export const EXPIRY_REMIND_DAYS = 7;

/** Tick (минут тутам) / шөнө: хугацаа дууссаныг EXPIRED; 7 хоногийн дотор дуусахыг SMS-ээр сануулна (нэг удаа) */
export async function expireAndRemindPackages(now = new Date()) {
  const expired = await db.customerPackage.updateMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
  const soon = await db.customerPackage.findMany({
    where: { status: "ACTIVE", remindedAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRY_REMIND_DAYS * 86_400_000) } },
    select: { id: true },
    take: 200,
  });
  for (const p of soon) {
    await db.$transaction(async (tx) => {
      await enqueue(tx, { type: "PACKAGE_EXPIRY", payload: { customerPackageId: p.id }, dedupeKey: `package-expiry:${p.id}` });
      await tx.customerPackage.update({ where: { id: p.id }, data: { remindedAt: now } });
    });
  }
  return { expired: expired.count, reminded: soon.length };
}

// ───────────────────────── Харах / тайлан ─────────────────────────

export async function customerPackages(customerId: string) {
  return db.customerPackage.findMany({
    where: { customerId },
    orderBy: [{ status: "asc" }, { purchasedAt: "desc" }],
    include: {
      redemptions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, unitValue: true, reversedAt: true, reverseReason: true, service: { select: { name: true } }, staff: { select: { name: true } } },
      },
    },
  });
}

/** Картад харуулах хэлбэр: буцаах дүнг (refundCalc) тооцоолсон */
export async function customerPackageViews(customerId: string) {
  const [rows, settings] = await Promise.all([customerPackages(customerId), getPackageSettings()]);
  return rows.map((p) => {
    const usedValue = p.redemptions.reduce((s, r) => s + (r.reversedAt ? 0 : r.unitValue), 0);
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      totalSessions: p.totalSessions,
      usedSessions: p.usedSessions,
      paidAmount: p.paidAmount,
      purchasedAt: p.purchasedAt,
      expiresAt: p.expiresAt,
      refundAmount: p.refundAmount,
      refund: p.status === "ACTIVE" ? refundCalc(p, usedValue, settings.refundPenaltyPct) : null,
      redemptions: p.redemptions.map((r) => ({ id: r.id, createdAt: r.createdAt, unitValue: r.unitValue, reversedAt: r.reversedAt, reverseReason: r.reverseReason, service: r.service.name, staff: r.staff?.name ?? null })),
    };
  });
}

/** Танигдсан орлого (ашигласан удаагийн өртөг) — хугацаанд */
export async function recognizedPackageRevenue(start: Date, end: Date) {
  const r = await db.packageRedemption.aggregate({ where: { reversedAt: null, createdAt: { gte: start, lt: end } }, _sum: { unitValue: true }, _count: true });
  return { amount: r._sum.unitValue ?? 0, sessions: r._count };
}

/** Багцын үлдэгдэл өр: идэвхтэй багцын (төлсөн − ашигласан өртөг) */
export async function packageLiability() {
  const rows = await db.$queryRaw<{ v: number }[]>`
    SELECT COALESCE(SUM(cp."paidAmount" - COALESCE(u.used, 0)), 0)::float8 AS v
    FROM "CustomerPackage" cp
    LEFT JOIN (SELECT "customerPackageId", SUM("unitValue") AS used FROM "PackageRedemption" WHERE "reversedAt" IS NULL GROUP BY 1) u ON u."customerPackageId" = cp."id"
    WHERE cp."status"::text = 'ACTIVE'`;
  return Math.round(rows[0]?.v ?? 0);
}

/** Хугацаа дууссан багцын ашиглагдаагүй удаа (тайланд) */
export async function expiredUnused() {
  const rows = await db.customerPackage.findMany({ where: { status: "EXPIRED" }, select: { totalSessions: true, usedSessions: true } });
  return rows.reduce((s, r) => s + (r.totalSessions - r.usedSessions), 0);
}

/** Outbox PACKAGE_EXPIRY: "CLESS: Сараа, таны «…» багц 2026-12-20-нд дуусна. Үлдсэн 3 удаа." */
export async function deliverPackageExpirySms(jobId: string, customerPackageId: string) {
  const p = await db.customerPackage.findUnique({ where: { id: customerPackageId }, select: { name: true, status: true, expiresAt: true, totalSessions: true, usedSessions: true, customer: { select: { name: true, phone: true } } } });
  if (!p || p.status !== "ACTIVE" || !p.expiresAt || !p.customer.phone) return "skipped" as const;
  const left = p.totalSessions - p.usedSessions;
  if (left <= 0) return "skipped" as const;
  const { sendSms } = await import("@/server/modules/notifications/sms");
  const { brand } = await import("@/server/modules/notifications/providers/wesend");
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(p.expiresAt);
  await sendSms({ id: jobId, to: p.customer.phone, kind: "PACKAGE_EXPIRY", text: `${brand()}: ${p.customer.name.split(" ")[0]}, таны «${p.name}» багц ${day}-нд дуусна. Үлдсэн ${left} удаа — цагаа захиалаарай.` });
  return "sent" as const;
}
