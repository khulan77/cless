/**
 * Айлчлал (оношлогоо + зөвлөсөн бүтээгдэхүүн). Борлуулалтгүй байж болно.
 * Борлуулалттай холбох нь checkout (sales/service) дээр visitId-аар хийгдэнэ.
 */
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getCurrentBranch } from "@/server/modules/branches/service";

export const visitSchema = z.object({
  visitId: z.string().min(1).nullish(),
  customerId: z.string().min(1, "Үйлчлүүлэгчээ сонгоно уу."),
  appointmentId: z.string().min(1).nullish(),
  skinType: z.enum(["DRY", "OILY", "COMBINATION", "NORMAL", "SENSITIVE"]).nullish(),
  concerns: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  diagnosisNotes: z.string().trim().max(4000).nullish(),
  recommendations: z
    .array(z.object({ variantId: z.string().min(1), instructions: z.string().trim().max(2000).nullish() }))
    .max(30)
    .default([]),
});
export type VisitInput = z.input<typeof visitSchema>;

/** Оношлогооны "анхаарах асуудал" — CONCERN төрлийн ангиллууд (slug хадгална) */
export async function listConcerns(client: Pick<typeof db, "collection"> = db) {
  return client.collection.findMany({ where: { kind: "CONCERN" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true } });
}

/** slug → нэр (устсан ангиллын slug-ийг тэр чигээр нь үлдээнэ) */
export async function concernNames(slugs: string[]) {
  if (slugs.length === 0) return [];
  const rows = await db.collection.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } });
  return slugs.map((s) => rows.find((r) => r.slug === s)?.name ?? s);
}

/** howToUse алхмуудыг зааврын текст болгоно (POS-д урьдчилан бөглөх) */
export function instructionsFromHowToUse(steps: string[]): string {
  return steps
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");
}

/** Үүсгэх эсвэл засах (visitId байвал). Зөвлөмжийг бүхэлд нь солино; purchased тэмдэглэгээг хадгална. */
export async function saveVisit(raw: VisitInput, actorId: string) {
  const data = visitSchema.parse(raw);
  const branch = await getCurrentBranch();
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: data.customerId }, select: { id: true, skinType: true } });
    if (!customer) throw new UserError("Үйлчлүүлэгч олдсонгүй.");

    const concerns = [...new Set(data.concerns)];
    if (concerns.length) {
      const known = await tx.collection.count({ where: { kind: "CONCERN", slug: { in: concerns } } });
      if (known !== concerns.length) throw new UserError("Анхаарах асуудлын жагсаалтад байхгүй утга байна.", { concerns: ["Жагсаалтаас сонгоно уу."] });
    }

    const variantIds = [...new Set(data.recommendations.map((r) => r.variantId))];
    const variants = await tx.variant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, product: { select: { howToUse: true } } },
    });
    if (variants.length !== variantIds.length) throw new UserError("Зөвлөсөн бүтээгдэхүүн олдсонгүй.");

    const fields = {
      customerId: data.customerId,
      appointmentId: data.appointmentId ?? null,
      skinType: data.skinType ?? null,
      concerns,
      diagnosisNotes: data.diagnosisNotes ?? null,
    };

    let visitId: string;
    let purchased = new Set<string>();
    if (data.visitId) {
      const existing = await tx.visit.findUnique({ where: { id: data.visitId }, include: { recommendations: true } });
      if (!existing) throw new UserError("Айлчлал олдсонгүй.");
      purchased = new Set(existing.recommendations.filter((r) => r.purchased).map((r) => r.variantId));
      await tx.visit.update({ where: { id: existing.id }, data: fields });
      await tx.visitRecommendation.deleteMany({ where: { visitId: existing.id } });
      visitId = existing.id;
    } else {
      const v = await tx.visit.create({ data: { ...fields, branchId: branch.id, conductedById: actorId } });
      visitId = v.id;
    }

    await tx.visitRecommendation.createMany({
      data: data.recommendations.map((r, i) => {
        const howTo = variants.find((v) => v.id === r.variantId)!.product.howToUse;
        return {
          visitId,
          variantId: r.variantId,
          instructions: r.instructions?.trim() || instructionsFromHowToUse(howTo) || null,
          purchased: purchased.has(r.variantId),
          sortOrder: i,
        };
      }),
    });

    // Арьсны төрлийг профайлд хадгална (хоосон бол)
    if (data.skinType && !customer.skinType) {
      await tx.customer.update({ where: { id: customer.id }, data: { skinType: data.skinType } });
    }
    await audit(tx, {
      userId: actorId,
      action: data.visitId ? "visit.update" : "visit.create",
      entity: "Visit",
      entityId: visitId,
      after: { customerId: data.customerId, concerns: data.concerns, recommendations: variantIds.length },
    });
    return tx.visit.findUniqueOrThrow({ where: { id: visitId }, include: { recommendations: { orderBy: { sortOrder: "asc" } } } });
  });
}

export async function getVisit(id: string) {
  return db.visit.findUnique({
    where: { id },
    include: {
      customer: true,
      conductedBy: { select: { name: true } },
      sale: { select: { id: true, number: true, status: true } },
      recommendations: {
        orderBy: { sortOrder: "asc" },
        include: { variant: { select: { id: true, size: true, price: true, product: { select: { name: true, slug: true } } } } },
      },
    },
  });
}
