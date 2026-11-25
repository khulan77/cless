/**
 * WeSend (wesend.mn) — SMS, имэйл, нэг удаагийн код. Албан ёсны @wesend/node SDK.
 * WESEND_API_KEY зөвхөн сервер талд (`ws_test_…` = sandbox: юу ч илгээхгүй, кредит зарцуулахгүй).
 * Утас, имэйл, кодыг log-д бүү гарга — маскийг (mask.ts) ашигла.
 */
import "server-only";
import { WeSend, WeSendError } from "@wesend/node";
import { UserError } from "@/server/errors";

let client: WeSend | null = null;
let fetchOverride: typeof fetch | undefined;

/** Тестэд: SDK-ийн fetch-ийг mock-оор солино */
export function setWeSendFetchForTests(f: typeof fetch | undefined) {
  fetchOverride = f;
  client = null;
}

export function wesendConfigured(): boolean {
  return Boolean(process.env.WESEND_API_KEY);
}

export function isSandboxKey(): boolean {
  return (process.env.WESEND_API_KEY ?? "").startsWith("ws_test_");
}

function ws(): WeSend {
  const key = process.env.WESEND_API_KEY;
  if (!key) throw new Error("WESEND_API_KEY тохируулаагүй байна.");
  client ??= new WeSend(key, { timeout: 15_000, maxRetries: 2, ...(fetchOverride ? { fetch: fetchOverride } : {}) });
  return client;
}

/**
 * SMS/verify брэнд: зөвхөн ASCII (É → E), ≤20 тэмдэгт. WeSend verify нь ASCII биш брэндийг
 * `invalid_request`-ээр буцаадаг (prod: "CLÉSS").
 */
export function asciiBrand(raw: string | undefined): string {
  const ascii = (raw || "CLESS")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  return (ascii || "CLESS").slice(0, 20).trim();
}
export const brand = () => asciiBrand(process.env.NOTIFY_BRAND);

/** Имэйлийн from_name — unicode зөвшөөрнө ("CLÉSS") */
export const emailBrand = () => (process.env.NOTIFY_BRAND || "CLÉSS").trim().slice(0, 60);

// ───────────────────────── Алдаа → Монгол мессеж ─────────────────────────

const MESSAGES: Record<string, string> = {
  trial_recipient: "WeSend туршилтын горимд байна: зөвхөн баталгаажуулсан өөрийн утас/имэйл рүү илгээнэ. WeSend-ийн бүртгэлээ баталгаажуулна уу.",
  subscription_required: "WeSend-ийн захиалга идэвхгүй байна (туршилт дууссан эсвэл сарын төлбөр төлөгдөөгүй).",
  insufficient_credits: "WeSend-ийн үлдэгдэл хүрэлцэхгүй байна. Цэнэглэнэ үү.",
  invalid_api_key: "WeSend-ийн API түлхүүр буруу эсвэл хүчингүй болсон.",
  ip_not_allowed: "Энэ серверийн IP WeSend-ийн зөвшөөрсөн жагсаалтад алга.",
  sending_paused: "WeSend илгээлтийг түр зогсоосон байна (агуулга эсвэл буцалтын улмаас).",
  unsupported_number: "Энэ дугаарын оператор дэмжигдээгүй байна. Өөр дугаар оруулна уу.",
  content_rejected: "Мессежийн агуулгыг WeSend хүлээн авсангүй.",
  message_too_long: "Мессеж хэт урт байна.",
  invalid_code: "Код буруу байна.",
  max_attempts_reached: "Хэт олон удаа буруу код оруулсан. Шинэ код авна уу.",
  verification_expired: "Кодын хугацаа дууссан. Шинэ код авна уу.",
  rate_limited: "Хэт олон хүсэлт ирлээ. Түр хүлээгээд дахин оролдоно уу.",
  recipient_rate_limited: "Энэ дугаар/имэйл рүү хэт олон удаа илгээлээ. Түр хүлээгээд дахин оролдоно уу.",
  provider_failed: "Оператор мессежийг хүлээн авсангүй. Дахин оролдоно уу.",
  server_error: "WeSend-д түр алдаа гарлаа. Дахин оролдоно уу.",
  timeout: "WeSend хариу өгсөнгүй. Дахин оролдоно уу.",
  connection_error: "WeSend-тэй холбогдож чадсангүй.",
};

export const SEND_FAILED = "Код илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу.";

