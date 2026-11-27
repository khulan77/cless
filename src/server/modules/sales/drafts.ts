/**
 * POS-ийн ноорог (DRAFT Sale). Сагсыг refresh / хуудас солиход алдагдахгүйн тулд
 * UI-ийн төлөвийг Sale.draftData-д хадгална. Үнэ зөвхөн харуулах — checkout үед
 * серверт дахин тооцно (sales/service.checkout). Нөөцлөлт хийгдэхгүй.
 */
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";

const discount = z.object({ type: z.enum(["AMOUNT", "PERCENT"]), value: z.number().finite().min(0) }).nullable();
const text = (max: number) => z.string().max(max).default("");

export const draftDataSchema = z.object({
  lines: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        kind: z.enum(["PRODUCT", "SERVICE"]),
        refId: z.string().min(1).max(64),
        name: text(300),
        detail: text(300),
        unitPrice: z.number().int().min(0),
        qty: z.number().int().min(1).max(999),
        staffId: text(64),
        /** PRODUCT: зарсан ажилтан ("" = автоматаар) */
        sellerId: text(64),
        discount,
        discountReason: text(200),
        howToUse: z.array(z.string().max(2000)).max(30).optional(),
        /** PROMPT 27: багц худалдах мөр */
        packageTemplateId: z.string().max(64).optional(),
      }),
    )
    .max(100)
    .default([]),
  customer: z
    .object({ id: z.string().min(1), name: z.string().max(200), phone: z.string().max(40), email: z.string().max(200).nullable() })
    .nullable()
    .default(null),
  saleDiscount: discount.default(null),
  saleDiscountReason: text(200),
  visitId: z.string().min(1).nullable().default(null),
  /** Цагаас ("Ирсэн — POS нээх") үүссэн ноорог */
  appointmentId: z.string().min(1).nullable().default(null),
  visit: z
    .object({
      skinType: z.enum(["", "DRY", "OILY", "COMBINATION", "NORMAL", "SENSITIVE"]).default(""),
      concerns: z.array(z.string().max(120)).max(30).default([]),
      notes: text(4000),
      recs: z.array(z.object({ variantId: z.string().min(1), name: text(300), instructions: text(2000) })).max(30).default([]),
    })
    .default({ skinType: "", concerns: [], notes: "", recs: [] }),
});
export type DraftData = z.output<typeof draftDataSchema>;
export type DraftDataInput = z.input<typeof draftDataSchema>;

export const DRAFT_LOCKED = "DRAFT_LOCKED";

/** Шинэ хоосон ноорог */
export async function createDraft(actorId: string) {
  const branch = await getCurrentBranch();
  const s = await db.sale.create({
    data: { branchId: branch.id, channel: "POS", createdById: actorId, draftData: draftDataSchema.parse({}) as Prisma.InputJsonValue },
    select: { id: true },
  });
  return s.id;
}

/**
 * Ноорог хадгалах (autosave). saleId байхгүй бол шинээр үүсгэнэ.
 * Борлуулалт аль хэдийн lock хийгдсэн бол DRAFT_LOCKED.
 */
export async function saveDraft(input: { saleId?: string | null; data: DraftDataInput }, actorId: string) {
  const data = draftDataSchema.parse(input.data);
  const customerId = data.customer?.id ?? null;
  const total = data.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  if (!input.saleId) {
    const branch = await getCurrentBranch();
    const s = await db.sale.create({
      data: { branchId: branch.id, channel: "POS", createdById: actorId, customerId, subtotal: total, draftData: data as Prisma.InputJsonValue },
      select: { id: true, updatedAt: true },
    });
    return { saleId: s.id, savedAt: s.updatedAt.toISOString() };
  }

  // Зөвхөн DRAFT үед (lock-той зэрэг ирвэл lock ялна)
  const updated = await db.sale.updateManyAndReturn({
    where: { id: input.saleId, status: "DRAFT" },
    data: { customerId, subtotal: total, draftData: data as Prisma.InputJsonValue },
    select: { id: true, updatedAt: true },
  });
  if (!updated[0]) throw new UserError("Энэ борлуулалт аль хэдийн төлбөрт шилжсэн байна.", undefined, DRAFT_LOCKED);
  return { saleId: updated[0].id, savedAt: updated[0].updatedAt.toISOString() };
}

/** Хэрэглэгчийн ноорогууд (шинэ нь эхэнд) */
export async function listDrafts(userId: string) {
  const rows = await db.sale.findMany({
    where: { createdById: userId, status: "DRAFT", channel: "POS" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, number: true, updatedAt: true, subtotal: true, draftData: true, customer: { select: { name: true } }, _count: { select: { items: true } } },
  });
  return rows.map((r) => {
    const d = draftDataSchema.safeParse(r.draftData ?? {});
    const lines = d.success ? d.data.lines.length : r._count.items;
    return {
      id: r.id,
      number: r.number,
      updatedAt: r.updatedAt,
      customerName: r.customer?.name ?? (d.success ? (d.data.customer?.name ?? null) : null),
      lines,
      subtotal: r.subtotal,
    };
  });
}

/** Хэрэглэгчийн хамгийн сүүлийн ноорог */
export async function latestDraftId(userId: string) {
  const r = await db.sale.findFirst({
    where: { createdById: userId, status: "DRAFT", channel: "POS" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return r?.id ?? null;
}

/**
 * Ноорог устгах. Дугаар олгогдсон (unlock хийсэн) бол дугаарлалт тасрахгүйн тулд CANCELLED болгоно.
 */
export async function discardDraft(saleId: string) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: string; number: string | null }[]>`
      SELECT "status"::text AS "status", "number" FROM "Sale" WHERE "id" = ${saleId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.status !== "DRAFT") throw new UserError("Хадгалсан сагс олдсонгүй.");
    if ((await tx.payment.count({ where: { saleId } })) > 0 || row.number) {
      await tx.visit.updateMany({ where: { saleId }, data: { saleId: null } });
      await tx.sale.update({ where: { id: saleId }, data: { status: "CANCELLED", cancelledAt: new Date(), draftData: Prisma.DbNull } });
      return "CANCELLED" as const;
    }
    await tx.sale.delete({ where: { id: saleId } });
    return "DELETED" as const;
  });
}

/**
 * Worker: 24 цагаас удаан хөндөгдөөгүй ноорогууд. Нөөцлөлтгүй тул аюулгүй.
 * Дугааргүй → устгана; дугаартай (unlock хийсэн) → CANCELLED (дугаарлалтын цоорхойгүй).
 */
export async function purgeStaleDrafts(olderThanHours = 24, now = new Date()) {
  const cutoff = new Date(now.getTime() - olderThanHours * 3600_000);
  const deleted = await db.sale.deleteMany({
    where: { status: "DRAFT", updatedAt: { lt: cutoff }, number: null, payments: { none: {} } },
  });
  const numbered = await db.sale.findMany({ where: { status: "DRAFT", updatedAt: { lt: cutoff }, number: { not: null } }, select: { id: true } });
  for (const s of numbered) await discardDraft(s.id).catch(() => undefined);
  return deleted.count + numbered.length;
}
