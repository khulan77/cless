/**
 * Бүтэцтэй server log: нэг мөр = нэг JSON (level, msg, time, requestId?, userId?, ...).
 * Нууц үг, токен, secret, картын мэдээлэл, Authorization/cookie ХЭЗЭЭ Ч бичигдэхгүй — redact().
 * Next ба worker хоёуланд ажиллана (server-only-гүй).
 */
type Level = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

/** Түлхүүрийн нэр нь эдгээрийг агуулбал утгыг бүхэлд нь нууна */
const SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|card(number|no)?|cvv|cvc|pan\b|otp|session/i;
/** Утганд (текстэнд) орсон нууцыг нууна: Bearer токен, URL-ийн нууц үг, картын дугаар */
const SECRET_VALUE: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]"],
  [/(\w+:\/\/[^:/\s]+:)[^@\s]+@/g, "$1[REDACTED]@"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[REDACTED_CARD]"],
];
const MAX_DEPTH = 6;
const MAX_STRING = 2000;

function redactString(s: string): string {
  let out = s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…` : s;
  for (const [re, rep] of SECRET_VALUE) out = out.replace(re, rep);
  return out;
}

export function redact(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), ...(value.stack ? { stack: redactString(value.stack) } : {}) };
  }
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Нэг мөр JSON (тестэд шууд шалгана) */
export function formatLine(level: Level, msg: string, fields: LogFields = {}, now = new Date()): string {
  const safe = redact(fields) as LogFields;
  return JSON.stringify({ level, time: now.toISOString(), msg: redactString(msg), ...safe });
}

function write(level: Level, msg: string, fields?: LogFields) {
  const line = formatLine(level, msg, fields);
  if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const log = {
  debug: (msg: string, fields?: LogFields) => (process.env.LOG_LEVEL === "debug" ? write("debug", msg, fields) : undefined),
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
};
