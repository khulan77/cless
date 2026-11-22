import { describe, expect, it } from "vitest";
import { signPaymentId, verifyPaymentSignature } from "./signature";

describe("QPay callback signature", () => {
  const secret = "s3cret";
  it("accepts the right signature only", () => {
    const sig = signPaymentId("pay_1", secret);
    expect(verifyPaymentSignature("pay_1", sig, secret)).toBe(true);
    expect(verifyPaymentSignature("pay_2", sig, secret)).toBe(false);
    expect(verifyPaymentSignature("pay_1", sig, "other")).toBe(false);
    expect(verifyPaymentSignature("pay_1", "abc", secret)).toBe(false);
    expect(verifyPaymentSignature("pay_1", sig.toUpperCase().replace(/^./, "0"), secret)).toBe(false);
  });
  it("rejects everything without a secret", () => {
    expect(verifyPaymentSignature("pay_1", signPaymentId("pay_1", ""), "")).toBe(false);
  });
});
