/**
 * QPay горим:
 *  - "api"    — Merchant API (ENV бүрэн, тохиргоо "api" үед)
 *  - "manual" — СПА-ийн одоогийн QPay терминал/QR-ээр төлүүлээд менежер гүйлгээний
 *               дугаарыг оруулна. ENV байхгүй үед автоматаар энэ горим (12/1-нд заавал ажиллана).
 */
import { QPayApiProvider } from "./api";
import type { QPayProvider } from "./types";

export type QPayMode = "api" | "manual";

let override: QPayProvider | null = null;
let cached: QPayApiProvider | null = null;

/** Тестэд mock provider тохируулна */
export function setQPayProviderForTests(p: QPayProvider | null) {
  override = p;
}

export function qpayEnvConfigured(): boolean {
  return Boolean(process.env.QPAY_BASE_URL && process.env.QPAY_USERNAME && process.env.QPAY_PASSWORD && process.env.QPAY_INVOICE_CODE && process.env.QPAY_CALLBACK_SECRET);
}

/** Тохиргоо "api" бөгөөд ENV бүрэн үед л API горим */
export function effectiveQPayMode(settingMode: QPayMode): QPayMode {
  if (override) return settingMode;
  return settingMode === "api" && qpayEnvConfigured() ? "api" : "manual";
}

export function getQPayProvider(): QPayProvider {
  if (override) return override;
  if (!qpayEnvConfigured()) throw new Error("QPay API тохируулагдаагүй (QPAY_* ENV)");
  cached ??= new QPayApiProvider({
    baseUrl: process.env.QPAY_BASE_URL!,
    username: process.env.QPAY_USERNAME!,
    password: process.env.QPAY_PASSWORD!,
    invoiceCode: process.env.QPAY_INVOICE_CODE!,
    invoiceReceiverCode: process.env.QPAY_INVOICE_RECEIVER_CODE,
  });
  return cached;
}

export function callbackSecret(): string {
  return process.env.QPAY_CALLBACK_SECRET ?? "";
}
