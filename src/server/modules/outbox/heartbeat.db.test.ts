import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../../../tests/db-helpers";
import { beat, getWorkerHeartbeat, workerStatus } from "./heartbeat";

beforeEach(resetDb);

describe("worker heartbeat", () => {
  it("is stale when missing or older than 5 minutes", async () => {
    expect((await workerStatus()).stale).toBe(true);
    const at = new Date();
    await beat({}, at);
    expect(await workerStatus(new Date(at.getTime() + 60_000))).toMatchObject({ minutesAgo: 1, stale: false });
    expect(await workerStatus(new Date(at.getTime() + 6 * 60_000))).toMatchObject({ minutesAgo: 6, stale: true });
  });

  it("getWorkerHeartbeat returns null when missing, latest row after beat", async () => {
    expect(await getWorkerHeartbeat()).toBeNull();
    const at = new Date("2026-11-22T10:00:00.000Z");
    await beat({ pid: 42 }, at);
    expect(await getWorkerHeartbeat()).toMatchObject({ lastRunAt: at, info: { pid: 42 } });
  });
});
