"use server";

/**
 * Сайтын үйлчлүүлэгч (PROMPT 15 §3–4): нууц үггүй нэвтрэлт, онлайн захиалга, Миний бүртгэл.
 * Хамгаалалт: үйлчлүүлэгчийн тусдаа session (requireCustomer); нийтийн action-ууд кодын хязгаартай.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { audit } from "@/server/audit";
import { clientIp } from "@/server/auth/rate-limit";
import { completeCustomerProfile, profileSchema, requestCustomerCode, verifyCustomerCode } from "@/server/modules/customer-auth/login";
import { createCustomerSession, requireCustomer, signOutCustomer } from "@/server/modules/customer-auth/session";
import { bookOnline, cancelMine, onlineSlots, onlineStaff } from "@/server/modules/online-booking/service";
import { checkCode, startCode } from "@/server/modules/verification/service";
import { parseInput, runAction } from "./result";

const ip = async () => clientIp(await headers());

// ───────── Нэвтрэх (нийтийн) ─────────

export async function requestCustomerCodeAction(to: string) {
  return runAction(async () => {
    const r = await requestCustomerCode({ to, ip: await ip() });
    return { id: r.id, mask: r.mask, message: r.message };
  });
}

export async function verifyCustomerCodeAction(input: { id: string; to: string; code: string }) {
  return runAction(async () => {
    const r = await verifyCustomerCode(input);
    if (r.status === "signed-in") await createCustomerSession(r.customerId);
    return r.status === "signed-in" ? { status: "signed-in" as const } : { status: "needs-profile" as const, verificationId: r.verificationId };
  });
}

export async function completeCustomerProfileAction(input: z.input<typeof profileSchema>) {
  return runAction(async () => {
    parseInput(profileSchema, input);
    const r = await completeCustomerProfile(input);
    await createCustomerSession(r.customerId);
    revalidatePath("/admin/customers");
  });
}

export async function signOutCustomerAction() {
  return runAction(async () => {
    await requireCustomer();
    await signOutCustomer();
  });
}

// ───────── Онлайн захиалга ─────────

/** Нийтийн уншилт: үйлчилгээг хийх ажилтнууд (нэрээр л) */
export async function onlineStaffAction(serviceId: string) {
  return runAction(async () => onlineStaff(z.string().min(1).parse(serviceId)));
}

/** Нийтийн уншилт: сул цагууд (захиалга хаалттай бол алдаа) */
export async function onlineSlotsAction(input: { serviceId: string; staffId: string | null; date: string }) {
  return runAction(async () => {
    const v = parseInput(z.object({ serviceId: z.string().min(1), staffId: z.string().min(1).nullable(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), input);
    return onlineSlots(v);
  });
}

export async function bookOnlineAction(input: { serviceId: string; staffId: string | null; startsAt: string; note?: string }) {
  return runAction(async () => {
    const c = await requireCustomer();
    const v = parseInput(
      z.object({ serviceId: z.string().min(1), staffId: z.string().min(1).nullable(), startsAt: z.string().min(10), note: z.string().trim().max(500).optional() }),
      input,
    );
    const a = await bookOnline({ customerId: c.id, ...v });
    revalidatePath("/account");
    revalidatePath("/admin/calendar");
    return { id: a.id, status: a.status };
  });
}

export async function cancelMyAppointmentAction(appointmentId: string) {
  return runAction(async () => {
    const c = await requireCustomer();
    await cancelMine(c.id, z.string().min(1).parse(appointmentId));
    revalidatePath("/account");
  }, "Цаг цуцлагдлаа.");
}

// ───────── Профайл ─────────

export async function updateMyNameAction(name: string) {
  return runAction(async () => {
    const c = await requireCustomer();
    const v = parseInput(z.object({ name: z.string().trim().min(2, "Нэрээ оруулна уу.").max(120) }), { name });
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: c.id }, data: { name: v.name } });
      await audit(tx, { userId: null, action: "customer.self_update", entity: "Customer", entityId: c.id, after: { name: true } });
    });
    revalidatePath("/account");
  }, "Хадгалагдлаа.");
}

/** Имэйлийг кодоор баталгаажуулна */
export async function requestEmailCodeAction(email: string) {
  return runAction(async () => {
    const c = await requireCustomer();
    const v = parseInput(z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Имэйл буруу байна.")) }), { email });
    const s = await startCode({ purpose: "CUSTOMER_EMAIL", to: v.email, ip: await ip(), customerId: c.id });
    return { id: s.id };
  }, "Имэйл рүү код илгээгдлээ.");
}

export async function confirmEmailAction(input: { id: string; email: string; code: string; consent: boolean }) {
  return runAction(async () => {
    const c = await requireCustomer();
    const v = parseInput(z.object({ id: z.string().min(1), email: z.string().trim().toLowerCase().pipe(z.email()), code: z.string().min(4).max(10), consent: z.boolean() }), input);
    const ver = await checkCode({ id: v.id, code: v.code, purpose: "CUSTOMER_EMAIL", to: v.email });
    if (ver.customerId !== c.id) throw new UserError("Код хүчингүй байна.");
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: c.id }, data: { email: v.email, emailVerifiedAt: now, emailConsentAt: v.consent ? now : null } });
      await audit(tx, { userId: null, action: "customer.email_verified", entity: "Customer", entityId: c.id, after: { emailConsent: v.consent } });
    });
    revalidatePath("/account");
  }, "Имэйл баталгаажлаа.");
}

export async function setEmailConsentAction(consent: boolean) {
  return runAction(async () => {
    const c = await requireCustomer();
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: c.id }, data: { emailConsentAt: consent ? new Date() : null } });
      await audit(tx, { userId: null, action: "customer.email_consent", entity: "Customer", entityId: c.id, after: { consent } });
    });
    revalidatePath("/account");
  }, "Хадгалагдлаа.");
}
