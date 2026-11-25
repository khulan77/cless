import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";
import { changeOwnPassword } from "@/server/modules/users/password";
import { makeUser, resetDb } from "../../../tests/db-helpers";
import { can, type Permission } from "./permissions";
import { LOGIN_WINDOW_MS, isLoginBlocked, lockedUntil, recordLoginAttempt } from "./rate-limit";
import { isSessionValid } from "./session-rules";

let current: { id: string; role: Role } | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/server/auth/session", () => ({
  requirePermission: async (p: Permission) => {
    if (!current) throw new UnauthorizedError();
    if (!can(current.role, p)) throw new ForbiddenError();
    return { ...current, name: "Admin", email: "a@x", isActive: true };
  },
  requireAnyPermission: async (...ps: Permission[]) => {
    if (!current) throw new UnauthorizedError();
    if (!ps.some((p) => can(current!.role, p))) throw new ForbiddenError();
    return { ...current, name: "Admin", email: "a@x", isActive: true };
  },
}));
const { resetPassword } = await import("@/server/actions/users");

beforeEach(async () => {
  await resetDb();
  current = null;
});

describe("login lockout", () => {
  const t0 = new Date("2026-12-01T02:00:00Z");
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);

  it("5 failures within 15 min → locked for 15 min from the 5th failure", () => {
    const five = [0, 1, 2, 3, 4].map(at);
    expect(lockedUntil(five.slice(0, 4), at(5))).toBeNull();
    expect(lockedUntil(five, at(5))?.toISOString()).toBe(at(4 + 15).toISOString());
    expect(lockedUntil(five, at(18))).not.toBeNull();
    expect(lockedUntil(five, at(19))).toBeNull();
    // 5 failures spread over more than 15 minutes do not lock
    expect(lockedUntil([0, 5, 10, 15, 20].map(at), at(21))).toBeNull();
  });

  it("the 6th attempt is blocked (by email, from any IP) and a correct password does not bypass it", async () => {
    for (let i = 0; i < 5; i++) await recordLoginAttempt(`10.0.0.${i}`, "victim@x.mn", false);
    expect(await isLoginBlocked("10.0.0.99", "victim@x.mn")).toBe(true);
    expect(await isLoginBlocked("10.0.0.99", "other@x.mn")).toBe(false);
    expect(await isLoginBlocked("10.0.0.99", "victim@x.mn", new Date(Date.now() + LOGIN_WINDOW_MS + 60_000))).toBe(false);
  });
});

describe("passwords and sessions", () => {
  it("fallback: a temporary password (≥10 chars) must be changed at first login", async () => {
    const admin = await makeUser("ADMIN");
    current = { id: admin.id, role: "ADMIN" };
    const u = await makeUser("STAFF");
    expect(await resetPassword({ id: u.id, password: "short-pw" })).toMatchObject({ ok: false });
    await db.user.update({ where: { id: u.id }, data: { mustChangePassword: false } });
    expect((await resetPassword({ id: u.id, password: "another-temp-1" })).ok).toBe(true);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.mustChangePassword).toBe(true);
    expect(after.passwordChangedAt).not.toBeNull();
  });

  it("changing your own password checks the current one, clears the flag and invalidates older sessions", async () => {
    const u = await makeUser("MANAGER", { password: "old-password-1" });
    await db.user.update({ where: { id: u.id }, data: { mustChangePassword: true } });
    const tokenFromLogin = 0; // passwordChangedAt was null at login

    await expect(changeOwnPassword(u.id, { current: "wrong", next: "brand-new-pass", confirm: "brand-new-pass" })).rejects.toThrow(/буруу/);
    await expect(changeOwnPassword(u.id, { current: "old-password-1", next: "short", confirm: "short" })).rejects.toThrow();
    await expect(changeOwnPassword(u.id, { current: "old-password-1", next: "brand-new-pass", confirm: "different-pass" })).rejects.toThrow();

    const at = new Date("2026-12-01T03:00:00Z");
    await changeOwnPassword(u.id, { current: "old-password-1", next: "brand-new-pass", confirm: "brand-new-pass" }, at);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("brand-new-pass", after.passwordHash)).toBe(true);
    // Old session (issued before the change) is invalid; a new login (pwdAt = change time) is valid
    expect(isSessionValid(after, tokenFromLogin)).toBe(false);
    expect(isSessionValid(after, at.getTime())).toBe(true);
    // Deactivated user: invalid immediately
    expect(isSessionValid({ ...after, isActive: false }, at.getTime())).toBe(false);
    expect(await db.auditLog.count({ where: { action: "user.change_password", entityId: u.id } })).toBe(1);
  });
});
