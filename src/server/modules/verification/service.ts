/**
 * Нэг удаагийн код (PROMPT 15): ажилтны урилга / нууц үг сэргээх, үйлчлүүлэгчийн нэвтрэлт / имэйл баталгаажуулалт.
 *
 *  - WESEND_API_KEY байвал WeSend verify (код WeSend-д хэшээр хадгалагдана, бид кодыг хэзээ ч харахгүй).
 *  - Үгүй бол (dev/test) локал код: хэшийг DB-д, нээлттэй кодыг `.emails/verify-<id>.txt` руу (гадагш илгээхгүй).
 *  - Хязгаар: нэг утас/имэйлд 1 минутад 1, 1 цагт 5; нэг IP-д 1 цагт 20. 5 буруу оролдлого → код хүчингүй.
 *  - Утас/имэйлийг DB-д HMAC хэшээр (targetHash), log-д маскаар л.
 */
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VerifyPurpose } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { emailDir } from "@/server/modules/notifications/mailer";
import { logMessage } from "@/server/modules/notifications/log";
import { maskTarget } from "@/server/modules/notifications/mask";
import * as wesend from "@/server/modules/notifications/providers/wesend";

export const CODE_TTL_SEC = 300;
export const MAX_ATTEMPTS = 5;
export const LIMITS = { perTargetMinute: 1, perTargetHour: 5, perIpHour: 20 } as const;

export const M = {
  tooSoon: "Код саяхан илгээгдсэн. 1 минутын дараа дахин авна уу.",
  tooMany: "Энэ дугаар/имэйл рүү 1 цагт хэт олон код илгээлээ. Дараа дахин оролдоно уу.",
  ipLimit: "Хэт олон хүсэлт ирлээ. 1 цагийн дараа дахин оролдоно уу.",
  invalid: "Код буруу байна.",
  expired: "Кодын хугацаа дууссан. Шинэ код авна уу.",
  maxAttempts: "Хэт олон удаа буруу код оруулсан. Шинэ код авна уу.",
  notFound: "Код хүчингүй байна. Шинэ код авна уу.",
} as const;

const secret = () => process.env.AUTH_SECRET || "cless-dev-verify-secret";
export const hashTarget = (normalized: string) => createHmac("sha256", secret()).update(`t:${normalized.toLowerCase()}`).digest("hex");
const hashIp = (ip: string) => createHmac("sha256", secret()).update(`ip:${ip}`).digest("hex");
const hashCode = (id: string, code: string) => createHash("sha256").update(`${secret()}:${id}:${code}`).digest("hex");

export type StartInput = { purpose: VerifyPurpose; to: string; ip: string; userId?: string | null; customerId?: string | null };

/** Хязгаар шалгана (DB-ээс, тиймээс серверийн олон instance-д ч ажиллана) */
export async function assertSendAllowed(to: string, ip: string, now = new Date()) {
  const t = hashTarget(to);
  const [lastMinute, lastHour, ipHour] = await Promise.all([
    db.verification.count({ where: { targetHash: t, createdAt: { gt: new Date(now.getTime() - 60_000) } } }),
    db.verification.count({ where: { targetHash: t, createdAt: { gt: new Date(now.getTime() - 3_600_000) } } }),
    db.verification.count({ where: { ipHash: hashIp(ip), createdAt: { gt: new Date(now.getTime() - 3_600_000) } } }),
  ]);
  if (lastMinute >= LIMITS.perTargetMinute) throw new UserError(M.tooSoon, undefined, "CODE_TOO_SOON");
  if (lastHour >= LIMITS.perTargetHour) throw new UserError(M.tooMany, undefined, "CODE_TOO_MANY");
  if (ipHour >= LIMITS.perIpHour) throw new UserError(M.ipLimit, undefined, "CODE_IP_LIMIT");
}

