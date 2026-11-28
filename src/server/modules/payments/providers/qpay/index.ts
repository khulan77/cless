/**
 * QPay горим:
 *  - "api"    — Merchant API (ENV бүрэн, тохиргоо "api" үед)
 *  - "manual" — СПА-ийн одоогийн QPay терминал/QR-ээр төлүүлээд менежер гүйлгээний
 *               дугаарыг оруулна. ENV байхгүй үед автоматаар энэ горим (12/1-нд заавал ажиллана).
 *
 * PROMPT 29: хоёр QPay merchant данс — A (компани), B (захирал). Нууц зөвхөн ENV-д:
 *   QPAY_A_USERNAME / QPAY_A_PASSWORD / QPAY_A_INVOICE_CODE (/ QPAY_A_INVOICE_RECEIVER_CODE)
 *   QPAY_B_USERNAME / QPAY_B_PASSWORD / QPAY_B_INVOICE_CODE (/ QPAY_B_INVOICE_RECEIVER_CODE)
 *   Хуучин нэг дансны QPAY_USERNAME / QPAY_PASSWORD / QPAY_INVOICE_CODE → A (backward compatible).
 *   QPAY_BASE_URL, QPAY_CALLBACK_SECRET — хоёр дансанд нийтлэг.
 * Данс бүр тусдаа provider (тусдаа token cache).
 * НӨАТ / eBarimt данснаас хамаарахгүй — данс нь зөвхөн мөнгө хүлээн авах газар.
 */
import { QPayApiProvider } from "./api";
import type { QPayProvider } from "./types";

export type QPayMode = "api" | "manual";
export const QPAY_ACCOUNTS = ["A", "B"] as const;
export type QPayAccountKey = (typeof QPAY_ACCOUNTS)[number];

let override: QPayProvider | Partial<Record<QPayAccountKey, QPayProvider>> | null = null;
const cached = new Map<QPayAccountKey, QPayApiProvider>();

const isProvider = (x: unknown): x is QPayProvider => typeof (x as QPayProvider | null)?.createInvoice === "function";

/** Тестэд mock provider: нэг provider (хоёр дансанд) эсвэл { A, B } */
export function setQPayProviderForTests(p: QPayProvider | Partial<Record<QPayAccountKey, QPayProvider>> | null) {
  override = p;
}

type AccountEnv = { username: string; password: string; invoiceCode: string; invoiceReceiverCode?: string };

/** Дансны ENV (A нь хуучин QPAY_* -ыг fallback болгон уншина) */
export function qpayAccountEnv(acct: QPayAccountKey, env: NodeJS.ProcessEnv = process.env): AccountEnv | null {
  const get = (k: string) => env[`QPAY_${acct}_${k}`] || (acct === "A" ? env[`QPAY_${k}`] : undefined) || "";
  const username = get("USERNAME");
  const password = get("PASSWORD");
  const invoiceCode = get("INVOICE_CODE");
  if (!username || !password || !invoiceCode) return null;
  return { username, password, invoiceCode, invoiceReceiverCode: get("INVOICE_RECEIVER_CODE") || undefined };
}

const commonEnv = (env: NodeJS.ProcessEnv = process.env) => Boolean(env.QPAY_BASE_URL && env.QPAY_CALLBACK_SECRET);

/** Тухайн дансны API түлхүүр бүрэн эсэх */
export function qpayAccountConfigured(acct: QPayAccountKey, env: NodeJS.ProcessEnv = process.env): boolean {
  if (override) return isProvider(override) ? true : Boolean(override[acct]);
  return commonEnv(env) && qpayAccountEnv(acct, env) !== null;
}

/** Аль нэг данс API-д бэлэн эсэх (хуучин нэг дансны шалгалттай ижил утга) */
export function qpayEnvConfigured(): boolean {
  return QPAY_ACCOUNTS.some((a) => qpayAccountConfigured(a));
}

/** Тохиргоо "api" бөгөөд ENV бүрэн үед л API горим */
export function effectiveQPayMode(settingMode: QPayMode): QPayMode {
  if (override) return settingMode;
  return settingMode === "api" && qpayEnvConfigured() ? "api" : "manual";
}

export function getQPayProvider(acct: QPayAccountKey = "A"): QPayProvider {
  if (override) {
    const p = isProvider(override) ? override : override[acct];
    if (!p) throw new Error(`QPay данс ${acct} тохируулагдаагүй (тест)`);
    return p;
  }
  const env = qpayAccountEnv(acct);
  if (!env || !commonEnv()) throw new Error(`QPay данс ${acct} API тохируулагдаагүй (QPAY_${acct}_* ENV)`);
  let p = cached.get(acct);
  if (!p) {
    p = new QPayApiProvider({
      baseUrl: process.env.QPAY_BASE_URL!,
      ...env,
      onToken: (at) => {
        void recordQPayToken(acct, at);
      },
    });
    cached.set(acct, p);
  }
  return p;
}

/** A — хуучин түлхүүр (Тохиргоо → QPay "сүүлд холбогдсон"); B — тусдаа */
export const QPAY_TOKEN_HEARTBEAT = "qpay-token";
export const qpayTokenHeartbeat = (acct: QPayAccountKey) => (acct === "A" ? QPAY_TOKEN_HEARTBEAT : `qpay-token-${acct}`);

/** Сүүлд амжилттай token авсан мөч (DB-д — app ба worker хоёулаа) */
async function recordQPayToken(acct: QPayAccountKey, at: Date) {
  try {
    const { db } = await import("@/server/db");
    const id = qpayTokenHeartbeat(acct);
    await db.workerHeartbeat.upsert({ where: { id }, create: { id, lastRunAt: at }, update: { lastRunAt: at } });
  } catch {
    // Хяналтын мэдээлэл — төлбөрийг саатуулахгүй
  }
}

export function callbackSecret(): string {
  return process.env.QPAY_CALLBACK_SECRET ?? "";
}
