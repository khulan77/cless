import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySignature } from "./webhook";

const secret = "whsec_test";
const body = JSON.stringify({ id: "evt_1", type: "balance.low", data: { balance: 10 } });
const sign = (t: number, b = body, s = secret) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${b}`).digest("hex")}`;
const now = 1_800_000_000;

describe("WeSend webhook signature", () => {
  it("accepts a valid signature within 5 minutes", () => {
    expect(verifySignature(body, sign(now), secret, now)).toBe(true);
    expect(verifySignature(body, sign(now - 299), secret, now)).toBe(true);
  });
  it("rejects tampering, wrong secret, old timestamps and junk", () => {
    expect(verifySignature(body + " ", sign(now), secret, now)).toBe(false);
    expect(verifySignature(body, sign(now, body, "whsec_other"), secret, now)).toBe(false);
    expect(verifySignature(body, sign(now - 301), secret, now)).toBe(false);
    expect(verifySignature(body, null, secret, now)).toBe(false);
    expect(verifySignature(body, "t=abc,v1=zz", secret, now)).toBe(false);
    expect(verifySignature(body, sign(now), "", now)).toBe(false);
  });
});
