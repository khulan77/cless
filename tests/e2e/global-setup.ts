import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { E2E_BASE_URL, E2E_EMAIL_DIR, E2E_INTERNAL_SECRET, e2eEnv } from "./env";

export const WORKER_PID_FILE = join(process.cwd(), "tests/e2e/.worker.pid");

/** Empty e-mail folder and a running worker (the DB is prepared by tests/e2e/prepare-db.ts) */
export default async function globalSetup() {
  // The DB was just reset, but `next start` keeps storefront pages regenerated in earlier runs
  // (.next on disk). Expire the catalog cache the same way the worker does.
  const res = await fetch(`${E2E_BASE_URL}/api/internal/revalidate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": E2E_INTERNAL_SECRET },
    body: JSON.stringify({ tags: ["catalog"], reason: "e2e-setup" }),
  });
  if (!res.ok) throw new Error(`internal revalidate failed: ${res.status}`);

  rmSync(E2E_EMAIL_DIR, { recursive: true, force: true });
  mkdirSync(E2E_EMAIL_DIR, { recursive: true });

  const worker = spawn("bun", ["run", "worker"], { env: e2eEnv(), stdio: "ignore", detached: true });
  worker.unref();
  writeFileSync(WORKER_PID_FILE, String(worker.pid));
}
