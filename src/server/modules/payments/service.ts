/**
 * Төлбөр. Нэг борлуулалтад олон төлбөр. Гадны API (QPay)-г transaction дотор ДУУДАХГҮЙ.
 * Төлбөр SUCCEEDED болох бүрт sales/finalize.applyPayment дуудагдана.
 */
import { z } from "zod";
import { Prisma, type PayMethod, type Role } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { requireOpenShiftForUpdate } from "@/server/modules/cash-shifts/service";
import { getPosSettings } from "@/server/modules/settings/pos-settings";
import { enqueue } from "@/server/modules/outbox/service";
import { applyPayment } from "@/server/modules/sales/finalize";
import { getQPaySettings } from "@/server/modules/settings/pos-settings";
import { SITE_URL } from "@/lib/site-url";
import { callbackSecret, effectiveQPayMode, getQPayProvider, qpayAccountConfigured, type QPayAccountKey } from "./providers/qpay";
import { qpayAccountViews, resolveQPayAccount } from "./providers/qpay/accounts";
import { signPaymentId } from "./providers/qpay/signature";
import { QPAY_INVOICE_TTL_MS } from "./providers/qpay/types";

type Tx = Prisma.TransactionClient;
export type Actor = { id: string; role: Role };

const TX_OPTS = { maxWait: 10_000, timeout: 30_000 } as const;

const base = {
  saleId: z.string().min(1),
  amount: z.number().int("Бүхэл тоо оруулна уу.").positive("0-ээс их дүн оруулна уу."),
  idempotencyKey: z.string().min(8).max(100),
};

export const createPaymentSchema = z.discriminatedUnion("method", [
  z.object({ ...base, method: z.literal("CASH"), tendered: z.number().int().positive("Өгсөн мөнгийг оруулна уу.") }),
  z.object({
    ...base,
    method: z.literal("CARD"),
    approvalCode: z.string().trim().min(2, "Зөвшөөрлийн кодыг оруулна уу.").max(32),
    cardLast4: z.string().trim().regex(/^\d{4}$/, "Сүүлийн 4 орон.").nullish(),
  }),
  z.object({ ...base, method: z.literal("TRANSFER"), externalRef: z.string().trim().min(2, "Гүйлгээний утгыг оруулна уу.").max(200) }),
  // QPay: externalRef байвал гараар (manual) баталгаажуулалт, үгүй бол API-аар invoice
  // PROMPT 29: qpayAccount — A (компани) / B (захирал); сонгоогүй бол анхдагч данс
  z.object({
    ...base,
    method: z.literal("QPAY"),
    externalRef: z.string().trim().min(2, "Гүйлгээний дугаарыг оруулна уу.").max(200).nullish(),
    qpayAccount: z.enum(["A", "B"]).nullish(),
  }),
]);
export type CreatePaymentInput = z.input<typeof createPaymentSchema>;

const METHOD_PERMISSION: Record<"CASH" | "CARD" | "QPAY" | "TRANSFER", Parameters<typeof can>[1]> = {
  CASH: "payment:cash",
  CARD: "payment:card",
  QPAY: "payment:qpay",
  TRANSFER: "payment:transfer:confirm",
};

type Deeplink = { name: string; link: string; logo?: string };
export type PaymentView = {
  payment: { id: string; method: PayMethod; amount: number; status: string; change: number | null; reviewReason: string | null; qpayAccount: QPayAccountKey | null };
  sale: { id: string; status: string; total: number; paidAmount: number };
  qpay?: { qrText: string; qrImage: string | null; deeplinks: Deeplink[]; expiresAt: string };
};

async function view(client: Tx | typeof db, paymentId: string): Promise<PaymentView> {
  const p = await client.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      sale: { select: { id: true, status: true, total: true, paidAmount: true } },
      transactions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const t = p.transactions[0];
  return {
    payment: { id: p.id, method: p.method, amount: p.amount, status: p.status, change: p.change, reviewReason: p.reviewReason, qpayAccount: p.qpayAccount },
    sale: p.sale,
    qpay: t
      ? { qrText: t.qrText ?? "", qrImage: t.qrImage, deeplinks: (t.deeplinks as Deeplink[] | null) ?? [], expiresAt: t.expiresAt.toISOString() }
      : undefined,
  };
}

