/**
 * Урамшуулал (CommissionRule) — цэвэр тооцоо. Мөр бүрт хамгийн тохирох нэг дүрэм:
 * идэвхтэй, төрөл (SERVICE/PRODUCT) таарсан, шүүлтүүр (ажилтан, үйлчилгээ, бүтээгдэхүүн, ангилал) нь
 * хоосон эсвэл таарсан; эрэмбэ: priority ↓, дараа нь нарийвчлал (бөглөсөн шүүлтүүрийн тоо) ↓.
 * PERCENT: value нь basis point (1000 = 10%) мөрийн бодит дүнгээс; FIXED: ширхэг тутамд value ₮.
 */
export type CommissionRuleLite = {
  id: string;
  kind: "SERVICE" | "PRODUCT";
  type: "PERCENT" | "FIXED";
  value: number;
  priority: number;
  isActive: boolean;
  staffId: string | null;
  serviceId: string | null;
  productId: string | null;
  collectionId: string | null;
};

export type CommissionLine = {
  kind: "SERVICE" | "PRODUCT";
  staffId: string | null;
  serviceId: string | null;
  productId: string | null;
  collectionIds: string[];
  /** Буцаалт хассан дүн */
  amount: number;
  /** Буцаалт хассан тоо */
  qty: number;
};

const specificity = (r: CommissionRuleLite) => [r.staffId, r.serviceId, r.productId, r.collectionId].filter(Boolean).length;

export function pickRule(line: CommissionLine, rules: CommissionRuleLite[]): CommissionRuleLite | null {
  const fits = rules.filter(
    (r) =>
      r.isActive &&
      r.kind === line.kind &&
      (!r.staffId || r.staffId === line.staffId) &&
      (!r.serviceId || r.serviceId === line.serviceId) &&
      (!r.productId || r.productId === line.productId) &&
      (!r.collectionId || line.collectionIds.includes(r.collectionId)),
  );
  fits.sort((a, b) => b.priority - a.priority || specificity(b) - specificity(a));
  return fits[0] ?? null;
}

export function commissionFor(line: CommissionLine, rules: CommissionRuleLite[]): number {
  const rule = pickRule(line, rules);
  if (!rule || line.amount <= 0) return 0;
  return rule.type === "PERCENT" ? Math.round((line.amount * rule.value) / 10_000) : rule.value * Math.max(0, line.qty);
}