/** Код илгээнэ. Буцаана: verificationId (client-д), маск. Өмнөх хүлээгдэж буй ижил зорилгын кодыг цуцална. */
export async function startCode(input: StartInput, now = new Date()) {
  const to = input.to.trim().toLowerCase();
  await assertSendAllowed(to, input.ip, now);
  const targetHash = hashTarget(to);
  const channel = to.includes("@") ? "EMAIL" : "SMS";
  await db.verification.updateMany({ where: { targetHash, purpose: input.purpose, status: "PENDING" }, data: { status: "CANCELED" } });

  const base = {
    purpose: input.purpose,
    channel,
    targetHash,
    targetMask: maskTarget(to),
    userId: input.userId ?? null,
    customerId: input.customerId ?? null,
    ipHash: hashIp(input.ip),
  } as const;

  if (wesend.wesendConfigured()) {
    // Хязгаарыг тоолохын тулд эхлээд мөр үүсгэнэ (WeSend амжилтгүй бол ч тоологдоно — давтан дарахаас хамгаална)
    const row = await db.verification.create({ data: { ...base, expiresAt: new Date(now.getTime() + CODE_TTL_SEC * 1000) } });
    try {
      const r = await wesend.startVerification({ to, ttl: CODE_TTL_SEC });
      await db.verification.update({ where: { id: row.id }, data: { providerId: r.id, expiresAt: r.expiresAt } });
      await logMessage({ channel: "VERIFY", kind: input.purpose, to, status: "SENT", providerId: r.id, sandbox: r.sandbox });
      return { id: row.id, mask: base.targetMask, channel, expiresAt: r.expiresAt };
    } catch (e) {
      await db.verification.update({ where: { id: row.id }, data: { status: "CANCELED" } });
      await logMessage({ channel: "VERIFY", kind: input.purpose, to, status: "FAILED", error: wesend.describeError(e) });
      throw e;
    }
  }

  // Локал (dev/test): 6 оронтой код
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = await db.verification.create({ data: { ...base, expiresAt: new Date(now.getTime() + CODE_TTL_SEC * 1000) } });
  await db.verification.update({ where: { id: row.id }, data: { codeHash: hashCode(row.id, code) } });
  const dir = emailDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `verify-${row.id}.txt`), `to: ${to}\npurpose: ${input.purpose}\ncode: ${code}\n`, "utf8");
  await logMessage({ channel: "VERIFY", kind: input.purpose, to, status: "SENT", providerId: `local:${row.id}`, sandbox: true });
  return { id: row.id, mask: base.targetMask, channel, expiresAt: row.expiresAt, ...(process.env.NODE_ENV === "test" ? { devCode: code } : {}) };
}

/**
 * Кодыг шалгана. `to` — хэрэглэгчийн оруулсан утас/имэйл (verification-тай таарах ёстой).
 * Амжилттай бол APPROVED болгож мөрийг буцаана. Нэг код нэг л удаа.
 */
export async function checkCode(p: { id: string; code: string; purpose: VerifyPurpose; to?: string }, now = new Date()) {
  const code = p.code.replace(/\s/g, "");
  const v = await db.verification.findUnique({ where: { id: p.id } });
  if (!v || v.purpose !== p.purpose || v.status === "CANCELED" || v.status === "APPROVED") throw new UserError(M.notFound, undefined, "CODE_NOT_FOUND");
  if (p.to && v.targetHash !== hashTarget(p.to.trim().toLowerCase())) throw new UserError(M.notFound, undefined, "CODE_NOT_FOUND");
  if (v.status === "EXPIRED" || v.expiresAt <= now) {
    await db.verification.update({ where: { id: v.id }, data: { status: "EXPIRED" } });
    throw new UserError(M.expired, undefined, "CODE_EXPIRED");
  }
  if (v.attempts >= MAX_ATTEMPTS) throw new UserError(M.maxAttempts, undefined, "CODE_MAX_ATTEMPTS");
  if (!/^\d{4,8}$/.test(code)) throw new UserError(M.invalid, { code: [M.invalid] }, "CODE_INVALID");

  let ok = false;
  if (v.providerId) {
    try {
      ok = await wesend.checkVerification(v.providerId, code);
    } catch (e) {
      await db.verification.update({ where: { id: v.id }, data: { attempts: { increment: 1 } } });
      if (e instanceof UserError && (e.code === "WESEND_verification_expired" || e.code === "WESEND_max_attempts_reached")) {
        await db.verification.update({ where: { id: v.id }, data: { status: "EXPIRED" } });
      }
      throw e;
    }
  } else if (v.codeHash) {
    const a = Buffer.from(v.codeHash, "hex");
    const b = Buffer.from(hashCode(v.id, code), "hex");
    ok = a.length === b.length && timingSafeEqual(a, b);
  }
  if (!ok) {
    const n = await db.verification.update({ where: { id: v.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - n.attempts;
    if (left <= 0) {
      await db.verification.update({ where: { id: v.id }, data: { status: "EXPIRED" } });
      throw new UserError(M.maxAttempts, { code: [M.maxAttempts] }, "CODE_MAX_ATTEMPTS");
    }
    throw new UserError(`${M.invalid} ${left} оролдлого үлдлээ.`, { code: [M.invalid] }, "CODE_INVALID");
  }
  // Зэрэг шалгалтаас хамгаална: зөвхөн PENDING-ийг APPROVED болгоно
  const r = await db.verification.updateMany({ where: { id: v.id, status: "PENDING" }, data: { status: "APPROVED", approvedAt: now } });
  if (r.count !== 1) throw new UserError(M.notFound, undefined, "CODE_NOT_FOUND");
  return v;
}
