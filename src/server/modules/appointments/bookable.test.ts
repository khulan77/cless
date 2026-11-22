import { describe, expect, it } from "vitest";
import { bookableAfterRoleChange, defaultBookable } from "./bookable";

describe("User.isBookable rules", () => {
  it("new STAFF is bookable; MANAGER/ADMIN are not", () => {
    expect(defaultBookable("STAFF")).toBe(true);
    expect(defaultBookable("MANAGER")).toBe(false);
    expect(defaultBookable("ADMIN")).toBe(false);
  });

  it("editing without a role change keeps the manual setting", () => {
    expect(bookableAfterRoleChange({ role: "MANAGER", isBookable: true }, "MANAGER")).toBe(true); // ADMIN гараар асаасан
    expect(bookableAfterRoleChange({ role: "STAFF", isBookable: false }, "STAFF")).toBe(false); // гараар унтраасан
  });

  it("a role change resets to the new role's default", () => {
    expect(bookableAfterRoleChange({ role: "MANAGER", isBookable: false }, "STAFF")).toBe(true);
    expect(bookableAfterRoleChange({ role: "STAFF", isBookable: true }, "MANAGER")).toBe(false);
    expect(bookableAfterRoleChange({ role: "STAFF", isBookable: true }, "ADMIN")).toBe(false);
  });
});
