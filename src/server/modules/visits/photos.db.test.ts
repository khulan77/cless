import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ubAt } from "@/lib/time";
import { db } from "@/server/db";
import { createAppointment } from "@/server/modules/appointments/service";
import { makeBookableStaff, makeCustomer, makeService, makeUser, resetDb } from "../../../../tests/db-helpers";

const dir = mkdtempSync(path.join(tmpdir(), "cless-photos-"));
process.env.STORAGE_PRIVATE_DIR = dir;
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// The media route reads the session
const session = vi.hoisted(() => ({ user: null as null | { id: string; role: "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF" } }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn(async () => session.user) }));

const { deleteVisitPhoto, uploadVisitPhoto } = await import("./photos");
const { GET } = await import("@/app/api/media/visit/[id]/route");

/** 3000×2000 JPEG with camera + GPS EXIF, the way a phone sends it */
async function phonePhoto() {
  const buf = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c8a080" } })
    .withExif({ IFD0: { Make: "PhoneMaker", Model: "X1" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "47/1 55/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "106/1 55/1 0/1" } })
    .jpeg()
    .toBuffer();
  expect((await sharp(buf).metadata()).exif).toBeDefined();
  return new File([new Uint8Array(buf)], "IMG_0001.jpg", { type: "image/jpeg" });
}
const files = () => (existsSync(dir) ? readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(".webp")) : []);
const get = (id: string) => GET(new Request(`http://x/api/media/visit/${id}`) as never, { params: Promise.resolve({ id }) } as never);

let s: Awaited<ReturnType<typeof setup>>;
async function setup() {
  const manager = await makeUser("MANAGER");
  const sara = await makeBookableStaff("Сараа");
  const nomin = await makeBookableStaff("Номин");
  const service = await makeService({ price: 100_000 });
  const customer = await makeCustomer();
  const appt = await createAppointment(
    { customerId: customer.id, serviceId: service.id, staffId: sara.id, startsAt: ubAt("2026-12-02", "10:00") },
    { id: manager.id, role: manager.role },
    new Date("2026-12-01T00:00:00Z"),
  );
  const as = (u: { id: string; role: "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF" }) => ({ id: u.id, role: u.role });
  return { manager: as(manager), sara: as(sara), nomin: as(nomin), customer, appt };
}
beforeEach(async () => {
  rmSync(dir, { recursive: true, force: true });
  await resetDb();
  s = await setup();
  session.user = null;
});

describe("visit photos (A9)", () => {
  it("needs consent once; strips EXIF/GPS; ≤2048px webp; stored outside public/", async () => {
    await expect(uploadVisitPhoto({ customerId: s.customer.id, kind: "BEFORE", consent: false, file: await phonePhoto() }, s.sara)).rejects.toThrow(/зөвшөөрсөн/);
    const p = await uploadVisitPhoto({ customerId: s.customer.id, kind: "BEFORE", appointmentId: s.appt.id, consent: true, file: await phonePhoto() }, s.sara);
    expect(p).toMatchObject({ width: 2048, height: 1365, kind: "BEFORE", appointmentId: s.appt.id });
    expect((await db.customer.findUniqueOrThrow({ where: { id: s.customer.id } })).photoConsentAt).toBeInstanceOf(Date);
    // Consent is remembered: the next upload does not ask again
    await uploadVisitPhoto({ customerId: s.customer.id, kind: "AFTER", appointmentId: s.appt.id, consent: false, file: await phonePhoto() }, s.sara);
    expect(files()).toHaveLength(2);
    expect(p.storageKey.startsWith("visit-photos/")).toBe(true);

    session.user = s.sara;
    const res = await get(p.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-type")).toBe("image/webp");
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 2048 });
    expect(meta.exif).toBeUndefined();
    expect(await db.auditLog.count({ where: { action: { in: ["customer.photo_consent", "visit_photo.create"] } } })).toBe(3);
  });

  it("only ADMIN/MANAGER and the STAFF who served the customer can see or add photos", async () => {
    const p = await uploadVisitPhoto({ customerId: s.customer.id, kind: "BEFORE", consent: true, file: await phonePhoto() }, s.manager);
    await expect(uploadVisitPhoto({ customerId: s.customer.id, kind: "AFTER", consent: true, file: await phonePhoto() }, s.nomin)).rejects.toThrow(/үйлчилж байгаагүй/);
    session.user = s.nomin;
    expect((await get(p.id)).status).toBe(404);
    session.user = null;
    expect((await get(p.id)).status).toBe(401);
    session.user = s.manager;
    expect((await get(p.id)).status).toBe(200);
    expect((await get("does-not-exist")).status).toBe(404);
  });

  it("delete: the uploader within 24h, MANAGER always; the file is removed", async () => {
    const p = await uploadVisitPhoto({ customerId: s.customer.id, kind: "BEFORE", consent: true, file: await phonePhoto() }, s.sara);
    const late = new Date(p.createdAt.getTime() + 25 * 3600_000);
    await expect(deleteVisitPhoto(p.id, s.sara, late)).rejects.toThrow(/24 цаг/);
    await deleteVisitPhoto(p.id, s.manager, late);
    expect(await db.visitPhoto.count()).toBe(0);
    expect(files()).toHaveLength(0);
  });

  it("rejects files that are not images", async () => {
    const bad = new File([new Uint8Array([1, 2, 3, 4])], "x.jpg", { type: "image/jpeg" });
    await expect(uploadVisitPhoto({ customerId: s.customer.id, kind: "BEFORE", consent: true, file: bad }, s.sara)).rejects.toThrow(/уншиж чадсангүй/);
    expect(files()).toHaveLength(0);
  });
});
