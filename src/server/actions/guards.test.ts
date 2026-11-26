/**
 * Хамгаалалт: server action бүр (src/server/actions/**) болон route handler бүр (src/app/**\/route.ts)
 * эрх / нэвтрэлт шалгадаг эсэхийг кодоос автоматаар шалгана. Шинэ action нэмэхэд мартахаас сэргийлнэ.
 * Нийтийн (нэвтрэлтгүй) зүйлсийг зөвхөн шалтгаантайгаар allowlist-д нэмнэ.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
// requireCustomer — сайтын үйлчлүүлэгчийн тусдаа session (PROMPT 15)
const ACTION_GUARD = /\b(requirePermission|requireAnyPermission|requireUser|requireSignedIn|requirePagePermission|requireCustomer)\s*\(/;
const ROUTE_GUARD = /\b(getCurrentUser|requirePermission|requireAnyPermission|requireUser)\s*\(/;

/** Нийтийн server action-ууд — шалтгаантай */
const PUBLIC_ACTIONS: Record<string, string> = {
  "auth.ts#login": "Нэвтрэх форм (rate limit + bcrypt auth.ts-д)",
  "auth.ts#logout": "Гарах",
  "catalog.ts#loadCollectionProducts": "Дэлгүүрийн нийтийн жагсаалт (зөвхөн нийтлэгдсэн бүтээгдэхүүн)",
  "inquiries.ts#submitInquiryAction": "\"Салонд захиалах\" нийтийн форм (honeypot, IP/утсаар 10 минутад 3, нөөц түгжихгүй)",
  // PROMPT 15: ажилтны урилга / нууц үг сэргээх — нэвтрээгүй; кодын хязгаар (утас/имэйл 1 мин/1, 1 цаг/5; IP 1 цаг/20), бүртгэл задруулахгүй
  "staff-auth.ts#requestActivationCodeAction": "Урилга идэвхжүүлэх код (хязгаартай, бүртгэл задруулахгүй)",
  "staff-auth.ts#activateAccountAction": "Урилга + код + шинэ нууц үг (код нэг удаа, 5 оролдлого)",
  "staff-auth.ts#requestResetCodeAction": "Нууц үг сэргээх код (хязгаартай, бүртгэл задруулахгүй)",
  "staff-auth.ts#resetPasswordWithCodeAction": "Код + шинэ нууц үг (код нэг удаа, 5 оролдлого)",
  // PROMPT 15 §3–4: үйлчлүүлэгчийн нууц үггүй нэвтрэлт ба онлайн захиалгын уншилт
  "customer.ts#requestCustomerCodeAction": "Үйлчлүүлэгчийн нэвтрэх код (хязгаартай)",
  "customer.ts#verifyCustomerCodeAction": "Код шалгах (нэг удаа, 5 оролдлого) → үйлчлүүлэгчийн session",
  "customer.ts#completeCustomerProfileAction": "Баталгаажсан кодоор (15 мин, нэг удаа) нэр + зөвшөөрөл",
  "customer.ts#onlineStaffAction": "Нийтийн: үйлчилгээний ажилтнуудын нэр",
  "customer.ts#onlineSlotsAction": "Нийтийн: сул цаг (захиалга асаалттай үед)",
};
/** Нэвтрэлтгүй route handler-ууд — өөрийн хамгаалалттай */
const PUBLIC_ROUTES: Record<string, RegExp> = {
  "src/app/api/auth/[...nextauth]/route.ts": /handlers/, // Auth.js
  "src/app/api/qpay/callback/route.ts": /verifyPaymentSignature\(/, // HMAC гарын үсэг
  "src/app/api/internal/revalidate/route.ts": /secretOk\(/, // shared secret + дотоод сүлжээ
  "src/app/api/wesend/webhook/route.ts": /verifySignature\(/, // WeSend HMAC гарын үсэг (PROMPT 15)
  // Хамтрагчийн health check (нийтийн, нууц мэдээлэлгүй) — файл нэмэгдэхэд л шалгагдана
  "src/app/api/finance/export/[token]/route.ts": /verifyExportToken\(/, // HMAC, хугацаатай токен (PROMPT 18)
  "src/app/api/cron/attendance/route.ts": /cronAuthorized\(/, // Vercel Cron — CRON_SECRET (PROMPT 20)
  "src/app/api/health/route.ts": /export\s+(async\s+)?function\s+GET|export\s+const\s+GET/,
};

function walk(dir: string, match: (f: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p, match);
    return match(p) ? [p] : [];
  });
}

/** `export async function name(...) { ... }` — дараагийн export хүртэлх бие */
function exportedFunctions(src: string): { name: string; body: string }[] {
  const re = /export\s+async\s+function\s+(\w+)\s*\(/g;
  const hits = [...src.matchAll(re)];
  return hits.map((m, i) => ({ name: m[1]!, body: src.slice(m.index!, hits[i + 1]?.index ?? src.length) }));
}

describe("every server action checks permissions", () => {
  const files = walk(join(ROOT, "src/server/actions"), (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith("result.ts"));
  const all = files.flatMap((f) => {
    const src = readFileSync(f, "utf8");
    if (!/^["']use server["']/m.test(src)) return [];
    return exportedFunctions(src).map((fn) => ({ id: `${relative(join(ROOT, "src/server/actions"), f)}#${fn.name}`, ...fn }));
  });

  it("finds the actions", () => {
    expect(all.length).toBeGreaterThan(40);
  });

  it.each(all.map((a) => [a.id, a] as const))("%s", (id, a) => {
    if (PUBLIC_ACTIONS[id]) return;
    expect(ACTION_GUARD.test(a.body), `${id} нь requirePermission/requireUser дуудахгүй байна`).toBe(true);
  });

  it("the allowlist has no stale entries", () => {
    for (const id of Object.keys(PUBLIC_ACTIONS)) expect(all.some((a) => a.id === id), id).toBe(true);
  });
});

describe("every route handler checks auth (or has its own guard)", () => {
  const routes = walk(join(ROOT, "src/app"), (f) => /route\.tsx?$/.test(f)).map((f) => relative(ROOT, f));

  it.each(routes)("%s", (route) => {
    const src = readFileSync(join(ROOT, route), "utf8");
    const own = PUBLIC_ROUTES[route];
    if (own) expect(own.test(src), `${route}: тусгай хамгаалалт олдсонгүй`).toBe(true);
    else expect(ROUTE_GUARD.test(src), `${route} нь нэвтрэлт/эрх шалгахгүй байна`).toBe(true);
  });
});