/** Үлдэгдэл = нийт − амжилттай − (хүлээгдэж буй QPay) */
async function remaining(tx: Tx, saleId: string, total: number) {
  const [ok, open] = await Promise.all([
    tx.payment.aggregate({ where: { saleId, status: "SUCCEEDED" }, _sum: { amount: true } }),
    tx.payment.aggregate({ where: { saleId, status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true } }),
  ]);
  return total - (ok._sum.amount ?? 0) - (open._sum.amount ?? 0);
}

/** Гарын үсэг нь pid + данс хоёуланг хамарна (acct-ийг солих боломжгүй) */
export const callbackSignedValue = (paymentId: string, acct: QPayAccountKey) => `${paymentId}:${acct}`;

export function callbackUrl(paymentId: string, acct: QPayAccountKey = "A") {
  return `${SITE_URL}/api/qpay/callback?pid=${encodeURIComponent(paymentId)}&acct=${acct}&sig=${signPaymentId(callbackSignedValue(paymentId, acct), callbackSecret())}`;
}

/** Хуучин мөр (qpayAccount null) — A */
const acctOf = (p: { qpayAccount: QPayAccountKey | null }): QPayAccountKey => p.qpayAccount ?? "A";

/**
 * Төлбөр үүсгэх. Ижил idempotencyKey-ээр дахин ирвэл өмнөхийг буцаана.
 * CASH / CARD / TRANSFER / QPay(гараар) → шууд SUCCEEDED; QPay(API) → invoice + PROCESSING.
 */
export async function createPayment(raw: CreatePaymentInput, actor: Actor): Promise<PaymentView> {
  const input = createPaymentSchema.parse(raw);
  if (!can(actor.role, METHOD_PERMISSION[input.method])) {
    throw new ForbiddenError(input.method === "TRANSFER" ? "Дансны төлбөрийг зөвхөн админ, менежер баталгаажуулна." : undefined);
  }

  const existing = await db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, saleId: true } });
  if (existing) {
    if (existing.saleId !== input.saleId) throw new UserError("Төлбөрийн түлхүүр өөр борлуулалтад ашиглагдсан.");
    return view(db, existing.id);
  }

  const qpaySettings = input.method === "QPAY" ? await getQPaySettings() : null;
  const qpayMode = qpaySettings ? effectiveQPayMode(qpaySettings.mode) : null;
  const viaApi = input.method === "QPAY" && !input.externalRef;
  if (viaApi && qpayMode !== "api") throw new UserError("QPay API холбогдоогүй. Гүйлгээний дугаарыг гараар оруулна уу.");
  // PROMPT 29: данс — идэвхтэй, түлхүүртэй (A гар горимд түлхүүргүй ч болно). API-д тухайн дансны түлхүүр заавал.
  let qpayAccount: QPayAccountKey | null = null;
  if (input.method === "QPAY" && qpaySettings && qpayMode) {
    const views = qpayAccountViews(qpaySettings, qpayMode, (a) => qpayAccountConfigured(a));
    qpayAccount = resolveQPayAccount(views, qpaySettings.defaultAccount, input.qpayAccount);
    if (!qpayAccount || (viaApi && !qpayAccountConfigured(qpayAccount))) {
      throw new UserError("Сонгосон QPay данс идэвхгүй эсвэл тохируулаагүй байна.", { qpayAccount: ["Тохируулаагүй данс."] });
    }
  }

  let paymentId: string;
  try {
    paymentId = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: string; total: number; branchId: string }[]>`
        SELECT "status"::text AS "status", "total", "branchId" FROM "Sale" WHERE "id" = ${input.saleId} FOR UPDATE`;
      const sale = rows[0];
      if (!sale) throw new UserError("Борлуулалт олдсонгүй.");
      if (!["PENDING_PAYMENT", "PARTIALLY_PAID"].includes(sale.status)) throw new UserError("Энэ борлуулалтад төлбөр хүлээн авах боломжгүй.");
      const left = await remaining(tx, input.saleId, sale.total);
      if (input.amount > left) throw new UserError(`Дүн үлдэгдлээс (${left.toLocaleString("en-US")}₮) их байна.`, { amount: ["Үлдэгдлээс их."] });

      const common = {
        saleId: input.saleId,
        method: input.method,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
        createdById: actor.id,
        qpayAccount,
      };

      if (input.method === "QPAY" && viaApi) {
        const p = await tx.payment.create({ data: { ...common, status: "PENDING" } });
        await audit(tx, { userId: actor.id, action: "payment.qpay_started", entity: "Payment", entityId: p.id, after: { amount: input.amount, qpayAccount } });
        return p.id;
      }

      const now = new Date();
      let extra: Prisma.PaymentUncheckedCreateInput | Record<string, unknown> = {};
      if (input.method === "CASH") {
        if (input.tendered < input.amount) throw new UserError("Өгсөн мөнгө төлөх дүнгээс бага байна.", { tendered: ["Хүрэлцэхгүй."] });
        // PROMPT 20: ээлж унтраалттай (анхдагч) бол ээлж шаардахгүй, CashMovement үүсгэхгүй
        const shiftId = (await getPosSettings(tx)).cashShiftsEnabled ? await requireOpenShiftForUpdate(tx, sale.branchId) : null;
        extra = { tendered: input.tendered, change: input.tendered - input.amount, cashShiftId: shiftId };
      } else if (input.method === "CARD") {
        extra = { approvalCode: input.approvalCode, cardLast4: input.cardLast4 ?? null };
      } else {
        extra = { externalRef: input.externalRef };
      }

      const p = await tx.payment.create({
        data: { ...common, ...extra, status: "SUCCEEDED", paidAt: now, confirmedById: actor.id } as Prisma.PaymentUncheckedCreateInput,
      });
      if (input.method === "CASH" && p.cashShiftId) {
        await tx.cashMovement.create({ data: { shiftId: p.cashShiftId!, type: "SALE", amount: input.amount, paymentId: p.id, createdById: actor.id } });
      }
      await audit(tx, {
        userId: actor.id,
        action: "payment.succeeded",
        entity: "Payment",
        entityId: p.id,
        after: { saleId: input.saleId, method: input.method, amount: input.amount, manual: input.method === "QPAY", ...(qpayAccount ? { qpayAccount } : {}) },
      });
      await applyPayment(tx, input.saleId, actor.id);
      return p.id;
    }, TX_OPTS);
  } catch (e) {
    // Зэрэг ижил key-ээр ирсэн бол өмнөх төлбөрийг буцаана
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
      if (again) return view(db, again.id);
    }
    throw e;
  }

  if (viaApi) await startQPayInvoice(paymentId, actor.id);
  return view(db, paymentId);
}

