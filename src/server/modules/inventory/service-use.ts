/**
 * Бүтээгдэхүүний зарлага (PROMPT 27 §3):
 *  1) Зарагдсан — POS / онлайн борлуулалтаар (SALE, одоогийнх).
 *  2) Үйлчилгээнд зарцуулсан — менежер «Үйлчилгээнд олгох»: бүтээгдэхүүн, тоо (ширхэг/сав), аль цаг /
 *     үйлчилгээ / гоо сайханч, тайлбар → StockMovement SERVICE_USE (qty < 0, unitCost = өртөг).
 *     Цаг «Орсон» болоход ServiceConsumable тохируулсан бол санал болгоно — менежер батална (автоматаар хасахгүй).
 * Үлдэгдэл: Variant.stock кэш, мөрийг FOR UPDATE түгжинэ. Сөрөг үлдэгдэл — POS тохиргоогоор л.
 */
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";
import { getPosSettings } from "@/server/modules/settings/pos-settings";

export const issueSchema = z.object({
  variantId: z.string().min(1, "Бүтээгдэхүүн сонгоно уу."),
  qty: z.coerce.number({ error: "Тоо оруулна уу." }).int("Бүхэл тоо (ширхэг / сав).").min(1, "1-ээс их.").max(1000),
  appointmentId: z.string().min(1).nullish().transform((v) => v ?? null),
  serviceId: z.string().min(1).nullish().transform((v) => v ?? null),
  staffId: z.string().min(1).nullish().transform((v) => v ?? null),
  note: z.string().trim().max(300).nullish().transform((v) => v || null),
});

