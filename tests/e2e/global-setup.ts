import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { E2E_EMAIL_DIR, e2eEnv } from "./env";

export const WORKER_PID_FILE = join(process.cwd(), "tests/e2e/.worker.pid");

/** Empty e-mail folder and a running worker (the DB is prepared by tests/e2e/prepare-db.ts) */
export default async function globalSetup() {
  rmSync(E2E_EMAIL_DIR, { recursive: true, force: true });
  mkdirSync(E2E_EMAIL_DIR, { recursive: true });

  const worker = spawn("bun", ["run", "worker"], { env: e2eEnv(), stdio: "ignore", detached: true });
  worker.unref();
  writeFileSync(WORKER_PID_FILE, String(worker.pid));
}
