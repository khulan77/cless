import { readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** E2E runs against its own local DB (never Supabase) */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? `postgresql://${userInfo().username}@127.0.0.1:5432/cless_e2e`;
export const E2E_PORT = Number(process.env.E2E_PORT ?? 20268);
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_INTERNAL_SECRET = "e2e-internal-revalidate-secret-000000000000";
export const E2E_EMAIL_DIR = process.env.E2E_EMAIL_DIR ?? join(tmpdir(), "cless-e2e-emails");

/** Only SEED_ADMIN_PASSWORD is read from .env — the rest (Supabase URLs) must not leak into E2E */
export function seedPassword(): string {
  if (process.env.SEED_ADMIN_PASSWORD) return process.env.SEED_ADMIN_PASSWORD;
  try {
    const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("SEED_ADMIN_PASSWORD="));
    return line ? line.slice("SEED_ADMIN_PASSWORD=".length).trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

/** Environment for every process started by the E2E run (server, seed, worker) */
export function e2eEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    // Локал production build-ийг http-ээр туршина (src/server/env.ts)
    ENV_CHECK: "relaxed",
    DATABASE_URL: E2E_DATABASE_URL,
    DIRECT_URL: E2E_DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-secret-not-for-production-use-000",
    AUTH_TRUST_HOST: "true",
    NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
    EMAIL_FILE_DIR: E2E_EMAIL_DIR,
    RESEND_API_KEY: "",
    // `next start` .env-ийг уншдаг — E2E хэзээ ч жинхэнэ SMS/имэйл илгээхгүй (код → EMAIL_FILE_DIR)
    WESEND_API_KEY: "",
    SEED_ADMIN_PASSWORD: seedPassword(),
    INTERNAL_REVALIDATE_SECRET: E2E_INTERNAL_SECRET,
    APP_INTERNAL_URL: E2E_BASE_URL,
  };
}
