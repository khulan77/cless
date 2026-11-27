/**
 * PROMPT 27 §3: бүтээгдэхүүний зарлага — үйлчилгээнд олгох, санал (норм − олгосон), сарын дүн, тайлан.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { can } from "@/server/auth/permissions";
import { makeBookableStaff, makeCustomer, makeService, makeUser, makeVariant, resetDb } from "../../../../tests/db-helpers";
import { issueForService, monthlyFlows, serviceUseReport, suggestionsForAppointment } from "./service-use";

beforeEach(resetDb);

describe("үйлчилгээнд олгох", () => {
  it("цагтай холбож олгоно → үлдэгдэл хасагдана; үйлчилгээ, гоо сайханч цагаас; норм − олгосон санал; тайлан", async () => {
    const manager = await makeUser("MANAGER");
    const staff = await makeBookableStaff("Сараа");
    const serum = await makeVariant({ price: 180_000, stock: 5, cost: 60_000, name: "SERUM" });
    const service = await makeService({ price: 250_000, consumables: [{ variantId: serum.id, qty: 0.4 }] });
    const customer = await makeCustomer();
    const branch = await db.branch.findFirstOrThrow({ where: { code: "CL" } });
    const at = new Date(Date.now() - 3_600_000);
    const appt = await db.appointment.create({
      data: { customerId: customer.id, serviceId: service.id, staffId: staff.id, branchId: branch.id, startsAt: at, endsAt: new Date(at.getTime() + 3_600_000), blockedUntil: new Date(at.getTime() + 3_600_000), status: "DONE" },
    });

    expect((await suggestionsForAppointment(appt.id))!.items).toEqual([expect.objectContaining({ variantId: serum.id, norm: 0.4, suggested: 1, issued: 0, stock: 5 })]);
    const r = await issueForService({ variantId: serum.id, qty: 1, appointmentId: appt.id, note: "Нүүрний эмчилгээнд" }, manager.id);
    expect(r.stock).toBe(4);
    expect(await db.stockMovement.findUniqueOrThrow({ where: { id: r.movementId } })).toMatchObject({ type: "SERVICE_USE", qty: -1, unitCost: 60_000, serviceId: service.id, staffId: staff.id, appointmentId: appt.id });
    expect((await suggestionsForAppointment(appt.id))!.items[0]).toMatchObject({ suggested: 0, issued: 1 });

    await expect(issueForService({ variantId: serum.id, qty: 10 }, manager.id)).rejects.toThrow(/хүрэлцэхгүй/);

    const from = new Date(Date.now() - 86_400_000);
    const to = new Date(Date.now() + 86_400_000);
    expect((await monthlyFlows([serum.id], from, to)).get(serum.id)).toEqual({ sold: 0, serviceUse: 1, received: 0 });
    const rep = await serviceUseReport(from, to);
    expect(rep.totalCost).toBe(60_000);
    expect(rep.byStaff).toEqual([expect.objectContaining({ name: "Сараа", qty: 1, cost: 60_000 })]);
    expect(await db.auditLog.count({ where: { action: "stock.service_use" } })).toBe(1);
  });

  it("эрх: олгох — MANAGER, ADMIN; нягтлан — үгүй (бүртгэл/үнэ/орлого л)", () => {
    expect(can("MANAGER", "stock:issue")).toBe(true);
    expect(can("ADMIN", "stock:issue")).toBe(true);
    expect(can("ACCOUNTANT", "stock:issue")).toBe(false);
    expect(can("STAFF", "stock:issue")).toBe(false);
  });
});
