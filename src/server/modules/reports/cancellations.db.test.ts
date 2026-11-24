import { beforeEach, describe, expect, it } from "vitest";
import { ubAt } from "@/lib/time";
import { db } from "@/server/db";
import { changeStatus, createAppointment } from "@/server/modules/appointments/service";
import { makeBookableStaff, makeCustomer, makeService, makeUser, resetDb } from "../../../../tests/db-helpers";
import { listCancellations } from "./cancellations";

const DAY = "2026-12-02";
const NOW = new Date("2026-12-01T00:00:00Z");

beforeEach(async () => {
  await resetDb();
});

describe("Тайлан → Цуцлалт (A6)", () => {
  it("lists who/when/why, filters by staff and category, counts by category", async () => {
    const manager = await makeUser("MANAGER");
    const as = { id: manager.id, role: manager.role };
    const sara = await makeBookableStaff("Сараа");
    const nomin = await makeBookableStaff("Номин");
    const service = await makeService({ price: 200_000, durationMin: 60 });
    const customer = await makeCustomer();
    const book = (staffId: string, hm: string) => createAppointment({ customerId: customer.id, serviceId: service.id, staffId, startsAt: ubAt(DAY, hm) }, as, NOW);

    const a = await book(sara.id, "10:00");
    const b = await book(nomin.id, "10:00");
    const c = await book(sara.id, "12:00");
    await changeStatus({ id: a.id, action: "cancel", category: "CUSTOMER" }, as, NOW);
    await changeStatus({ id: b.id, action: "cancel", category: "STAFF_SICK", reason: "Ханиад" }, as, NOW);
    await book(sara.id, "14:00"); // not cancelled — not listed
    // A cancellation from before A6: no category, no who/when
    await db.appointment.update({ where: { id: c.id }, data: { status: "CANCELLED", cancelReason: "Цаг өөрчилсөн" } });

    const range = { from: DAY, to: DAY };
    const all = await listCancellations(range);
    expect(all.rows).toHaveLength(3);
    expect(all.rows.find((r) => r.id === b.id)).toMatchObject({ staff: "Номин", cancelledBy: manager.name, category: "STAFF_SICK", reason: "Ханиад" });
    expect(all.rows.find((r) => r.id === c.id)).toMatchObject({ category: null, cancelledBy: null, reason: "Цаг өөрчилсөн" });
    expect(all.byCategory).toEqual([
      { category: "CUSTOMER", count: 1 },
      { category: "STAFF_SICK", count: 1 },
      { category: null, count: 1 },
    ]);
    expect((await listCancellations(range, { staffId: sara.id })).rows.map((r) => r.id).sort()).toEqual([a.id, c.id].sort());
    expect((await listCancellations(range, { category: "STAFF_SICK" })).rows.map((r) => r.id)).toEqual([b.id]);
    expect((await listCancellations(range, { category: "nonsense" })).rows).toHaveLength(3); // unknown filter is ignored
    expect((await listCancellations({ from: "2026-12-03", to: "2026-12-03" })).rows).toHaveLength(0);
  });
});