/** QPay invoice-ийг transaction-ээс ГАДУУР үүсгэж, үр дүнг хадгална */
async function startQPayInvoice(paymentId: string, actorId: string) {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { sale: { select: { number: true } } } });
  try {
    const invoice = await getQPayProvider(acctOf(p)).createInvoice({
      paymentId,
      amount: p.amount,
      description: `${p.sale.number ?? "POS"} — ${p.amount}₮`,
      callbackUrl: callbackUrl(paymentId, acctOf(p)),
    });
    await db.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          paymentId,
          provider: "QPAY",
          providerInvoiceId: invoice.invoiceId,
          providerStatus: "CREATED",
          qrText: invoice.qrText,
          qrImage: invoice.qrImage ?? null,
          deeplinks: invoice.deeplinks,
          expiresAt: new Date(Date.now() + QPAY_INVOICE_TTL_MS),
          raw: invoice.raw as Prisma.InputJsonValue,
        },
      });
      await tx.payment.update({ where: { id: paymentId }, data: { status: "PROCESSING" } });
    });
  } catch (e) {
    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
      await audit(tx, { userId: actorId, action: "payment.qpay_invoice_failed", entity: "Payment", entityId: paymentId, after: { error: String(e).slice(0, 500) } });
    });
    throw new UserError("QPay нэхэмжлэх үүсгэж чадсангүй. Дахин оролдох эсвэл гүйлгээний дугаарыг гараар оруулна уу.");
  }
}

/**
 * QPay төлбөрийг QPay-ээс асууж баталгаажуулна (callback, "Шалгах" товч, worker).
 * Callback-ийн body-д итгэхгүй — зөвхөн checkPayment-ийн хариу.
 * Idempotent: аль хэдийн SUCCEEDED бол юу ч хийхгүй.
 */
