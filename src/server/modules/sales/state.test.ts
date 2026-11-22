import { describe, expect, it } from "vitest";
import type { SaleStatus } from "@/generated/prisma/enums";
import { SaleStateError, canTransition, isEditable, nextStatus, type SaleAction } from "./state";

const ALL: SaleStatus[] = ["DRAFT", "PENDING_PAYMENT", "PARTIALLY_PAID", "PAID", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED"];
const ACTIONS: SaleAction[] = ["lock", "unlock", "cancel", "pay", "refund"];

// The full allowed table. Anything not listed must throw.
const ALLOWED: Record<SaleAction, SaleStatus[]> = {
  lock: ["DRAFT"],
  unlock: ["PENDING_PAYMENT"],
  cancel: ["DRAFT", "PENDING_PAYMENT"],
  pay: ["PENDING_PAYMENT", "PARTIALLY_PAID"],
  refund: ["PAID", "PARTIALLY_REFUNDED"],
};

describe("transition table", () => {
  for (const action of ACTIONS) {
    for (const from of ALL) {
      const ok = ALLOWED[action].includes(from);
      it(`${from} --${action}--> ${ok ? "allowed" : "forbidden"}`, () => {
        expect(canTransition(from, action)).toBe(ok);
        const amounts = { total: 100, paidAmount: action === "refund" ? 100 : 0, refundedAmount: 50 };
        if (ok) expect(() => nextStatus(from, action, amounts)).not.toThrow();
        else expect(() => nextStatus(from, action, amounts)).toThrow(SaleStateError);
      });
    }
  }
});

describe("targets", () => {
  it("lock → PENDING_PAYMENT, unlock → DRAFT, cancel → CANCELLED", () => {
    expect(nextStatus("DRAFT", "lock")).toBe("PENDING_PAYMENT");
    expect(nextStatus("PENDING_PAYMENT", "unlock", { total: 100, paidAmount: 0 })).toBe("DRAFT");
    expect(nextStatus("DRAFT", "cancel")).toBe("CANCELLED");
    expect(nextStatus("PENDING_PAYMENT", "cancel", { total: 100, paidAmount: 0 })).toBe("CANCELLED");
  });

  it("unlock / cancel are refused once any payment succeeded", () => {
    expect(() => nextStatus("PENDING_PAYMENT", "unlock", { total: 100, paidAmount: 1 })).toThrow(/Буцаалт/);
    expect(() => nextStatus("PENDING_PAYMENT", "cancel", { total: 100, paidAmount: 1 })).toThrow(SaleStateError);
  });

  it("pay: partial → PARTIALLY_PAID, full (or change) → PAID, zero → unchanged", () => {
    expect(nextStatus("PENDING_PAYMENT", "pay", { total: 410_000, paidAmount: 300_000 })).toBe("PARTIALLY_PAID");
    expect(nextStatus("PARTIALLY_PAID", "pay", { total: 410_000, paidAmount: 410_000 })).toBe("PAID");
    expect(nextStatus("PARTIALLY_PAID", "pay", { total: 410_000, paidAmount: 420_000 })).toBe("PAID");
    expect(nextStatus("PENDING_PAYMENT", "pay", { total: 410_000, paidAmount: 0 })).toBe("PENDING_PAYMENT");
    expect(nextStatus("PENDING_PAYMENT", "pay", { total: 0, paidAmount: 0 })).toBe("PAID");
  });

  it("refund: partial → PARTIALLY_REFUNDED, full → REFUNDED", () => {
    expect(nextStatus("PAID", "refund", { total: 100, paidAmount: 100, refundedAmount: 40 })).toBe("PARTIALLY_REFUNDED");
    expect(nextStatus("PARTIALLY_REFUNDED", "refund", { total: 100, paidAmount: 100, refundedAmount: 100 })).toBe("REFUNDED");
  });

  it("a paid sale can never go back to DRAFT or be cancelled", () => {
    for (const from of ["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as SaleStatus[]) {
      expect(() => nextStatus(from, "unlock", { total: 1, paidAmount: 1 })).toThrow();
      expect(() => nextStatus(from, "cancel", { total: 1, paidAmount: 1 })).toThrow();
    }
  });

  it("only DRAFT is editable", () => {
    expect(ALL.filter(isEditable)).toEqual(["DRAFT"]);
  });
});
