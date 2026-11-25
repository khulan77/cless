/**
 * WeSend adapter — SDK-ийн fetch-ийг mock-оор (сүлжээнд гарахгүй). Хүсэлтийн бүтэц, алдааны Монгол мессеж.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserError } from "@/server/errors";
import { asciiBrand, brand, checkVerification, describeError, getBalance, sendEmail, sendSms, setWeSendFetchForTests, startVerification, wesendMessage } from "./wesend";

type Call = { url: string; method: string; body: unknown; headers: Headers };
let calls: Call[] = [];
let reply: (c: Call) => { status: number; body: unknown } = () => ({ status: 200, body: {} });

beforeEach(() => {
  process.env.WESEND_API_KEY = "ws_test_" + "x".repeat(43);
  calls = [];
  setWeSendFetchForTests(
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const c = { url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init?.headers) };
      calls.push(c);
      const r = reply(c);
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch,
  );
});
afterEach(() => {
  delete process.env.WESEND_API_KEY;
  delete process.env.NOTIFY_BRAND;
  vi.restoreAllMocks();
  setWeSendFetchForTests(undefined);
});

const err = (status: number, code: string, extra: object = {}) => ({ status, body: { error: { code, message: code, ...extra } } });

describe("brand", () => {
  it.each([
    ["CLÉSS", "CLESS"],
    ["Café Ölgii", "Cafe Olgii"],
    ["A".repeat(25), "A".repeat(20)],
    ["", "CLESS"],
    ["Клэсс", "CLESS"],
  ])("%s → %s", (raw, out) => expect(asciiBrand(raw)).toBe(out));

  it("defaults to CLESS", () => expect(brand()).toBe("CLESS"));
});

describe("WeSend adapter", () => {
  it("SMS: POST /v1/sms with Bearer key and an idempotency key", async () => {
    reply = () => ({ status: 200, body: { id: "msg_1", status: "sent", channel: "sms", to: "99112233", sandbox: true } });
    expect(await sendSms({ to: "99112233", text: "Сайн байна уу", idempotencyKey: "job-1" })).toEqual({ id: "msg_1", sandbox: true });
    expect(calls[0]!.url).toBe("https://api.wesend.mn/v1/sms");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers.get("authorization")).toMatch(/^Bearer ws_test_/);
    expect(calls[0]!.headers.get("idempotency-key")).toBe("job-1");
    expect(calls[0]!.body).toEqual({ to: "99112233", text: "Сайн байна уу" });
  });

  it("email: html + text + brand as from_name", async () => {
    reply = () => ({ status: 202, body: { id: "msg_2", status: "queued", channel: "email", sandbox: true } });
    await sendEmail({ to: "a@b.mn", subject: "S", html: "<p>x</p>", text: "x" });
    expect(calls[0]!.url).toBe("https://api.wesend.mn/v1/email");
    expect(calls[0]!.body).toMatchObject({ to: "a@b.mn", subject: "S", html: "<p>x</p>", text: "x", from_name: "CLÉSS" });
  });

  it("verify: create then check", async () => {
    reply = (c) =>
      c.url.endsWith("/verify")
        ? { status: 200, body: { id: "ver_1", status: "pending", channel: "sms", to: "99112233", sandbox: true, expires_at: "2030-01-01T00:00:00Z" } }
        : { status: 200, body: { id: "ver_1", status: "approved", channel: "sms", to: "99112233", sandbox: true, expires_at: "2030-01-01T00:00:00Z" } };
    const v = await startVerification({ to: "99112233" });
    expect(v).toMatchObject({ id: "ver_1", channel: "sms" });
    expect(calls[0]!.body).toMatchObject({ to: "99112233", locale: "mn", code_length: 6, code_type: "digits", ttl: 300 });
    expect(await checkVerification("ver_1", "123456")).toBe(true);
    expect(calls[1]!.url).toBe("https://api.wesend.mn/v1/verify/ver_1/check");
    expect(calls[1]!.body).toEqual({ code: "123456" });
  });

  it("verify: brand is ASCII even when NOTIFY_BRAND has É (prod invalid_request)", async () => {
    process.env.NOTIFY_BRAND = "CLÉSS";
    reply = () => ({ status: 200, body: { id: "ver_2", status: "pending", channel: "sms", to: "85563793", sandbox: true, expires_at: "2030-01-01T00:00:00Z" } });
    await startVerification({ to: "85563793" });
    const body = calls[0]!.body as { brand: string };
    expect(body.brand).toBe("CLESS");
    expect(/^[\x20-\x7E]+$/.test(body.brand)).toBe(true);
  });

  it("verify: invalid_request → clear Mongolian message; details only in the log (no phone)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    reply = () => ({ status: 400, body: { error: { code: "invalid_request", message: "to 85563793 is invalid" } } });
    const e = await startVerification({ to: "85563793" }).catch((x) => x);
    expect(e).toBeInstanceOf(UserError);
    expect(e.message).toBe("Код илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу.");
    expect(e.message).not.toMatch(/invalid_request/);
    expect(log).toHaveBeenCalledWith("[wesend]", expect.objectContaining({ op: "verify.create", code: "invalid_request", status: 400 }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("85563793");
  });

  it("describeError: code + status + message, phone/email scrubbed", async () => {
    reply = () => ({ status: 400, body: { error: { code: "invalid_request", message: "bad to: +976 8556-3793 / a@b.mn" } } });
    const e = await sendSms({ to: "85563793", text: "x" }).catch((x) => x);
    const d = describeError(e);
    expect(d).toMatch(/^invalid_request · 400/);
    expect(d).not.toMatch(/8556|a@b\.mn/);
  });

  it.each([
    [err(422, "invalid_code", { attempts_remaining: 3 }), /Код буруу.*3 оролдлого/],
    [err(429, "max_attempts_reached"), /Хэт олон удаа буруу код/],
    [err(410, "verification_expired"), /хугацаа дууссан/],
  ])("check errors → Mongolian UserError (%#)", async (r, msg) => {
    reply = () => r;
    const e = await checkVerification("ver_1", "000000").catch((x) => x);
    expect(e).toBeInstanceOf(UserError);
    expect(e.message).toMatch(msg);
  });

  it.each([
    ["trial_recipient", 403, /туршилтын горимд/],
    ["subscription_required", 402, /захиалга идэвхгүй/],
    ["insufficient_credits", 402, /үлдэгдэл хүрэлцэхгүй/],
    ["rate_limited", 429, /Хэт олон хүсэлт/],
  ])("%s → Mongolian message", async (code, status, msg) => {
    reply = () => err(status, code);
    const e = await sendSms({ to: "99112233", text: "x" }).catch((x) => x);
    expect(wesendMessage(e)).toMatch(msg);
  });

  it("balance", async () => {
    reply = () => ({ status: 200, body: { balance: 4920, next_expiry: null, unlimited: false } });
    expect(await getBalance()).toEqual({ balance: 4920, unlimited: false, nextExpiry: null });
    expect(calls[0]!.url).toBe("https://api.wesend.mn/v1/balance");
  });
});
