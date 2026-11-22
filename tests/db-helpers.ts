/**
 * DB тестийн туслахууд. Зөвхөн локал cless_test DB (vitest.config.ts "db" төсөл).
 */
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import type { Role } from "@/generated/prisma/client";

/** Салбар "CL"-ээс бусдыг цэвэрлэнэ (migration үүсгэсэн) */
export async function resetDb() {
  await db.$executeRawUnsafe(`TRUNCATE
    "CashMovement", "PaymentTransaction", "Payment", "Refund", "CashShift", "VisitRecommendation", "Visit",
    "SaleItem", "Sale", "SaleCounter", "OutboxJob", "StockMovement", "AuditLog", "LoginAttempt",
    "ServiceConsumable", "Service", "ProductCollection", "ProductImage", "BundleItem", "ProductRelation",
    "PriceHistory", "Variant", "Product", "Customer", "Appointment", "SiteSetting", "User",
    "Collection", "WorkerHeartbeat"
    RESTART IDENTITY CASCADE`);
}

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export async function makeUser(role: Role, opts: { password?: string; email?: string } = {}) {
  return db.user.create({
    data: {
      name: `${role} ${seq}`,
      email: opts.email ?? `${uid(role.toLowerCase())}@test.mn`,
      role,
      passwordHash: await bcrypt.hash(opts.password ?? "secret-pass", 4),
    },
  });
}

/** Бүтээгдэхүүн + нэг хувилбар (үлдэгдэл movement-гүйгээр — тест өөрөө тогтооно) */
export async function makeVariant(opts: { price: number; stock: number; cost?: number; name?: string }) {
  const product = await db.product.create({
    data: { slug: uid("p"), name: opts.name ?? "SERUM", description: "d", isPublished: true },
  });
  return db.variant.create({
    data: { productId: product.id, sku: uid("SKU").toUpperCase(), size: "30 мл", price: opts.price, costPrice: opts.cost ?? 0, stock: opts.stock },
  });
}

export async function makeService(opts: { price: number; name?: string; consumables?: { variantId: string; qty: number }[] }) {
  return db.service.create({
    data: {
      slug: uid("s"),
      name: opts.name ?? "FACIAL",
      description: "d",
      durationMin: 60,
      price: opts.price,
      consumables: opts.consumables ? { create: opts.consumables.map((c) => ({ variantId: c.variantId, qtyPerService: c.qty })) } : undefined,
    },
  });
}

export async function makeCustomer(opts: { email?: string | null } = {}) {
  return db.customer.create({ data: { name: "Test", phone: uid("9911"), email: opts.email === undefined ? "c@test.mn" : opts.email } });
}

export async function variantStock(id: string) {
  return db.variant.findUniqueOrThrow({ where: { id }, select: { stock: true, reserved: true } });
}