export async function issueForService(raw: z.input<typeof issueSchema>, actorId: string) {
  const v = issueSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; stock: number; reserved: number; costPrice: number }[]>`
      SELECT "id", "stock", "reserved", "costPrice" FROM "Variant" WHERE "id" = ${v.variantId} FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new UserError("Бүтээгдэхүүн олдсонгүй.");
    // Цагаас үйлчилгээ, гоо сайханчийг бөглөнө (өгөөгүй бол)
    let { serviceId, staffId } = v;
    if (v.appointmentId) {
      const a = await tx.appointment.findUnique({ where: { id: v.appointmentId }, select: { serviceId: true, staffId: true } });
      if (!a) throw new UserError("Цаг олдсонгүй.");
      serviceId ??= a.serviceId;
      staffId ??= a.staffId;
    }
    const available = row.stock - row.reserved;
    if (v.qty > available && !(await getPosSettings(tx)).allowNegativeStock) {
      throw new UserError(`Үлдэгдэл хүрэлцэхгүй (${available} байна).`, { qty: [`${available}-аас ихгүй.`] });
    }
    await tx.variant.update({ where: { id: v.variantId }, data: { stock: { decrement: v.qty } } });
    const m = await tx.stockMovement.create({
      data: {
        branchId: (await getCurrentBranch(tx)).id,
        variantId: v.variantId,
        type: "SERVICE_USE",
        qty: -v.qty,
        unitCost: row.costPrice,
        appointmentId: v.appointmentId,
        serviceId,
        staffId,
        note: v.note,
        createdById: actorId,
      },
    });
    await audit(tx, { userId: actorId, action: "stock.service_use", entity: "Variant", entityId: v.variantId, before: { stock: row.stock }, after: { stock: row.stock - v.qty, qty: v.qty, appointmentId: v.appointmentId, movementId: m.id } });
    return { movementId: m.id, stock: row.stock - v.qty };
  });
}

/**
 * «Орсон» цагт санал болгох материал: үйлчилгээний ServiceConsumable (норм) − энэ цагт аль хэдийн олгосон.
 * Норм бутархай (0.2 сав) байж болно — санал = дээш бүхэлчилсэн ширхэг (менежер засна).
 */
export async function suggestionsForAppointment(appointmentId: string) {
  const a = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      status: true,
      staffId: true,
      serviceId: true,
      service: { select: { name: true, consumables: { select: { qtyPerService: true, variant: { select: { id: true, sku: true, size: true, stock: true, product: { select: { name: true } } } } } } } },
    },
  });
  if (!a) return null;
  const issued = await db.stockMovement.groupBy({ by: ["variantId"], where: { appointmentId, type: "SERVICE_USE" }, _sum: { qty: true } });
  return {
    appointmentId: a.id,
    status: a.status,
    serviceId: a.serviceId,
    staffId: a.staffId,
    items: a.service.consumables.map((c) => {
      const done = 0 - (issued.find((i) => i.variantId === c.variant.id)?._sum.qty ?? 0) || 0;
      return {
        variantId: c.variant.id,
        name: `${c.variant.product.name} · ${c.variant.size}`,
        sku: c.variant.sku,
        norm: Number(c.qtyPerService),
        suggested: Math.max(0, Math.ceil(Number(c.qtyPerService)) - done),
        issued: done,
        stock: c.variant.stock,
      };
    }),
  };
}

/** Сарын дүн (variant бүрээр): зарагдсан (SALE − RETURN), үйлчилгээнд, орлого — үлдэгдлийн жагсаалтад */
export async function monthlyFlows(variantIds: string[], from: Date, to: Date) {
  if (variantIds.length === 0) return new Map<string, { sold: number; serviceUse: number; received: number }>();
  const rows = await db.stockMovement.groupBy({
    by: ["variantId", "type"],
    where: { variantId: { in: variantIds }, createdAt: { gte: from, lt: to }, type: { in: ["SALE", "RETURN", "SERVICE_USE", "PURCHASE"] } },
    _sum: { qty: true },
  });
  const out = new Map<string, { sold: number; serviceUse: number; received: number }>();
  for (const id of variantIds) out.set(id, { sold: 0, serviceUse: 0, received: 0 });
  for (const r of rows) {
    const x = out.get(r.variantId)!;
    const q = r._sum.qty ?? 0;
    if (r.type === "SALE" || r.type === "RETURN") x.sold += -q;
    else if (r.type === "SERVICE_USE") x.serviceUse += -q;
    else if (r.type === "PURCHASE") x.received += q;
  }
  return out;
}

/** Тайлан: үйлчилгээнд зарцуулсан (өртгөөр), гоо сайханч бүрээр */
export async function serviceUseReport(from: Date, to: Date) {
  const rows = await db.stockMovement.findMany({
    where: { type: "SERVICE_USE", createdAt: { gte: from, lt: to } },
    select: { qty: true, unitCost: true, staffId: true, staff: { select: { name: true } }, variant: { select: { id: true, sku: true, size: true, product: { select: { name: true } } } } },
  });
  const byProduct = new Map<string, { key: string; name: string; qty: number; cost: number }>();
  const byStaff = new Map<string, { key: string; name: string; qty: number; cost: number }>();
  for (const r of rows) {
    const qty = -r.qty;
    const cost = qty * (r.unitCost ?? 0);
    const p = byProduct.get(r.variant.id) ?? { key: r.variant.id, name: `${r.variant.product.name} · ${r.variant.size}`, qty: 0, cost: 0 };
    p.qty += qty;
    p.cost += cost;
    byProduct.set(p.key, p);
    const sk = r.staffId ?? "none";
    const st = byStaff.get(sk) ?? { key: sk, name: r.staff?.name ?? "Тодорхойгүй", qty: 0, cost: 0 };
    st.qty += qty;
    st.cost += cost;
    byStaff.set(sk, st);
  }
  const sort = <T extends { cost: number }>(m: Map<string, T>) => [...m.values()].sort((a, b) => b.cost - a.cost);
  return { byProduct: sort(byProduct), byStaff: sort(byStaff), totalCost: rows.reduce((s, r) => s + -r.qty * (r.unitCost ?? 0), 0) };
}
