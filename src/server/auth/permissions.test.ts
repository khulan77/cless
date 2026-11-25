import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, homePathFor, isReadOnly, type Permission } from "./permissions";

type Row = [Permission, staff: boolean, manager: boolean, accountant: boolean, admin: boolean];

// Шаардлагын хүснэгт — PROMPT 2 §2, 11/24-ний уулзалтаар шинэчилсэн (PROMPT 12 A1):
// MANAGER нь ADMIN-тай адил, зөвхөн хэрэглэгч (user:write) ба интеграцийн нууц тохиргоо (integration:write) үгүй.
// STAFF: өөрийн хуваарь, "Миний самбар", тэмдэглэл, айлчлалын зураг (өөрөө үйлчилсэн үйлчлүүлэгч дээр).
// PROMPT 14: ACCOUNTANT — менежерийн хэсгийг зөвхөн харна (бичих эрхгүй, айлчлалын зураггүй) + цалин бүрэн + нягтланд илгээх.
// Цалин (payroll:*) — зөвхөн ADMIN, ACCOUNTANT.
const MATRIX: Row[] = [
  ["schedule:own", true, true, false, true],
  ["schedule:all", false, true, true, true],
  ["appointment:read", false, true, true, true],
  ["appointment:write", false, true, false, true],
  ["appointment:status", false, true, false, true],
  ["appointment:done-manual", false, true, false, true],
  ["staff-schedule:write", false, true, false, true],
  ["room:write", false, true, false, true],
  ["service-staff:write", false, true, false, true],
  ["customer:contact:read", false, true, true, true],
  ["inquiry:manage", false, true, false, true],
  ["pos:use", false, true, false, true],
  ["sale:create", false, true, false, true],
  ["sale:read", false, true, true, true],
  ["payment:cash", false, true, false, true],
  ["payment:card", false, true, false, true],
  ["payment:qpay", false, true, false, true],
  ["payment:transfer:confirm", false, true, false, true],
  ["discount:over-limit", false, true, false, true],
  ["sale:refund", false, true, false, true],
  ["sale:void-paid", false, true, false, true],
  ["customer:read", false, true, true, true],
  ["customer:write", false, true, false, true],
  ["visit:write", false, true, false, true],
  ["customer-note:write", true, true, false, true],
  ["visit-photo:read", true, true, false, true],
  ["visit-photo:write", true, true, false, true],
  ["me:read", true, true, false, true],
  ["shift:own", false, true, false, true],
  ["shift:all", false, true, false, true],
  ["stock:read", false, true, true, true],
  ["stock:write", false, true, false, true],
  ["product:write", false, true, false, true],
  ["service:write", false, true, false, true],
  ["price:write", false, true, false, true],
  ["cost:read", false, true, true, true],
  ["report:read", false, true, true, true],
  ["report:send", false, true, true, true],
  ["admin:view", false, true, true, true],
  ["attendance:read", false, true, true, true],
  ["attendance:write", false, true, false, true],
  ["holiday:write", false, true, true, true],
  ["payroll:read", false, false, true, true],
  ["payroll:write", false, false, true, true],
  ["payroll:settings", false, false, true, true],
  ["user:write", false, false, false, true],
  ["settings:write", false, true, false, true],
  ["integration:write", false, false, false, true],
];

describe("permission matrix", () => {
  it.each(MATRIX)("%s → STAFF=%s MANAGER=%s ACCOUNTANT=%s ADMIN=%s", (perm, staff, manager, accountant, admin) => {
    expect(can("STAFF", perm)).toBe(staff);
    expect(can("MANAGER", perm)).toBe(manager);
    expect(can("ACCOUNTANT", perm)).toBe(accountant);
    expect(can("ADMIN", perm)).toBe(admin);
  });

  it("covers every defined permission exactly once", () => {
    const tested = MATRIX.map(([p]) => p).sort();
    expect(tested).toEqual([...PERMISSIONS].sort());
  });

  it("denies when there is no role", () => {
    for (const p of PERMISSIONS) {
      expect(can(null, p)).toBe(false);
      expect(can(undefined, p)).toBe(false);
    }
  });

  it("sends STAFF to their own schedule", () => {
    expect(homePathFor("STAFF")).toBe("/admin/schedule");
    expect(homePathFor("MANAGER")).toBe("/admin");
    expect(homePathFor("ADMIN")).toBe("/admin");
    expect(homePathFor("ACCOUNTANT")).toBe("/admin");
  });

  it("read-only mode only for ACCOUNTANT", () => {
    expect(isReadOnly("ACCOUNTANT")).toBe(true);
    for (const r of ["ADMIN", "MANAGER", "STAFF"] as const) expect(isReadOnly(r)).toBe(false);
  });
});
