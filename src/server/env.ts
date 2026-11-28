/**
 * Орчны хувьсагчийн шалгалт. App (instrumentation.ts) ба worker асахад дуудагдана —
 * дутуу/буруу бол ойлгомжтой жагсаалттай алдаа шидэж процесс ЗОГСОНО.
 *
 * Production шалгалт NODE_ENV=production үед. Локалд production build-ийг http-ээр турших (E2E)
 * үед ENV_CHECK=relaxed — https / Resend / internal secret шаардлагыг сулруулна (анхааруулга бичнэ).
 */
import { z } from "zod";

export type EnvTarget = "app" | "worker";
export type EnvIssue = { key: string; message: string };

const QPAY_KEYS = ["QPAY_BASE_URL", "QPAY_USERNAME", "QPAY_PASSWORD", "QPAY_INVOICE_CODE", "QPAY_CALLBACK_SECRET"] as const;

const url = (protocols: string[]) =>
  z.string().refine((v) => {
    try {
      return protocols.includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, `${protocols.join(" / ")} хэлбэрийн URL байх ёстой`);

/** Шалгалтын үр дүн (тест, preflight-д ч ашиглана). Юу ч шидэхгүй. */
export function checkEnv(env: Record<string, string | undefined>, target: EnvTarget): { issues: EnvIssue[]; warnings: EnvIssue[] } {
  const issues: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];
  const prod = env.NODE_ENV === "production";
  const relaxed = env.ENV_CHECK === "relaxed";
  const strict = prod && !relaxed;
  const need = (key: string, message: string) => issues.push({ key, message });
  const warn = (key: string, message: string) => warnings.push({ key, message });
  const set = (key: string) => Boolean(env[key]?.trim());

  // Өгөгдлийн сан
  if (!set("DATABASE_URL")) need("DATABASE_URL", "Заавал. postgresql://… холболт.");
  else if (!url(["postgresql:", "postgres:"]).safeParse(env.DATABASE_URL).success) need("DATABASE_URL", "postgresql:// хэлбэрийн URL байх ёстой.");
  if (set("DIRECT_URL") && !url(["postgresql:", "postgres:"]).safeParse(env.DIRECT_URL).success) need("DIRECT_URL", "postgresql:// хэлбэрийн URL байх ёстой.");

  // Auth (app)
  if (target === "app") {
    if (!set("AUTH_SECRET")) need("AUTH_SECRET", "Заавал. Үүсгэх: openssl rand -base64 32");
    else if (env.AUTH_SECRET!.length < 32) (prod ? need : warn)("AUTH_SECRET", "Хамгийн багадаа 32 тэмдэгт.");
  }

  // Сайтын хаяг
  if (!set("NEXT_PUBLIC_SITE_URL")) (prod ? need : warn)("NEXT_PUBLIC_SITE_URL", "Сайтын бүрэн хаяг (https://…).");
  else if (!url(strict ? ["https:"] : ["https:", "http:"]).safeParse(env.NEXT_PUBLIC_SITE_URL).success) {
    need("NEXT_PUBLIC_SITE_URL", strict ? "Production-д https:// байх ёстой." : "http(s):// хэлбэрийн URL байх ёстой.");
  }

  // Мэдэгдэл (PROMPT 15): WeSend — SMS, имэйл, нэг удаагийн код. Resend — хуучирсан (зөвхөн имэйл).
  const legacyEmail = set("RESEND_API_KEY") && set("EMAIL_FROM");
  if (strict) {
    if (!set("WESEND_API_KEY") && !legacyEmail) need("WESEND_API_KEY", "Production-д заавал (SMS, имэйл, нэвтрэх код).");
    else if (!set("WESEND_API_KEY")) warn("WESEND_API_KEY", "Байхгүй — SMS, нэвтрэх/урилгын код илгээгдэхгүй (имэйл хуучирсан Resend-ээр).");
  } else if (!set("WESEND_API_KEY") && !set("RESEND_API_KEY")) {
    warn("WESEND_API_KEY", "Байхгүй — SMS, имэйл, код .emails/ хавтас руу файл болж бичигдэнэ.");
  }

  // QPay (PROMPT 29: A — компани, B — захирал): дансны аль нэг түлхүүр байвал тэр дансны бүх түлхүүр + нийтлэг
  // QPAY_BASE_URL, QPAY_CALLBACK_SECRET заавал (хагас тохиргоо = API горим ажиллахгүй). A — хуучин QPAY_USERNAME… ч болно.
  const needed = new Set<string>();
  const QPAY_COMMON = ["QPAY_BASE_URL", "QPAY_CALLBACK_SECRET"] as const;
  const CREDS = ["USERNAME", "PASSWORD", "INVOICE_CODE"] as const;
  let anyAccount = false;
  for (const acct of ["A", "B"] as const) {
    const usesNew = CREDS.some((c) => set(`QPAY_${acct}_${c}`));
    const name = (c: string) => (acct === "A" && !usesNew ? `QPAY_${c}` : `QPAY_${acct}_${c}`);
    if (!CREDS.some((c) => set(name(c)))) continue;
    anyAccount = true;
    for (const c of CREDS) if (!set(name(c))) needed.add(name(c));
    for (const k of QPAY_COMMON) if (!set(k)) needed.add(k);
  }
  if (!anyAccount && QPAY_COMMON.some(set)) for (const k of QPAY_KEYS) if (!set(k)) needed.add(k);
  for (const k of needed) need(k, "QPay API горимд заавал (бусад QPAY_* тохируулагдсан).");
  if (set("QPAY_BASE_URL") && !url(["https:"]).safeParse(env.QPAY_BASE_URL).success) need("QPAY_BASE_URL", "https:// байх ёстой.");
  if (set("QPAY_CALLBACK_SECRET") && env.QPAY_CALLBACK_SECRET!.length < 32) need("QPAY_CALLBACK_SECRET", "Хамгийн багадаа 32 тэмдэгт.");

  // Worker → app кэш шинэчлэх дотоод холболт
  if (!set("INTERNAL_REVALIDATE_SECRET")) {
    (strict ? need : warn)("INTERNAL_REVALIDATE_SECRET", "Worker-ийн үлдэгдлийн өөрчлөлт сайтын кэшийг шинэчилж чадахгүй. 32+ тэмдэгт.");
  } else if (env.INTERNAL_REVALIDATE_SECRET!.length < 32) {
    (strict ? need : warn)("INTERNAL_REVALIDATE_SECRET", "Хамгийн багадаа 32 тэмдэгт.");
  }
  if (target === "worker" && strict && !set("APP_INTERNAL_URL")) {
    need("APP_INTERNAL_URL", "Worker-ээс app руу дотоод хаяг, жишээ: http://app:20267");
  }
  if (set("APP_INTERNAL_URL") && !url(["http:", "https:"]).safeParse(env.APP_INTERNAL_URL).success) need("APP_INTERNAL_URL", "http(s):// URL байх ёстой.");

  if (prod && relaxed) warn("ENV_CHECK", "relaxed — production шалгалт сулруулсан (зөвхөн локал тест).");
  return { issues, warnings };
}

export class EnvError extends Error {
  constructor(public issues: EnvIssue[], target: EnvTarget) {
    super(`Орчны хувьсагч буруу/дутуу (${target}):\n${issues.map((i) => `  - ${i.key}: ${i.message}`).join("\n")}\n.env.example-ийг үзнэ үү.`);
    this.name = "EnvError";
  }
}

/** Асахад: алдаатай бол шидэнэ (процесс зогсоно), анхааруулгыг буцаана */
export function assertEnv(target: EnvTarget, env: Record<string, string | undefined> = process.env) {
  const { issues, warnings } = checkEnv(env, target);
  if (issues.length) throw new EnvError(issues, target);
  return warnings;
}
