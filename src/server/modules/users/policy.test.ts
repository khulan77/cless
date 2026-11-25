import { describe, expect, it } from "vitest";
import { assignableRoles, canAssign, canEditSalary, canManageUser } from "./policy";

describe("who may add whom (PROMPT 15 §2)", () => {
  it("ADMIN → every role; MANAGER → STAFF only; ACCOUNTANT, STAFF → nobody", () => {
    expect(assignableRoles("ADMIN")).toEqual(["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"]);
    expect(assignableRoles("MANAGER")).toEqual(["STAFF"]);
    expect(assignableRoles("ACCOUNTANT")).toEqual([]);
    expect(assignableRoles("STAFF")).toEqual([]);
  });

  it.each([
    ["MANAGER", null, "STAFF", true],
    ["MANAGER", null, "MANAGER", false],
    ["MANAGER", null, "ADMIN", false],
    ["MANAGER", null, "ACCOUNTANT", false],
    ["MANAGER", "STAFF", "MANAGER", false], // дэвшүүлэхгүй
    ["MANAGER", "MANAGER", "STAFF", false], // менежерийг бууруулахгүй
    ["MANAGER", "STAFF", "STAFF", true],
    ["ADMIN", "STAFF", "ADMIN", true],
    ["ACCOUNTANT", null, "STAFF", false],
  ] as const)("%s: %s → %s = %s", (actor, from, to, ok) => {
    expect(canAssign(actor, from, to)).toBe(ok);
  });

  it("MANAGER only manages STAFF; salary only ADMIN and ACCOUNTANT", () => {
    expect(canManageUser("MANAGER", "STAFF")).toBe(true);
    expect(canManageUser("MANAGER", "ADMIN")).toBe(false);
    expect(canEditSalary("ADMIN")).toBe(true);
    expect(canEditSalary("ACCOUNTANT")).toBe(true);
    expect(canEditSalary("MANAGER")).toBe(false);
    expect(canEditSalary("STAFF")).toBe(false);
  });
});
