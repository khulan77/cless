/**
 * Тест / E2E эхлэхэд: .env (эсвэл .env.local)-д prod-ын түлхүүр байвал АНХААРУУЛГА хэвлэнэ.
 * Тестүүд эдгээрийг ашиглахгүй (DB — локал, E2E env — хоосолсон), гэхдээ санамсаргүй хэрэглээнээс сэргийлж мэдэгдэнэ.
 * Зөвхөн хувьсагчийн НЭР хэвлэнэ — утгыг хэзээ ч.
 */
import { readFileSync } from "node:fs";

function parse(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split("\n")
        .map((l) => /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => [m[1]!, m[2]!.trim().replace(/^["']|["']$/g, "")]),
    );
  } catch {
    return {};
  }
}

const isRemoteDb = (v: string) => /supabase\.(co|com)|neon\.tech|amazonaws\.com/i.test(v);

/** Prod гэж үзэх түлхүүрүүдийн нэр (файл бүрээр) */
export function prodKeysIn(env: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [k, v] of Object.entries(env)) {
    if (!v) continue;
    if (k === "SUPABASE_URL" || k === "SUPABASE_SERVICE_ROLE_KEY") hits.push(k);
    else if (k === "WESEND_API_KEY" && !v.startsWith("ws_test_")) hits.push(k);
    else if ((k === "DATABASE_URL" || k === "DIRECT_URL") && isRemoteDb(v)) hits.push(k);
    else if (k === "RESEND_API_KEY" || /^QPAY_.*(SECRET|PASSWORD|KEY)/.test(k)) hits.push(k);
  }
  return hits;
}

export function warnIfProdEnv(label: string) {
  for (const file of [".env", ".env.local"]) {
    const hits = prodKeysIn(parse(file));
    if (hits.length === 0) continue;
    const line = "!".repeat(72);
    console.warn(
      `\n${line}\n[${label}] АНХААР: ${file}-д prod/жинхэнэ түлхүүр байна: ${hits.join(", ")}\n` +
        `  Тестүүд локал DB ашиглана, E2E эдгээрийг хоосолно — гэхдээ шаардлагагүй бол ${file}-ээс хасаж .env.demo г.м. тусад нь хадгална уу.\n${line}\n`,
    );
  }
}