/** Утас/имэйл/кодыг алдааны текстээс арилгана (log, MessageLog-д) */
export function scrubSecrets(text: string): string {
  return text.replace(/[^\s@"']+@[^\s@"']+/g, "[email]").replace(/\+?\d[\d\s-]{4,}\d/g, "[num]");
}

/** Log/MessageLog-д: код + requestId + мессеж (утас, имэйл, кодгүй) */
export function describeError(e: unknown): string {
  if (e instanceof WeSendError) return scrubSecrets([e.code, e.status, e.requestId ? `req=${e.requestId}` : null, e.message].filter((x) => x !== null && x !== "").join(" · "));
  return scrubSecrets(e instanceof Error ? e.message : String(e));
}

export function logWeSendError(op: string, e: unknown) {
  if (e instanceof WeSendError) {
    console.error("[wesend]", { op, code: e.code, status: e.status, requestId: e.requestId, message: scrubSecrets(e.message) });
  } else {
    console.error("[wesend]", { op, message: scrubSecrets(e instanceof Error ? e.message : String(e)) });
  }
}

export function wesendMessage(e: unknown): string {
  if (e instanceof WeSendError) {
    if (e.code === "invalid_code" && typeof e.attempts_remaining === "number") return `Код буруу байна. ${e.attempts_remaining} оролдлого үлдлээ.`;
    if (MESSAGES[e.code]) return MESSAGES[e.code]!;
    if (e.status === 429) return MESSAGES.rate_limited!;
    return `Мэдэгдэл илгээхэд алдаа гарлаа (${e.code}).`;
  }
  return "Мэдэгдэл илгээхэд алдаа гарлаа.";
}

export const errorCode = (e: unknown) => (e instanceof WeSendError ? e.code : null);

/** Хэрэглэгчид харуулах алдаа (UserError) — кодыг дамжуулна */
function toUserError(e: unknown): never {
  if (e instanceof WeSendError) throw new UserError(wesendMessage(e), undefined, `WESEND_${e.code}`);
  throw e;
}

// ───────────────────────── Илгээх ─────────────────────────

export type Sent = { id: string; sandbox: boolean };

export async function sendSms(p: { to: string; text: string; idempotencyKey?: string }): Promise<Sent> {
  const r = await ws().sms.send({ to: p.to, text: p.text }, p.idempotencyKey ? { idempotencyKey: p.idempotencyKey } : undefined);
  return { id: r.id, sandbox: Boolean(r.sandbox) };
}

export async function sendEmail(p: { to: string; subject: string; html: string; text: string; replyTo?: string; idempotencyKey?: string }): Promise<Sent> {
  const r = await ws().email.send(
    { to: p.to, subject: p.subject, html: p.html, text: p.text, from_name: emailBrand(), ...(p.replyTo ? { reply_to: p.replyTo } : {}) },
    p.idempotencyKey ? { idempotencyKey: p.idempotencyKey } : undefined,
  );
  return { id: r.id, sandbox: Boolean(r.sandbox) };
}

/** Нэг удаагийн код: "@" агуулбал имэйлээр, үгүй бол SMS. Алдааг UserError болгоно. */
export async function startVerification(p: { to: string; ttl?: number }) {
  try {
    const r = await ws().verify.create({ to: p.to, locale: "mn", brand: brand(), code_length: 6, code_type: "digits", ttl: p.ttl ?? 300 });
    return { id: r.id, channel: r.channel, expiresAt: new Date(r.expires_at), sandbox: Boolean(r.sandbox) };
  } catch (e) {
    logWeSendError("verify.create", e);
    // Хэрэглэгчид техникийн код харуулахгүй (зөвхөн log-д): invalid_request, серверийн алдаа гэх мэт
    if (e instanceof WeSendError && !MESSAGES[e.code] && e.status !== 429) throw new UserError(SEND_FAILED, undefined, `WESEND_${e.code}`);
    toUserError(e);
  }
}

/** Код зөв бол true. Буруу/хугацаа дууссан/хэт олон оролдлого → UserError (Монгол мессеж). */
export async function checkVerification(id: string, code: string): Promise<true> {
  try {
    const r = await ws().verify.check(id, { code });
    if (r.status !== "approved") throw new UserError(MESSAGES.invalid_code!, undefined, "WESEND_invalid_code");
    return true;
  } catch (e) {
    if (e instanceof UserError) throw e;
    // Буруу код бол энгийн хариу — зөвхөн системийн алдааг log-д
    if (!(e instanceof WeSendError && ["invalid_code", "verification_expired", "max_attempts_reached"].includes(e.code))) logWeSendError("verify.check", e);
    toUserError(e);
  }
}

export async function getBalance() {
  const b = await ws().balance.get();
  return { balance: b.balance, unlimited: Boolean(b.unlimited), nextExpiry: b.next_expiry ? { credits: b.next_expiry.credits, expiresAt: b.next_expiry.expires_at } : null };
}

export async function getMessage(id: string) {
  const m = await ws().messages.get(id);
  return { id: m.id, status: m.status, channel: m.channel, delivery: "delivery" in m ? (m as { delivery?: { status: string } | null }).delivery?.status ?? null : null, error: m.error };
}
