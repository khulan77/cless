/**
 * QPay Merchant API v2 (https://developer.qpay.mn).
 *
 * Албан ёсны баримтаас БАТАЛГААЖСАН (2026-11-23):
 *  - Base URL: sandbox https://merchant-sandbox.qpay.mn, production https://merchant.qpay.mn
 *  - POST /v2/auth/token — Basic auth (client_id:client_secret); бусад endpoint Bearer token
 *  - expires_in нь Unix timestamp (секунд), үлдсэн секунд БИШ; 24 цаг гэж хатуу бичихгүй
 *  - 401/403 → token-ыг хаяж, шинээр авч, НЭГ л удаа дахин оролдоно
 *  - POST /v2/invoice хүсэлт: invoice_code, sender_invoice_no, invoice_receiver_code,
 *    invoice_description, amount, callback_url
 *  - POST /v2/payment/check хүсэлт: { object_type: "INVOICE", object_id, offset: { page_number, page_limit } }
 *  - DELETE /v2/invoice/{invoice_id}
 * Хариуны талбаруудыг баримтаас олж чадаагүй — доор `// VERIFY:` гэж тэмдэглэв.
 */
import type { QPayCheckResult, QPayInvoice, QPayProvider } from "./types";

export type QPayApiConfig = {
  baseUrl: string;
  username: string;
  password: string;
  invoiceCode: string;
  /** VERIFY: QPay-ээс тодруулах (баримтын жишээнд "83"). QPAY_INVOICE_RECEIVER_CODE */
  invoiceReceiverCode?: string;
  /** Тестэд fetch-ийг солино */
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Token амжилттай авсан үед (Тохиргоо → QPay-д "сүүлд холбогдсон" харуулна) */
  onToken?: (at: Date) => void;
};

export class QPayApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "QPayApiError";
  }
}

export class QPayApiProvider implements QPayProvider {
  private token: { value: string; expiresAtMs: number } | null = null;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly cfg: QPayApiConfig) {
    this.fetch = cfg.fetchImpl ?? fetch;
    this.now = cfg.now ?? Date.now;
  }

  private url(path: string) {
    return `${this.cfg.baseUrl.replace(/\/$/, "")}${path}`;
  }

  /** Token-ыг memory-д кэшлэнэ; дуусахаас 60 секундын өмнө шинэчилнэ */
  private async accessToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAtMs - 60_000 > this.now()) return this.token.value;
    const basic = Buffer.from(`${this.cfg.username}:${this.cfg.password}`).toString("base64");
    const res = await this.fetch(this.url("/v2/auth/token"), { method: "POST", headers: { Authorization: `Basic ${basic}` } });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body) throw new QPayApiError("QPay token авах амжилтгүй", res.status, body);
    // VERIFY: хариуны талбарын нэр (access_token, expires_in) — баримтад жагсаалт олдсонгүй
    const value = String(body.access_token ?? "");
    if (!value) throw new QPayApiError("QPay token хоосон", res.status, body);
    const expSec = Number(body.expires_in); // Unix timestamp (секунд) — баримтад баталгаажсан
    // Хэрэв утга нь timestamp биш (жижиг тоо) бол үлдсэн секунд гэж үзнэ (хамгаалалт)
    const expiresAtMs = Number.isFinite(expSec) && expSec > 1e9 ? expSec * 1000 : this.now() + (Number.isFinite(expSec) ? expSec : 3600) * 1000;
    this.token = { value, expiresAtMs };
    this.cfg.onToken?.(new Date(this.now()));
    return value;
  }

  /** Bearer хүсэлт; 401/403 үед token-ыг шинэчилж нэг л удаа дахин оролдоно */
  private async request(method: string, path: string, json?: unknown): Promise<unknown> {
    const send = async (force: boolean) =>
      this.fetch(this.url(path), {
        method,
        headers: { Authorization: `Bearer ${await this.accessToken(force)}`, "Content-Type": "application/json" },
        body: json === undefined ? undefined : JSON.stringify(json),
      });
    let res = await send(false);
    if (res.status === 401 || res.status === 403) {
      this.token = null;
      res = await send(true);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new QPayApiError(`QPay ${method} ${path} → ${res.status}`, res.status, body);
    return body;
  }

  async createInvoice(p: { paymentId: string; amount: number; description: string; callbackUrl: string }): Promise<QPayInvoice> {
    const body = (await this.request("POST", "/v2/invoice", {
      invoice_code: this.cfg.invoiceCode,
      sender_invoice_no: p.paymentId,
      // VERIFY: invoice_receiver_code-ийн зөв утгыг QPay-ээс тодруулах (баримтын жишээнд "83")
      invoice_receiver_code: this.cfg.invoiceReceiverCode ?? "terminal",
      invoice_description: p.description,
      amount: p.amount,
      callback_url: p.callbackUrl,
    })) as Record<string, unknown>;
    // VERIFY: хариуны талбарууд invoice_id, qr_text, qr_image, urls[{ name, description, logo, link }]
    const invoiceId = String(body?.invoice_id ?? "");
    if (!invoiceId) throw new QPayApiError("QPay invoice_id ирсэнгүй", undefined, body);
    const urls = Array.isArray(body.urls) ? (body.urls as Record<string, unknown>[]) : [];
    return {
      invoiceId,
      qrText: String(body.qr_text ?? ""),
      qrImage: typeof body.qr_image === "string" ? body.qr_image : undefined,
      deeplinks: urls
        .filter((u) => typeof u.link === "string")
        .map((u) => ({ name: String(u.description ?? u.name ?? ""), link: String(u.link), logo: typeof u.logo === "string" ? u.logo : undefined })),
      raw: body,
    };
  }

  async checkPayment(invoiceId: string): Promise<QPayCheckResult> {
    const body = (await this.request("POST", "/v2/payment/check", {
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    })) as Record<string, unknown>;
    // VERIFY: хариуны бүтэц { count, paid_amount, rows: [{ payment_id, payment_status: "PAID", payment_amount }] }
    const rows = Array.isArray(body?.rows) ? (body.rows as Record<string, unknown>[]) : [];
    const paidRows = rows.filter((r) => String(r.payment_status ?? "").toUpperCase() === "PAID");
    const paidAmount = paidRows.length
      ? paidRows.reduce((s, r) => s + Number(r.payment_amount ?? 0), 0)
      : Number(body?.paid_amount ?? 0);
    return {
      paid: paidRows.length > 0,
      paidAmount: Math.round(paidAmount),
      providerPaymentId: paidRows[0]?.payment_id != null ? String(paidRows[0].payment_id) : undefined,
      raw: body,
    };
  }

  async cancelInvoice(invoiceId: string): Promise<void> {
    await this.request("DELETE", `/v2/invoice/${encodeURIComponent(invoiceId)}`);
  }
}
