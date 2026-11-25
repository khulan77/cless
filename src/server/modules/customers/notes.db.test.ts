import { beforeEach, describe, expect, it } from "vitest";
import { ubAt } from "@/lib/time";
import { db } from "@/server/db";
import { createAppointment } from "@/server/modules/appointments/service";
import { makeBookableStaff, makeCustomer, makeService, makeUser, resetDb } from "../../../../tests/db-helpers";
import { canSeeCustomer, servedCustomerIds } from "./access";
import { createNote, deleteNote, listNotes, updateNote } from "./notes";

beforeEach(async () => {
  await resetDb();
});

async function setup() {
  const manager = await makeUser("MANAGER");
  const sara = await makeBookableStaff("Сараа");
  const nomin = await makeBookableStaff("Номин");
  const service = await makeService({ price: 100_000 });
  const customer = await makeCustomer();
  const other = await makeCustomer();
  await createAppointment(
    { customerId: customer.id, serviceId: service.id, staffId: sara.id, startsAt: ubAt("2026-12-02", "10:00") },
    { id: manager.id, role: manager.role },
    new Date("2026-12-01T00:00:00Z"),
  );
  const as = (u: { id: string; role: "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF" }) => ({ id: u.id, role: u.role });
  return { manager: as(manager), sara: as(sara), nomin: as(nomin), customer, other };
}

describe("customer notes (A8)", () => {
  it("STAFF writes only on customers they served; MANAGER on anyone", async () => {
    const s = await setup();
    expect(await servedCustomerIds(s.sara.id)).toEqual([s.customer.id]);
    expect(await canSeeCustomer(s.sara, s.customer.id)).toBe(true);
    expect(await canSeeCustomer(s.sara, s.other.id)).toBe(false);
    expect(await canSeeCustomer(s.manager, s.other.id)).toBe(true);

    await createNote({ customerId: s.customer.id, body: "Арьс мэдрэг, хүчиллэг бодисонд улайдаг" }, s.sara);
    await expect(createNote({ customerId: s.other.id, body: "x" }, s.sara)).rejects.toThrow(/үйлчилж байгаагүй/);
    await expect(createNote({ customerId: s.customer.id, body: "x" }, s.nomin)).rejects.toThrow(/үйлчилж байгаагүй/);
    await createNote({ customerId: s.other.id, body: "Утсаар ярихыг илүүд үздэг" }, s.manager);
    await expect(createNote({ customerId: s.customer.id, body: "   " }, s.sara)).rejects.toThrow();

    const notes = await listNotes(s.customer.id);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ author: { name: "Сараа" }, body: "Арьс мэдрэг, хүчиллэг бодисонд улайдаг" });
    expect(await db.auditLog.count({ where: { action: "customer_note.create" } })).toBe(2);
    // The note text is never copied into the audit log
    const logs = await db.auditLog.findMany({ where: { action: "customer_note.create" } });
    expect(JSON.stringify(logs)).not.toContain("мэдрэг");
  });

  it("the author edits/deletes within 24h; MANAGER always; other STAFF never", async () => {
    const s = await setup();
    const note = await createNote({ customerId: s.customer.id, body: "Анхны тэмдэглэл" }, s.sara);
    const soon = new Date(note.createdAt.getTime() + 23 * 3600_000);
    const late = new Date(note.createdAt.getTime() + 25 * 3600_000);
    await updateNote({ id: note.id, body: "Засварласан" }, s.sara, soon);
    await expect(updateNote({ id: note.id, body: "Хэтэрсэн" }, s.sara, late)).rejects.toThrow(/24 цаг/);
    await expect(deleteNote(note.id, s.nomin, soon)).rejects.toThrow(/24 цаг/);
    await updateNote({ id: note.id, body: "Менежер зассан" }, s.manager, late);
    expect((await db.customerNote.findUniqueOrThrow({ where: { id: note.id } })).body).toBe("Менежер зассан");
    await deleteNote(note.id, s.manager, late);
    expect(await db.customerNote.count()).toBe(0);
    expect(await db.auditLog.count({ where: { entity: "CustomerNote" } })).toBe(4);
  });
});
