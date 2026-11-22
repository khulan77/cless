/** QPay provider interface — API горим болон тестийн mock хоёулаа үүнийг хэрэгжүүлнэ */
export type QPayInvoice = {
  invoiceId: string;
  qrText: string;
  qrImage?: string;
  deeplinks: { name: string; link: string; logo?: string }[];
  raw: unknown;
};

export type QPayCheckResult = {
  paid: boolean;
  /** Төлөгдсөн нийт дүн (₮) */
  paidAmount: number;
  providerPaymentId?: string;
  raw: unknown;
};

export interface QPayProvider {
  createInvoice(p: { paymentId: string; amount: number; description: string; callbackUrl: string }): Promise<QPayInvoice>;
  checkPayment(invoiceId: string): Promise<QPayCheckResult>;
  cancelInvoice(invoiceId: string): Promise<void>;
}

/** Invoice-ийн хүчинтэй хугацаа */
export const QPAY_INVOICE_TTL_MS = 15 * 60 * 1000;
