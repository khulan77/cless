import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, homePathFor, type Permission } from "./permissions";

type Row = [Permission, staff: boolean, manager: boolean, admin: boolean];

// Шаардлагын хүснэгт — PROMPT 2 §2, 11/24-ний уулзалтаар шинэчилсэн (PROMPT 12 A1):
// MANAGER нь ADMIN-тай адил, зөвхөн хэрэглэгч (user:write) ба интеграцийн нууц тохиргоо (integration:write) үгүй.
// STAFF: өөрийн хуваарь, "Миний самбар", тэмдэглэл, айлчлалын зураг (өөрөө үйлчилсэн үйлчлүүлэгч дээр).
const MATRIX: Row[] = [
  ["schedule:own", true, true, true],
  ["schedule:all", false, true, true],
  ["appointment:read", false, true, true],
  ["appointment:write", false, true, true],
  ["appointment:status", false, true, true],
  ["appointment:done-manual", false, true, true],
  ["staff-schedule:write", false, true, true],
  ["room:write", false, true, true],
  ["service-staff:write", false, true, true],
  ["customer:contact:read", false, true, true],
  ["inquiry:manage", false, true, true],
  ["pos:use", false, true, true],
  ["sale:create", false, true, true],
  ["sale:read", false, true, true],
  ["payment:cash", false, true, true],
  ["payment:card", false, true, true],
  ["payment:qpay", false, true, true],
  ["payment:transfer:confirm", false, true, true],
  ["discount:over-limit", false, true, true],
  ["sale:refund", false, true, true],
  ["sale:void-paid", false, true, true],
  ["customer:read", false, true, true],
  ["customer:write", false, true, true],
  ["visit:write", false, true, true],
  ["customer-note:write", true, true, true],
  ["visit-photo:read", true, true, true],
  ["visit-photo:write", true, true, true],
  ["me:read", true, true, true],
  ["shift:own", false, true, true],
  ["shift:all", false, true, true],
  ["stock:read", false, true, true],
  ["stock:write", false, true, true],
  ["product:write", false, true, true],
  ["service:write", false, true, true],
  ["price:write", false, true, true],
  ["cost:read", false, true, true],
  ["report:read", false, true, true],
  ["report:send", false, true, true],
  ["payroll:write", false, true, true],
  ["user:write", false, false, true],
  ["settings:write", false, true, true],
  ["integration:write", false, false, true],
];

describe("permission matrix", () => {
  it.each(MATRIX)("%s → STAFF=%s MANAGER=%s ADMIN=%s", (perm, staff, manager, admin) => {
    expect(can("STAFF", perm)).toBe(staff);
    expect(can("MANAGER", perm)).toBe(manager);
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
  });
});
