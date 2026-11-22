import { describe, expect, it } from "vitest";
import { formatLine, redact } from "./log";

describe("structured log", () => {
  it("one JSON line with level, msg, time and context", () => {
    const line = formatLine("info", "sale paid", { requestId: "r1", userId: "u1", saleId: "s1" }, new Date("2026-12-01T00:00:00Z"));
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toEqual({ level: "info", time: "2026-12-01T00:00:00.000Z", msg: "sale paid", requestId: "r1", userId: "u1", saleId: "s1" });
  });

  it("never writes passwords, tokens, secrets, cookies or card data", () => {
    const line = formatLine("error", "login failed", {
      email: "a@b.mn",
      password: "hunter2-very-secret",
      passwordHash: "$2b$12$abc",
      newPassword: "x",
      headers: { authorization: "Bearer abc.def.ghi", cookie: "authjs.session-token=zzz" },
      accessToken: "tok123",
      QPAY_CALLBACK_SECRET: "s3cr3t",
      cardNumber: "4111111111111111",
      note: "paid with 4111 1111 1111 1111 via Bearer abc.def",
      dbUrl: "postgresql://user:p4ss@host:5432/db",
      nested: { deep: { apiKey: "re_live_123" } },
    });
    for (const leaked of ["hunter2", "$2b$12$abc", "abc.def.ghi", "zzz", "tok123", "s3cr3t", "4111111111111111", "4111 1111", "p4ss", "re_live_123"]) {
      expect(line).not.toContain(leaked);
    }
    expect(JSON.parse(line).email).toBe("a@b.mn"); // ердийн мэдээлэл хэвээр
    expect(JSON.parse(line).dbUrl).toBe("postgresql://user:[REDACTED]@host:5432/db");
  });

  it("redacts inside Error messages and stacks", () => {
    const e = new Error("connect failed postgresql://u:topsecret@db:5432/x");
    expect(JSON.stringify(redact({ error: e }))).not.toContain("topsecret");
  });
});
