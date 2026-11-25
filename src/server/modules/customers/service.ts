/**
 * Үйлчлүүлэгч: хайлт (утас/нэр/имэйл), үүсгэх, профайл (айлчлал, худалдан авалт, нийт зарцуулалт).
 * Утасны дугаар 8 оронтой Монгол дугаар болгон хэвийн болгоно (+976, зай, зураас хасна).
 */
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";

/** "+976 9911-0001" → "99110001"; буруу бол null */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+976")) d = d.slice(4);
  else if (d.startsWith("976") && d.length === 11) d = d.slice(3);
  return /^[2-9]\d{7}$/.test(d) ? d : null;
}

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "8 оронтой утасны дугаар оруулна уу." });
    return n ?? v;
  });

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Нэрээ оруулна уу.").max(120),
  phone,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .transform((v) => v || null)
    .pipe(z.email("Имэйл буруу байна.").nullable())
    .nullish(),
  birthday: z.coerce.date().nullish(),
  skinType: z.enum(["DRY", "OILY", "COMBINATION", "NORMAL", "SENSITIVE"]).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  marketingConsent: z.boolean().default(false),
});
export type CustomerInput = z.input<typeof customerSchema>;

/** Search starts at this many characters (name or phone) */
export const CUSTOMER_SEARCH_MIN = 3;

export async function searchCustomers(q: string, take = 10) {
  const term = q.trim();
  if (term.length < CUSTOMER_SEARCH_MIN) return [];
  const digits = term.replace(/\D/g, "");
  return db.customer.findMany({
    where: {
      OR: [
        ...(digits.length >= 3 ? [{ phone: { contains: normalizePhone(term) ?? digits } }] : []),
        { name: { contains: term, mode: "insensitive" as const } },
        { email: { contains: term, mode: "insensitive" as const } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, name: true, phone: true, email: true, skinType: true },
  });
}

/** Existing customer with this phone (any format: "9911-0001", "+976 9911 0001") — for the duplicate hint */
export async function findCustomerByPhone(raw: string, excludeId?: string) {
  const phone = normalizePhone(raw);
  if (!phone) return null;
  const c = await db.customer.findUnique({ where: { phone }, select: { id: true, name: true, phone: true, email: true } });
  return c && c.id !== excludeId ? c : null;
}

export async function createCustomer(raw: CustomerInput, actorId: string) {
  const data = customerSchema.parse(raw);
  try {
    return await db.$transaction(async (tx) => {
      const c = await tx.customer.create({ data: { ...data, email: data.email ?? null } });
      await audit(tx, { userId: actorId, action: "customer.create", entity: "Customer", entityId: c.id, after: { name: c.name } });
      return c;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new UserError("Энэ утасны дугаартай үйлчлүүлэгч бүртгэлтэй байна.", { phone: ["Бүртгэлтэй дугаар."] });
    }
    throw e;
  }
}

export async function updateCustomer(id: string, raw: CustomerInput, actorId: string) {
  const data = customerSchema.parse(raw);
  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.customer.findUnique({ where: { id } });
      if (!before) throw new UserError("Үйлчлүүлэгч олдсонгүй.");
      const c = await tx.customer.update({ where: { id }, data: { ...data, email: data.email ?? null } });
      await audit(tx, { userId: actorId, action: "customer.update", entity: "Customer", entityId: id, before, after: c });
      return c;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new UserError("Энэ утасны дугаартай үйлчлүүлэгч бүртгэлтэй байна.", { phone: ["Бүртгэлтэй дугаар."] });
    }
    throw e;
  }
}

export async function listCustomers(opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = opts.pageSize ?? 30;
  const page = Math.max(1, opts.page ?? 1);
  const term = opts.q?.trim() ?? "";
  const where: Prisma.CustomerWhereInput = term
    ? {
        OR: [
          { phone: { contains: term.replace(/\D/g, "") || term } },
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ],
      }
    : {};
  const [rows, count] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { visits: true, sales: true } } },
    }),
    db.customer.count({ where }),
  ]);
  return { rows, count, page, pageSize };
}

/** Профайл: нийт зарцуулалт = Σ(paid − refunded) төлөгдсөн борлуулалтууд */
export async function customerProfile(id: string) {
  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) return null;
  const [visits, sales, spent] = await Promise.all([
    db.visit.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        conductedBy: { select: { name: true } },
        recommendations: { orderBy: { sortOrder: "asc" }, include: { variant: { select: { size: true, product: { select: { name: true } } } } } },
        sale: { select: { id: true, number: true } },
      },
    }),
    db.sale.findMany({
      where: { customerId: id, status: { not: "DRAFT" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, number: true, status: true, total: true, paidAmount: true, refundedAmount: true, createdAt: true },
    }),
    db.sale.aggregate({
      where: { customerId: id, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      _sum: { paidAmount: true, refundedAmount: true },
      _count: true,
    }),
  ]);
  return {
    customer,
    visits,
    sales,
    totalSpent: (spent._sum.paidAmount ?? 0) - (spent._sum.refundedAmount ?? 0),
    paidSalesCount: spent._count,
  };
}
