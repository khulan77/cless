/**
 * Run by Playwright's webServer command BEFORE `next start`: fresh local DB + seed.
 * (globalSetup runs after the web server starts, which is too late for a schema reset.)
 */
import { spawnSync } from "node:child_process";
import { resetLocalDb } from "../reset-local-db";
import { E2E_DATABASE_URL, e2eEnv } from "./env";

await resetLocalDb(E2E_DATABASE_URL);
const seed = spawnSync("bun", ["prisma/seed.ts"], { env: { ...e2eEnv(), NODE_ENV: "development" }, encoding: "utf8" });
if (seed.status !== 0) {
  console.error(`Seed амжилтгүй:\n${seed.stdout}\n${seed.stderr}`);
  process.exit(1);
}
console.log("[e2e] DB бэлэн:", new URL(E2E_DATABASE_URL).pathname.slice(1));
