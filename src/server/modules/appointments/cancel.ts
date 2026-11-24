/** Цуцлах шалтгааны ангилал (11/24): тайланд шүүнэ. "Бусад" үед тайлбар заавал. Client/server хоёуланд. */
export const CANCEL_CATEGORIES = ["CUSTOMER", "NO_SHOW", "STAFF_SICK", "DUPLICATE", "OTHER"] as const;
export type CancelCategory = (typeof CANCEL_CATEGORIES)[number];

export const CANCEL_CATEGORY_LABELS: Record<CancelCategory, string> = {
  CUSTOMER: "Үйлчлүүлэгч цуцалсан",
  NO_SHOW: "Ирээгүй",
  STAFF_SICK: "Ажилтан өвчтэй",
  DUPLICATE: "Давхардсан",
  OTHER: "Бусад",
};

export const isCancelCategory = (v: unknown): v is CancelCategory => (CANCEL_CATEGORIES as readonly unknown[]).includes(v);
