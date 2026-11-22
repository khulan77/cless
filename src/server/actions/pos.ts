"use server";

/**
 * POS-ийн нимгэн server action-ууд: эрх шалгах → module service → кэш шинэчлэх.
 * Бизнес логик бүгд src/server/modules/* дотор.
 */
import { revalidatePath, updateTag } from "next/cache";
import { can } from "@/server/auth/permissions";
import { requireAnyPermission, requirePermission } from "@/server/auth/session";
import { addCashMovement, closeShift, openShift } from "@/server/modules/cash-shifts/service";
import { createCustomer, searchCustomers, updateCustomer, type CustomerInput } from "@/server/modules/customers/service";
import { resendVisitEmail } from "@/server/modules/notifications/service";
import { cancelPayment, createPayment, verifyQPayPayment, type CreatePaymentInput } from "@/server/modules/payments/service";
import { createRefund, type RefundInput } from "@/server/modules/refunds/service";
import { searchPosCatalog } from "@/server/modules/sales/queries";
import type { ApprovalInput, CartInput } from "@/server/modules/sales/schema";
import { cancel, checkout, unlock } from "@/server/modules/sales/service";
import { saveVisit, type VisitInput } from "@/server/modules/visits/service";
import { runAction } from "./result";

/** Үлдэгдэл/нөөц өөрчлөгдсөн үед дэлгүүрийн кэш */
function stockChanged() {
  updateTag("catalog");
}

// ─────────────── Хайлт ───────────────

export async function posSearchCatalog(q: string) {
  return runAction(async () => {
    await requirePermission("pos:use");
    return searchPosCatalog(String(q ?? "").slice(0, 100));
  });
}

export async function posSearchCustomers(q: string) {
  return runAction(async () => {
    await requirePermission("customer:read");
    return searchCustomers(String(q ?? "").slice(0, 100));
  });
}

// ─────────────── Борлуулалт ───────────────

export async function posCheckout({ cart, approval }: { cart: CartInput; approval?: ApprovalInput | null }) {
  return runAction(async () => {
    const user = await requirePermission("sale:create");
    const r = await checkout(cart, { id: user.id, role: user.role }, approval);
    stockChanged();
    return r;
  });
}

export async function posUnlock(saleId: string) {
  return runAction(async () => {
    const user = await requirePermission("sale:create");
    const r = await unlock(saleId, user.id, "manual");
    stockChanged();
    return r;
  }, "Засварт буцаалаа.");
}

export async function posCancel(saleId: string) {
  return runAction(async () => {
    const user = await requirePermission("sale:create");
    const r = await cancel(saleId, user.id);
    stockChanged();
    revalidatePath("/admin/sales");
    return r;
  }, "Борлуулалтыг цуцаллаа.");
}

// ─────────────── Төлбөр ───────────────

export async function posCreatePayment(input: CreatePaymentInput) {
  return runAction(async () => {
    // Аргын эрхийг service дотор нарийвчлан шалгана
    const user = await requireAnyPermission("payment:cash", "payment:card", "payment:qpay", "payment:transfer:confirm");
    const r = await createPayment(input, { id: user.id, role: user.role });
    if (r.sale.status === "PAID") stockChanged();
    return r;
  });
}

export async function posVerifyPayment(paymentId: string) {
  return runAction(async () => {
    const user = await requirePermission("payment:qpay");
    const r = await verifyQPayPayment(paymentId, user.id);
    if (r.sale.status === "PAID") stockChanged();
    return r;
  });
}

export async function posCancelPayment(paymentId: string) {
  return runAction(async () => {
    const user = await requirePermission("payment:qpay");
    return cancelPayment(paymentId, user.id);
  }, "QPay нэхэмжлэхийг цуцаллаа.");
}

export async function refundSale(input: RefundInput) {
  return runAction(async () => {
    const user = await requirePermission("sale:refund");
    const r = await createRefund(input, user.id);
    stockChanged();
    revalidatePath("/admin/sales");
    return { status: r.status, amount: r.refund.amount };
  }, "Буцаалт хийгдлээ.");
}

// ─────────────── Үйлчлүүлэгч, айлчлал ───────────────

export async function createCustomerAction(input: CustomerInput) {
  return runAction(async () => {
    const user = await requirePermission("customer:write");
    const c = await createCustomer(input, user.id);
    revalidatePath("/admin/customers");
    return { id: c.id, name: c.name, phone: c.phone, email: c.email };
  }, "Үйлчлүүлэгч бүртгэгдлээ.");
}

export async function updateCustomerAction(id: string, input: CustomerInput) {
  return runAction(async () => {
    const user = await requirePermission("customer:write");
    await updateCustomer(id, input, user.id);
    revalidatePath(`/admin/customers/${id}`);
  }, "Хадгаллаа.");
}

export async function saveVisitAction(input: VisitInput) {
  return runAction(async () => {
    const user = await requirePermission("visit:write");
    const v = await saveVisit(input, user.id);
    revalidatePath(`/admin/customers/${v.customerId}`);
    return { id: v.id };
  }, "Айлчлал хадгалагдлаа.");
}

export async function resendVisitEmailAction(visitId: string) {
  return runAction(async () => {
    const user = await requirePermission("visit:write");
    await resendVisitEmail(visitId, user.id);
  }, "Имэйл илгээх дараалалд орлоо.");
}

// ─────────────── Кассын ээлж ───────────────

export async function openShiftAction(openingCash: number) {
  return runAction(async () => {
    const user = await requirePermission("shift:own");
    const s = await openShift({ openingCash }, user.id);
    revalidatePath("/admin/shifts");
    return { id: s.id };
  }, "Касс нээгдлээ.");
}

export async function cashMoveAction(input: { shiftId: string; type: "PAY_IN" | "PAY_OUT"; amount: number; note: string }) {
  return runAction(async () => {
    const user = await requirePermission("shift:own");
    await addCashMovement(input, { id: user.id, canAll: can(user.role, "shift:all") });
    revalidatePath("/admin/shifts");
  }, "Бүртгэгдлээ.");
}

export async function closeShiftAction(input: { shiftId: string; countedCash: number; note?: string | null }) {
  return runAction(async () => {
    const user = await requirePermission("shift:own");
    const s = await closeShift(input, { id: user.id, canAll: can(user.role, "shift:all") });
    revalidatePath("/admin/shifts");
    return { id: s.id, difference: s.difference };
  }, "Касс хаагдлаа.");
}
