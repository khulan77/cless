/** Борлуулалтын төлөвийн Badge өнгө */
export const saleStatusTone = (s: string): "green" | "neutral" | "red" | "amber" =>
  s === "PAID" ? "green" : s === "CANCELLED" || s === "DRAFT" ? "neutral" : s.includes("REFUND") ? "red" : "amber";
