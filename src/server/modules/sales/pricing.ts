/**
 * Борлуулалтын тооцоолол — цэвэр функц (DB, Next.js-ээс хамааралгүй).
 * Сервер үнийг DB-ээс уншаад энд тооцно; client-ийн дүнд итгэхгүй.
 * Мөнгө бүгд Int (төгрөг). Хувь нь basis point: 1000 = 10%.
 */

export type DiscountInput = { type: "AMOUNT"; value: number } | { type: "PERCENT"; bp: number };

export type PricingLine = {
  key: string;
  unitPrice: number;
  qty: number;
  lineDiscount?: DiscountInput | null;
};

export type PricingInput = {
  lines: PricingLine[];
  saleDiscount?: DiscountInput | null;
  vatIncluded: boolean;
  /** 1000 = 10% */
  vatRateBp: number;
};

export type PricedLine = {
  key: string;
  gross: number;
  lineDiscount: number;
  allocatedSaleDiscount: number;
  lineTotal: number;
  vatAmount: number;
};

export type PricingResult = {
  lines: PricedLine[];
  /** Σ gross */
  subtotal: number;
  lineDiscountTotal: number;
  saleDiscount: number;
  /** Үйлчлүүлэгчийн төлөх дүн */
  total: number;
  vatTotal: number;
  /** (Σ мөрийн + борлуулалтын хөнгөлөлт) / subtotal, basis point-оор */
  discountBp: number;
};

export class PricingError extends Error {}

const assertMoney = (n: number, what: string) => {
  if (!Number.isInteger(n) || n < 0) throw new PricingError(`${what}: сөрөг биш бүхэл тоо байх ёстой`);
};

/** Хөнгөлөлтийг мөнгө болгоно; base-ээс хэтрэхгүй (clamp) */
export function discountAmount(d: DiscountInput | null | undefined, base: number): number {
  if (!d) return 0;
  if (d.type === "AMOUNT") {
    assertMoney(d.value, "Хөнгөлөлт");
    return Math.min(d.value, base);
  }
  if (!Number.isInteger(d.bp) || d.bp < 0 || d.bp > 10_000) throw new PricingError("Хувь 0–100% байх ёстой");
  return Math.min(Math.round((base * d.bp) / 10_000), base);
}

/**
 * Борлуулалтын хөнгөлөлтийг мөрүүдэд (gross − lineDiscount)-ын харьцаагаар хуваарилна.
 * Бүхэл төгрөгөөр доош бөөрөнхийлж, үлдэгдлийг хамгийн их суурьтай мөрөөс эхлэн
 * (мөр бүрийн багтаамжаар) нэмнэ → Σ allocated === amount, мөр бүр ≤ суурь.
 */
export function allocate(amount: number, bases: number[]): number[] {
  const total = bases.reduce((a, b) => a + b, 0);
  if (amount <= 0 || total === 0) return bases.map(() => 0);
  const capped = Math.min(amount, total);
  const out = bases.map((b) => Math.floor((capped * b) / total));
  let remainder = capped - out.reduce((a, b) => a + b, 0);
  // Ихээс бага руу; тэнцүү бол эхний мөр
  const order = bases.map((b, i) => [b, i] as const).sort((x, y) => y[0] - x[0] || x[1] - y[1]);
  for (const [base, i] of order) {
    if (remainder === 0) break;
    const room = base - out[i]!;
    const add = Math.min(room, remainder);
    out[i]! += add;
    remainder -= add;
  }
  return out;
}

/** НӨАТ: багтсан бол lineTotal × r / (1 + r), эс бөгөөс lineTotal × r */
export function vatOf(amount: number, vatRateBp: number, included: boolean): number {
  return included ? Math.round((amount * vatRateBp) / (10_000 + vatRateBp)) : Math.round((amount * vatRateBp) / 10_000);
}

export function priceSale(input: PricingInput): PricingResult {
  const base = input.lines.map((l) => {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new PricingError("Тоо ширхэг эерэг бүхэл тоо байх ёстой");
    assertMoney(l.unitPrice, "Үнэ");
    const gross = l.unitPrice * l.qty;
    const lineDiscount = discountAmount(l.lineDiscount, gross);
    return { key: l.key, gross, lineDiscount, afterLine: gross - lineDiscount };
  });

  const afterLineTotal = base.reduce((a, l) => a + l.afterLine, 0);
  const saleDiscount = discountAmount(input.saleDiscount, afterLineTotal);
  const allocated = allocate(
    saleDiscount,
    base.map((l) => l.afterLine),
  );

  const lines: PricedLine[] = base.map((l, i) => {
    const lineTotal = l.afterLine - allocated[i]!;
    return {
      key: l.key,
      gross: l.gross,
      lineDiscount: l.lineDiscount,
      allocatedSaleDiscount: allocated[i]!,
      lineTotal,
      vatAmount: vatOf(lineTotal, input.vatRateBp, input.vatIncluded),
    };
  });

  const subtotal = lines.reduce((a, l) => a + l.gross, 0);
  const lineDiscountTotal = lines.reduce((a, l) => a + l.lineDiscount, 0);
  const net = lines.reduce((a, l) => a + l.lineTotal, 0);
  const vatTotal = lines.reduce((a, l) => a + l.vatAmount, 0);
  const totalDiscount = lineDiscountTotal + saleDiscount;

  return {
    lines,
    subtotal,
    lineDiscountTotal,
    saleDiscount,
    total: input.vatIncluded ? net : net + vatTotal,
    vatTotal,
    discountBp: subtotal === 0 ? 0 : Math.ceil((totalDiscount * 10_000) / subtotal),
  };
}

/** Хөнгөлөлт MANAGER-ийн хязгаараас хэтэрсэн эсэх (maxPercent: 10 = 10%) */
export function exceedsDiscountLimit(result: Pick<PricingResult, "subtotal" | "lineDiscountTotal" | "saleDiscount">, maxPercent: number): boolean {
  const discount = result.lineDiscountTotal + result.saleDiscount;
  // discount / subtotal > maxPercent / 100  ⇔  discount × 100 > maxPercent × subtotal (бүхэл тоогоор)
  return discount * 100 > maxPercent * result.subtotal;
}
