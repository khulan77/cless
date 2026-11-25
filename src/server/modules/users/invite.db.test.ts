/** Ажилтны урилга → код → нууц үг; нууц үг сэргээх; MANAGER-ийн хязгаар (PROMPT 15 §2) */
import bcrypt from "bcryptjs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError } from "@/server/errors";
import { makeUser, resetDb } from "../../../../tests/db-helpers";
import { activateAccount, cancelInvite, createInvitedUser, editUser, requestStaffCode, resetWithCode } from "./invite";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cless-invite-"));
  process.env.EMAIL_FILE_DIR = dir;
  delete process.env.WESEND_API_KEY;
});
afterAll(async () => {
  delete process.env.EMAIL_FILE_DIR;
  await rm(dir, { recursive: true, force: true });
});

let admin: Awaited<ReturnType<typeof makeUser>>;
let manager: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser("ADMIN");
  manager = await makeUser("MANAGER");
});
const as = (u: { id: string; role: "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF" }) => ({ id: u.id, role: u.role });
const IP = "10.1.1.1";
const GOOD = "Сайн-нууц-үг-2026";

describe("урилга → код → нууц үг", () => {
  it("нууц үггүй урих (INVITED), SMS-д холбоос (код биш); идэвхжүүлэх; код нэг удаа", async () => {
    const r = await createInvitedUser({ name: "Сараа", phone: "9911 2233", role: "STAFF", baseSalary: 1_500_000 }, as(admin));
    expect(r.delivery).toEqual({ ok: true });
    const u = await db.user.findUniqueOrThrow({ where: { id: r.id } });
    expect(u).toMatchObject({ status: "INVITED", loginPhone: "99112233", email: null, baseSalary: 1_500_000, isBookable: true });
    const sms = (await readdir(dir)).find((f) => f.startsWith("sms-invite"))!;
    const text = await readFile(path.join(dir, sms), "utf8");
    expect(text).toContain("/admin/activate");

    const c = await requestStaffCode({ identifier: "99112233", purpose: "STAFF_INVITE", ip: IP });
    expect(c.devCode).toMatch(/^\d{6}$/);
    await expect(activateAccount({ id: c.id, identifier: "99112233", code: c.devCode!, password: "12345678", confirm: "12345678" })).rejects.toThrow();
    await activateAccount({ id: c.id, identifier: "99112233", code: c.devCode!, password: GOOD, confirm: GOOD });
    const after = await db.user.findUniqueOrThrow({ where: { id: r.id } });
    expect(after).toMatchObject({ status: "ACTIVE", mustChangePassword: false });
    expect(await bcrypt.compare(GOOD, after.passwordHash)).toBe(true);
    await expect(activateAccount({ id: c.id, identifier: "99112233", code: c.devCode!, password: GOOD, confirm: GOOD })).rejects.toThrow(/хүчингүй/);
    expect(await db.auditLog.count({ where: { action: "user.activated" } })).toBe(1);
  });

  it("72 цагийн дараа дуусна; цуцалсан урилгаар код ирэхгүй", async () => {
    const r = await createInvitedUser({ name: "Номин", phone: "88112233", role: "STAFF" }, as(admin));
    const c = await requestStaffCode({ identifier: "88112233", purpose: "STAFF_INVITE", ip: IP });
    await db.user.update({ where: { id: r.id }, data: { inviteExpiresAt: new Date(Date.now() - 1000) } });
    await expect(activateAccount({ id: c.id, identifier: "88112233", code: c.devCode!, password: GOOD, confirm: GOOD })).rejects.toThrow(/хугацаа дууссан/);

    const r2 = await createInvitedUser({ name: "Туяа", phone: "95112233", role: "STAFF" }, as(admin));
    await cancelInvite(r2.id, as(admin));
    const c2 = await requestStaffCode({ identifier: "95112233", purpose: "STAFF_INVITE", ip: IP });
    expect(c2.devCode).toBeUndefined(); // ижил хариу, гэхдээ код үүсээгүй
    expect(await db.verification.count({ where: { userId: r2.id } })).toBe(0);
  });

  it("нууц үг мартсан: бүртгэлгүй ч ижил хариу; код → шинэ нууц үг, хуучин session хүчингүй", async () => {
    const unknown = await requestStaffCode({ identifier: "unknown@x.mn", purpose: "STAFF_RESET", ip: IP });
    expect(unknown.message).toBe("Хэрэв бүртгэлтэй бол код илгээгдлээ.");
    expect(unknown.devCode).toBeUndefined();

    const u = await makeUser("STAFF", { email: "staff@x.mn" });
    const c = await requestStaffCode({ identifier: "STAFF@x.mn", purpose: "STAFF_RESET", ip: IP });
    expect(c.message).toBe(unknown.message);
    await resetWithCode({ id: c.id, identifier: "staff@x.mn", code: c.devCode!, password: GOOD, confirm: GOOD });
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await bcrypt.compare(GOOD, after.passwordHash)).toBe(true);
    expect(after.passwordChangedAt).not.toBeNull();
  });
});

describe("MANAGER — зөвхөн STAFF", () => {
  it("MANAGER → MANAGER/ADMIN/ACCOUNTANT үүсгэх, STAFF-ийг дэвшүүлэх, менежерийг засах → татгалзана; цалин тавихгүй", async () => {
    for (const role of ["MANAGER", "ADMIN", "ACCOUNTANT"] as const) {
      await expect(createInvitedUser({ name: "Хэн нэгэн", phone: "97112233", role }, as(manager))).rejects.toBeInstanceOf(ForbiddenError);
    }
    const r = await createInvitedUser({ name: "Гоо сайханч", phone: "94112233", role: "STAFF", baseSalary: 9_999_999 }, as(manager));
    const staff = await db.user.findUniqueOrThrow({ where: { id: r.id } });
    expect(staff.baseSalary).toBe(0);

    const base = { id: staff.id, name: staff.name, phone: "94112233", isActive: true };
    await expect(editUser({ ...base, role: "MANAGER" }, as(manager))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(editUser({ ...base, role: "ADMIN" }, as(manager))).rejects.toBeInstanceOf(ForbiddenError);
    await editUser({ ...base, name: "Шинэ нэр", role: "STAFF", baseSalary: 5_000_000 }, as(manager));
    expect(await db.user.findUniqueOrThrow({ where: { id: staff.id } })).toMatchObject({ name: "Шинэ нэр", role: "STAFF", baseSalary: 0 });

    const other = await makeUser("MANAGER");
    await expect(editUser({ id: other.id, name: "x y", phone: "93112233", role: "MANAGER", isActive: false }, as(manager))).rejects.toBeInstanceOf(ForbiddenError);
    // ADMIN — бүгдийг, цалинтай
    await editUser({ ...base, role: "MANAGER", baseSalary: 2_000_000 }, as(admin));
    expect(await db.user.findUniqueOrThrow({ where: { id: staff.id } })).toMatchObject({ role: "MANAGER", baseSalary: 2_000_000 });
  });

  it("утас давхардахгүй", async () => {
    await createInvitedUser({ name: "Ажилтан А", phone: "99001122", role: "STAFF" }, as(admin));
    await expect(createInvitedUser({ name: "Ажилтан Б", phone: "+976 9900-1122", role: "STAFF" }, as(admin))).rejects.toThrow(/бүртгэлтэй/);
  });
});
