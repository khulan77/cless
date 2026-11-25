"use server";

/**
 * Ажилтны нийтийн урсгал (нэвтрээгүй): урилга идэвхжүүлэх, нууц үг сэргээх. Хамгаалалт: кодын хязгаар
 * (verification/service.ts — утас/имэйл, IP), бүртгэл байгаа эсэхийг задруулахгүй, код нэг удаа.
 */
import { headers } from "next/headers";
import { clientIp } from "@/server/auth/rate-limit";
import { activateAccount, activateSchema, requestStaffCode, resetWithCode } from "@/server/modules/users/invite";
import { parseInput, runAction } from "./result";

const ip = async () => clientIp(await headers());

export async function requestActivationCodeAction(identifier: string) {
  return runAction(async () => {
    const r = await requestStaffCode({ identifier, purpose: "STAFF_INVITE", ip: await ip() });
    return { id: r.id };
  }, "Хэрэв урилга хүчинтэй бол код илгээгдлээ.");
}

export async function activateAccountAction(input: { id: string; identifier: string; code: string; password: string; confirm: string }) {
  return runAction(async () => {
    await activateAccount(parseInput(activateSchema, input));
  }, "Бүртгэл идэвхжлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.");
}

export async function requestResetCodeAction(identifier: string) {
  return runAction(async () => {
    const r = await requestStaffCode({ identifier, purpose: "STAFF_RESET", ip: await ip() });
    return { id: r.id };
  }, "Хэрэв бүртгэлтэй бол код илгээгдлээ.");
}

export async function resetPasswordWithCodeAction(input: { id: string; identifier: string; code: string; password: string; confirm: string }) {
  return runAction(async () => {
    await resetWithCode(parseInput(activateSchema, input));
  }, "Нууц үг солигдлоо. Шинэ нууц үгээрээ нэвтэрнэ үү.");
}
