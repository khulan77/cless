/** Цуцлах шалтгааны ангилал (11/24): тайланд шүүнэ. "Бусад" үед тайлбар заавал. Client/server хоёуланд. */
export const CANCEL_CATEGORIES = ["CUSTOMER", "NO_SHOW", "STAFF_SICK", "DUPLICATE", "OTHER"] as const;
export type CancelCategory = (typeof CANCEL_CATEGORIES)[number];

/** Системийн ангилал (гараар сонгохгүй): онлайн захиалгыг ресепшн татгалзсан / үйлчлүүлэгч сайтаас цуцалсан */
export const SYSTEM_CANCEL_CATEGORIES = ["REJECTED", "ONLINE"] as const;

export const CANCEL_CATEGORY_LABELS: Record<CancelCategory | (typeof SYSTEM_CANCEL_CATEGORIES)[number], string> = {
  REJECTED: "Ресепшн татгалзсан (онлайн)",
  ONLINE: "Үйлчлүүлэгч сайтаас цуцалсан",
  CUSTOMER: "Үйлчлүүлэгч цуцалсан",
  NO_SHOW: "Ороогүй",
  STAFF_SICK: "Ажилтан өвчтэй",
  DUPLICATE: "Давхардсан",
  OTHER: "Бусад",
};

export const isCancelCategory = (v: unknown): v is CancelCategory => (CANCEL_CATEGORIES as readonly unknown[]).includes(v);
