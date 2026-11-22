/**
 * STAFF зөвхөн өөрийн цагийг уншина — server action-ыг шууд дуудаж (session-ийг mock хийж) шалгана.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { ubAt } from "@/lib/time";
import { can, type Permission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";
import { createAppointment } from "@/server/modules/appointments/service";
import { mySchedule } from "@/server/modules/appointments/queries";
import { makeBookableStaff, makeCustomer, makeService, makeUser, resetDb } from "../../../tests/db-helpers";

let current: { id: string; role: Role } | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/server/auth/session", () => {
  const need = (ok: boolean) => {
    if (!current) throw new UnauthorizedError();
    if (!ok) throw new ForbiddenError();
    return { ...current, name: "x", email: "x", isActive: true };
  };
  return {
    requirePermission: async (p: Permission) => need(Boolean(current && can(current.role, p))),
    requireAnyPermission: async (...ps: Permission[]) => need(Boolean(current && ps.some((p) => can(current!.role, p)))),
  };
});
const { apptDetail, apptCreate, apptStatus } = await import("./appointments");

const NOW = new Date("2026-12-01T00:00:00Z");
beforeEach(async () => {
  await resetDb();
  current = null;
});

describe("appointment actions — access", () => {
  it("STAFF reads only their own appointment and never the customer's phone/email", async () => {
    const manager = await makeUser("MANAGER");
    const sara = await makeBookableStaff("Сараа");
    const nomin = await makeBookableStaff("Номин");
    const service = await makeService({ price: 100_000 });
    const customer = await makeCustomer({ email: "secret@test.mn" });
    const mine = await createAppointment({ customerId: customer.id, serviceId: service.id, staffId: sara.id, startsAt: ubAt("2026-12-02", "10:00") }, { id: manager.id, role: "MANAGER" }, NOW);
    const theirs = await createAppointment({ customerId: customer.id, serviceId: service.id, staffId: nomin.id, startsAt: ubAt("2026-12-02", "10:00") }, { id: manager.id, role: "MANAGER" }, NOW);

    current = { id: sara.id, role: "STAFF" };
    const own = await apptDetail(mine.id);
    expect(own.ok).toBe(true);
    if (own.ok) {
      expect(own.data.customer).not.toHaveProperty("phone");
      expect(own.data.customer).not.toHaveProperty("email");
    }
    const other = await apptDetail(theirs.id);
    expect(other).toMatchObject({ ok: false, status: 403 });

    // STAFF цаг үүсгэх/төлөв солих эрхгүй
    expect(await apptCreate({ customerId: customer.id, serviceId: service.id, staffId: sara.id, startsAt: ubAt("2026-12-02", "12:00") })).toMatchObject({ ok: false, status: 403 });
    expect(await apptStatus({ id: mine.id, action: "confirm" })).toMatchObject({ ok: false, status: 403 });

    // "Миний хуваарь": зөвхөн өөрийнх, холбоо барих талбаргүй
    const list = await mySchedule(sara.id, "2026-12-02", 1);
    expect(list.map((a) => a.id)).toEqual([mine.id]);
    expect(list[0]!.customer).toEqual({ name: customer.name });

    // MANAGER бүгдийг, утастай нь
    current = { id: manager.id, role: "MANAGER" };
    const m = await apptDetail(theirs.id);
    expect(m.ok && m.data.customer.phone).toBe(customer.phone);
  });
});
