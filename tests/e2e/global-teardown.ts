import { readFileSync, rmSync } from "node:fs";
import { WORKER_PID_FILE } from "./global-setup";

export default async function globalTeardown() {
  try {
    const pid = Number(readFileSync(WORKER_PID_FILE, "utf8"));
    // Negative pid: the whole process group (bun run → bun worker)
    process.kill(-pid, "SIGTERM");
  } catch {
    // already stopped
  }
  rmSync(WORKER_PID_FILE, { force: true });
}