export async function verifyQPayPayment(paymentId: string, actorId: string | null, now = new Date()): Promise<PaymentView> {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!p) throw new UserError("Төлбөр олдсонгүй.");
  const t = p.transactions[0];
  if (p.method !== "QPAY" || !t || p.status !== "PROCESSING") return view(db, paymentId);

  const result = await getQPayProvider(acctOf(p)).checkPayment(t.providerInvoiceId); // transaction-ээс гадуур, тухайн дансаар

  let cancelInvoice = false;
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: string }[]>`SELECT "status"::text AS "status" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
    if (rows[0]?.status !== "PROCESSING") return; // өөр дуудлага аль хэдийн шийдсэн

    if (result.paid && result.paidAmount === p.amount) {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED", paidAt: now, confirmedById: actorId, reviewReason: null } });
      await tx.paymentTransaction.update({
        where: { id: t.id },
        data: { providerStatus: "PAID", providerPaymentId: result.providerPaymentId ?? null, verifiedAt: now, raw: result.raw as Prisma.InputJsonValue },
      });
      await audit(tx, { userId: actorId, action: "payment.succeeded", entity: "Payment", entityId: paymentId, after: { method: "QPAY", amount: p.amount, invoiceId: t.providerInvoiceId } });
      await applyPayment(tx, p.saleId, actorId);
    } else if (result.paid) {
      // Дүн зөрсөн — FAILED биш, админ шалгана
      const reason = `QPay дүн зөрүүтэй: хүлээсэн ${p.amount}₮, төлөгдсөн ${result.paidAmount}₮`;
      await tx.payment.update({ where: { id: paymentId }, data: { reviewReason: reason } });
      await tx.paymentTransaction.update({ where: { id: t.id }, data: { providerStatus: "PAID_MISMATCH", raw: result.raw as Prisma.InputJsonValue } });
      await audit(tx, { userId: actorId, action: "payment.review", entity: "Payment", entityId: paymentId, after: { expected: p.amount, paid: result.paidAmount } });
    } else if (now > t.expiresAt) {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "CANCELLED" } });
      await tx.paymentTransaction.update({ where: { id: t.id }, data: { providerStatus: "EXPIRED" } });
      await audit(tx, { userId: actorId, action: "payment.qpay_expired", entity: "Payment", entityId: paymentId });
      cancelInvoice = true;
    }
  }, TX_OPTS);

  if (cancelInvoice) await getQPayProvider(acctOf(p)).cancelInvoice(t.providerInvoiceId).catch(() => undefined);
  return view(db, paymentId);
}

/** Хүлээгдэж буй QPay төлбөрийг менежер цуцлах (шинэ QR үүсгэхийн өмнө) */
export async function cancelPayment(paymentId: string, actorId: string): Promise<PaymentView> {
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: string; qpayAccount: QPayAccountKey | null }[]>`SELECT "status"::text AS "status", "qpayAccount"::text AS "qpayAccount" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
    if (!rows[0]) throw new UserError("Төлбөр олдсонгүй.");
    if (!["PENDING", "PROCESSING"].includes(rows[0].status)) throw new UserError("Зөвхөн хүлээгдэж буй төлбөрийг цуцална.");
    await tx.payment.update({ where: { id: paymentId }, data: { status: "CANCELLED" } });
    const txs = await tx.paymentTransaction.findMany({ where: { paymentId }, select: { providerInvoiceId: true } });
    for (const t of txs) {
      await enqueue(tx, { type: "QPAY_CANCEL_INVOICE", payload: { invoiceId: t.providerInvoiceId, account: rows[0].qpayAccount ?? "A" }, dedupeKey: `qpay-cancel:${t.providerInvoiceId}` });
    }
    await audit(tx, { userId: actorId, action: "payment.cancel", entity: "Payment", entityId: paymentId });
  });
  return view(db, paymentId);
}

/** Status polling (зөвхөн DB уншина) */
export function paymentStatus(paymentId: string) {
  return view(db, paymentId);
}

/** Worker: PROCESSING QPay төлбөрүүдийг шалгана (callback алдагдсан ч гацахгүй) */
export async function pollProcessingQPayPayments(now = new Date()) {
  const processing = await db.payment.findMany({ where: { method: "QPAY", status: "PROCESSING" }, select: { id: true }, take: 50 });
  let paid = 0;
  for (const p of processing) {
    try {
      const v = await verifyQPayPayment(p.id, null, now);
      if (v.sale.status === "PAID" && v.payment.status === "SUCCEEDED") paid++;
    } catch {
      // Дараагийн удаа дахин оролдоно
    }
  }
  // paid > 0 → үлдэгдэл хасагдсан тул storefront-ийн кэшийг шинэчлэх хэрэгтэй (worker)
  return { checked: processing.length, paid };
}
