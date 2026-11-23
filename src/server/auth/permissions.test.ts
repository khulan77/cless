import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, homePathFor, type Permission } from "./permissions";

type Row = [Permission, staff: boolean, manager: boolean, admin: boolean];

// Шаардлагын хүснэгт (PROMPT 2 §2) — үг үсгээр нь
const MATRIX: Row[] = [
  ["schedule:own", true, true, true],
  ["schedule:all", false, true, true],
  ["appointment:read", false, true, true],
  ["appointment:write", false, true, true],
  ["appointment:status", false, true, true],
  ["appointment:done-manual", false, false, true],
  ["staff-schedule:write", false, false, true],
  ["room:write", false, false, true],
  ["service-staff:write", false, false, true],
  ["customer:contact:read", false, true, true],
  ["inquiry:manage", false, true, true],
  ["pos:use", false, true, true],
  ["sale:create", false, true, true],
  ["sale:read", false, true, true],
  ["payment:cash", false, true, true],
  ["payment:card", false, true, true],
  ["payment:qpay", false, true, true],
  ["payment:transfer:confirm", false, false, true],
  ["discount:over-limit", false, false, true],
  ["sale:refund", false, false, true],
  ["sale:void-paid", false, false, true],
  ["customer:read", false, true, true],
  ["customer:write", false, true, true],
  ["visit:write", false, true, true],
  ["shift:own", false, true, true],
  ["shift:all", false, false, true],
  ["stock:read", false, true, true],
  ["stock:write", false, false, true],
  ["product:write", false, false, true],
  ["service:write", false, false, true],
  ["price:write", false, false, true],
  ["cost:read", false, false, true],
  ["report:read", false, false, true],
  ["payroll:write", false, false, true],
  ["user:write", false, false, true],
  ["settings:write", false, false, true],
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
