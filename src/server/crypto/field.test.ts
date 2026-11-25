import { afterEach, describe, expect, it } from "vitest";
import { decryptField, encryptField, maskAccount } from "./field";

const saved = process.env.FIELD_ENCRYPTION_KEY;
afterEach(() => {
  if (saved === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  else process.env.FIELD_ENCRYPTION_KEY = saved;
});

describe("field encryption", () => {
  it("round-trips and never stores the plain value", () => {
    const enc = encryptField("Хаан банк 5000123456");
    expect(enc).not.toContain("5000123456");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptField(enc)).toBe("Хаан банк 5000123456");
    expect(encryptField("x")).not.toBe(encryptField("x")); // санамсаргүй IV
  });

  it("detects tampering and a wrong key", () => {
    const enc = encryptField("5000123456");
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptField(parts.join(":"))).toThrow();
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(() => decryptField(enc)).toThrow();
  });

  it("rejects a short key; null passes through; masks all but the last 4", () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(8).toString("base64");
    expect(() => encryptField("x")).toThrow(/32 байт/);
    expect(decryptField(null)).toBeNull();
    expect(maskAccount("5000 1234 56")).toBe("•••• 3456");
  });
});
