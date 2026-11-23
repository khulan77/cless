/**
 * Борлуулалтын төлөвийн машин — цэвэр функц. Шилжилт бүр эндээс л шийдэгдэнэ.
 *
 *   DRAFT ──lock──► PENDING_PAYMENT ──pay──► PARTIALLY_PAID ──pay──► PAID
 *     │                 │    ▲                                       │
 *     │                 │    └─unlock (төлбөр 0)                     │
 *     └─cancel──► CANCELLED ◄─cancel (төлбөр 0)                      │
 *   PAID ──refund──► PARTIALLY_REFUNDED ──refund──► REFUNDED ◄────────┘
 */
import type { SaleStatus } from "@/generated/prisma/enums";

export type SaleAction = "lock" | "unlock" | "cancel" | "pay" | "refund";

export class SaleStateError extends Error {
  constructor(
    public from: SaleStatus,
    public action: SaleAction,
    message: string,
  ) {
    super(message);
    this.name = "SaleStateError";
  }
}

type Amounts = {
  total: number;
  /** Σ SUCCEEDED payments (DB-ээс дахин тооцсон) */
  paidAmount: number;
  refundedAmount?: number;
};

const ALLOWED: Record<SaleAction, readonly SaleStatus[]> = {
  lock: ["DRAFT"],
  unlock: ["PENDING_PAYMENT"],
  cancel: ["DRAFT", "PENDING_PAYMENT"],
  pay: ["PENDING_PAYMENT", "PARTIALLY_PAID"],
  refund: ["PAID", "PARTIALLY_REFUNDED"],
};

const MESSAGES: Record<SaleAction, string> = {
  lock: "Зөвхөн хадгалсан (төлөгдөөгүй) борлуулалтыг төлбөрт шилжүүлнэ.",
  unlock: "Зөвхөн төлбөр хүлээж буй борлуулалтыг засварт буцаана.",
  cancel: "Энэ борлуулалтыг цуцлах боломжгүй.",
  pay: "Энэ борлуулалтад төлбөр хүлээн авах боломжгүй.",
  refund: "Зөвхөн төлөгдсөн борлуулалтыг буцаана.",
};

export function canTransition(from: SaleStatus, action: SaleAction): boolean {
  return ALLOWED[action].includes(from);
}

/**
 * Дараагийн төлөвийг буцаана, хориотой бол SaleStateError.
 * pay/refund-д дүн хэрэгтэй (DB-ээс дахин тооцсон утга).
 */
export function nextStatus(from: SaleStatus, action: SaleAction, amounts?: Amounts): SaleStatus {
  if (!canTransition(from, action)) throw new SaleStateError(from, action, MESSAGES[action]);

  switch (action) {
    case "lock":
      return "PENDING_PAYMENT";
    case "unlock":
    case "cancel":
      if ((amounts?.paidAmount ?? 0) > 0) {
        throw new SaleStateError(from, action, "Төлбөр хийгдсэн борлуулалтыг засварлах / цуцлах боломжгүй. Буцаалт хийнэ үү.");
      }
      return action === "unlock" ? "DRAFT" : "CANCELLED";
    case "pay": {
      if (!amounts) throw new SaleStateError(from, action, "Дүн шаардлагатай.");
      // 100% хөнгөлөлттэй (нийт 0) борлуулалт төлбөргүйгээр дуусна
      if (amounts.total === 0) return "PAID";
      if (amounts.paidAmount <= 0) return from;
      return amounts.paidAmount >= amounts.total ? "PAID" : "PARTIALLY_PAID";
    }
    case "refund": {
      if (!amounts) throw new SaleStateError(from, action, "Дүн шаардлагатай.");
      const refunded = amounts.refundedAmount ?? 0;
      if (refunded <= 0) return from;
      return refunded >= amounts.paidAmount ? "REFUNDED" : "PARTIALLY_REFUNDED";
    }
  }
}

/** Мөр нэмэх/засах зөвхөн DRAFT-д */
export function isEditable(status: SaleStatus): boolean {
  return status === "DRAFT";
}

/** Төлбөр бүрэн / буцаалт хийгдсэн эцсийн төлөвүүд */
export const SETTLED_STATUSES: readonly SaleStatus[] = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];
