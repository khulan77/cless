import { beforeEach, describe, expect, it } from "vitest";
import { makeUser, resetDb } from "../../../../tests/db-helpers";
import { addCashMovement, closeShift, openShift, shiftReport } from "./service";

let manager: Awaited<ReturnType<typeof makeUser>>;
let other: Awaited<ReturnType<typeof makeUser>>;

beforeEach(async () => {
  await resetDb();
  manager = await makeUser("MANAGER");
  other = await makeUser("MANAGER");
});

describe("cash shifts", () => {
  it("only one open shift per branch (also under concurrency)", async () => {
    const r = await Promise.allSettled([openShift({ openingCash: 0 }, manager.id), openShift({ openingCash: 0 }, other.id)]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    await expect(openShift({ openingCash: 0 }, manager.id)).rejects.toThrow(/аль хэдийн нээлттэй/);
  });

  it("expected cash = opening + pay-in − pay-out; difference needs a note", async () => {
    const s = await openShift({ openingCash: 100_000 }, manager.id);
    await addCashMovement({ shiftId: s.id, type: "PAY_IN", amount: 20_000, note: "Задаргаа" }, { id: manager.id, canAll: false });
    await addCashMovement({ shiftId: s.id, type: "PAY_OUT", amount: 5_000, note: "Ус авсан" }, { id: manager.id, canAll: false });
    await expect(addCashMovement({ shiftId: s.id, type: "PAY_OUT", amount: 1_000_000, note: "Хэт их" }, { id: manager.id, canAll: false })).rejects.toThrow(
      /хүрэлцэх/,
    );
    await expect(closeShift({ shiftId: s.id, countedCash: 114_000 }, { id: manager.id, canAll: false })).rejects.toThrow(/тайлбар/);
    const closed = await closeShift({ shiftId: s.id, countedCash: 114_000, note: "1000 дутсан" }, { id: manager.id, canAll: false });
    expect(closed.expectedCash).toBe(115_000);
    expect(closed.difference).toBe(-1_000);
    const rep = await shiftReport(s.id);
    expect(rep.expectedCash).toBe(115_000);
    // Хаасны дараа шинээр нээж болно
    await expect(openShift({ openingCash: 0 }, manager.id)).resolves.toBeTruthy();
  });

  it("a manager cannot close someone else's shift; shift:all can", async () => {
    const s = await openShift({ openingCash: 0 }, manager.id);
    await expect(closeShift({ shiftId: s.id, countedCash: 0 }, { id: other.id, canAll: false })).rejects.toThrow(/өөрийн/);
    await expect(closeShift({ shiftId: s.id, countedCash: 0 }, { id: other.id, canAll: true })).resolves.toBeTruthy();
  });
});
