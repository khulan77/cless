/**
 * Цалингийн тооцоо — цэвэр функц (DB-гүй). Бүх мөнгө бүхэл төгрөг; бөөрөнхийлөлт зөвхөн `roundMoney`-оор.
 *
 *  1. Үндсэн цалин = Σ өдөр бүр: тухайн өдрийн сарын цалин ÷ тухайн сарын төлөвлөсөн ажлын өдөр × жин
 *     (WORKED, PAID_LEAVE = 1; HALF_DAY = 0.5; бусад = 0). Цалин үеийн дундуур өөрчлөгдвөл өдрөөр хуваагдана.
 *  2. Урамшуулал — гаднаас (commission.ts), буцаалт хассан дүнгээр.
 *  3. Нэмэлт / хасалт — гараар.
 *  4. Gross = үндсэн + урамшуулал + нэмэлт.
 *  5. НДШ (даатгуулагч) = min(gross, дээд хязгаар) × хувь.
 *  6. ХХОАТ = max(0, (gross − НДШ) × хувь − хөнгөлөлт); хөнгөлөлт — орлогын шатлалаар (сарын).
 *  7. Гарт олгох = gross − НДШ − ХХОАТ − хасалт.
 *  8. Ажил олгогчийн НДШ = min(gross, дээд хязгаар) × ангиллын хувь (зардал).
 *
 * Хагас сарын үе (бие даасан горим / суутгалтай урьдчилгаа): дээд хязгаар ба хөнгөлөлтийг ½-ээр,
 * шатлалыг gross × 2 (сарын дүйцэх орлого)-оор тодорхойлно.
 * Сарын эцсийн тооцоо (FINAL): бүтэн сарын дүнгээр бодоод урьдчилгааны мөрийг хасна — сарын нийлбэр яг тэнцэнэ.
 */

export type WorkStatus = "WORKED" | "HALF_DAY" | "PAID_LEAVE" | "UNPAID_LEAVE" | "SICK" | "ABSENT" | "OFF";

export const DAY_WEIGHT: Record<WorkStatus, number> = {
  WORKED: 1,
  HALF_DAY: 0.5,
  PAID_LEAVE: 1,
  UNPAID_LEAVE: 0,
  SICK: 0,
  ABSENT: 0,
  OFF: 0,
};

/** Бөөрөнхийлөлтийн цорын ганц дүрэм: ойрын бүхэл төгрөг, .5 нь тэгээс холдуулна */
export function roundMoney(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

/** basis point-оор хувь: 1150 bp = 11.5% */
export function pct(amount: number, bp: number): number {
  return roundMoney((amount * bp) / 10_000);
}

// ───────────────────────── Огноо ─────────────────────────

/** "YYYY-MM-DD" → гариг (0 = Ням … 6 = Бямба) */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  const cur = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 400; i++) {
    const key = cur.toISOString().slice(0, 10);
    if (key > to) break;
    out.push(key);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return daysBetween(`${month}-01`, `${month}-${String(last).padStart(2, "0")}`);
}

// ───────────────────────── Ирц ─────────────────────────

/** Ажлын хуваарьгүй ажилтанд: Даваа–Баасан */
export const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

export type WorkCalendar = { weekdays: ReadonlySet<number>; holidays: ReadonlySet<string> };

/** Тэмдэглээгүй өдрийн анхдагч төлөв: хуваарийн ажлын өдөр (амралтын өдөр биш) → WORKED, үгүй бол OFF */
export function defaultStatus(day: string, cal: WorkCalendar): WorkStatus {
  return isPlanned(day, cal) ? "WORKED" : "OFF";
}

export function isPlanned(day: string, cal: WorkCalendar): boolean {
  return cal.weekdays.has(weekdayOf(day)) && !cal.holidays.has(day);
}

export function plannedDaysInMonth(month: string, cal: WorkCalendar): number {
  return monthDays(month).filter((d) => isPlanned(d, cal)).length;
}

/** Тэмдэглэсэн өдрүүд + анхдагч → үеийн өдөр бүрийн төлөв */
export function resolveAttendance(days: string[], marked: ReadonlyMap<string, WorkStatus>, cal: WorkCalendar) {
  return days.map((date) => {
    const m = marked.get(date);
    return { date, status: m ?? defaultStatus(date, cal), marked: m !== undefined, planned: isPlanned(date, cal) };
  });
}

// ───────────────────────── 1. Үндсэн цалин ─────────────────────────

export type SalaryPoint = { effectiveFrom: string; monthly: number };

/** Тухайн өдөр хүчинтэй сарын цалин (хамгийн сүүлийн effectiveFrom ≤ өдөр); түүхгүй бол fallback */
export function salaryAt(history: readonly SalaryPoint[], day: string, fallback: number): number {
  let best: SalaryPoint | null = null;
  for (const h of history) if (h.effectiveFrom <= day && (!best || h.effectiveFrom > best.effectiveFrom)) best = h;
  return best ? best.monthly : fallback;
}

export type BaseDay = { date: string; status: WorkStatus; weight: number; monthly: number; planned: number; amount: number };

export function basePay(input: {
  days: { date: string; status: WorkStatus }[];
  history: readonly SalaryPoint[];
  fallbackMonthly: number;
  cal: WorkCalendar;
}) {
  const plannedCache = new Map<string, number>();
  const planned = (month: string) => {
    if (!plannedCache.has(month)) plannedCache.set(month, plannedDaysInMonth(month, input.cal));
    return plannedCache.get(month)!;
  };
  const warnings = new Set<string>();
  let exact = 0;
  const breakdown: BaseDay[] = input.days.map(({ date, status }) => {
    const weight = DAY_WEIGHT[status];
    const monthly = salaryAt(input.history, date, input.fallbackMonthly);
    const p = planned(monthOf(date));
    if (p === 0 && weight > 0 && monthly > 0) warnings.add("NO_PLANNED_DAYS");
    const raw = p > 0 ? (monthly / p) * weight : 0;
    exact += raw;
    return { date, status, weight, monthly, planned: p, amount: roundMoney(raw) };
  });
  return {
    // Нийлбэрийг нэг удаа бөөрөнхийлнө (өдөр бүрийн бөөрөнхийлөлт хуримтлагдахгүй)
    amount: roundMoney(exact),
    workedDays: breakdown.reduce((s, d) => s + d.weight, 0),
    plannedDays: input.days.filter((d) => isPlanned(d.date, input.cal)).length,
    breakdown,
    warnings: [...warnings],
  };
}

// ───────────────────────── 5–8. Суутгал ─────────────────────────

export type PitCredit = { from: number; to: number | null; credit: number };

export type Rates = {
  employeeSiBp: number;
  employerSiBp: number;
  /** Сарын дээд хязгаар; null = хязгааргүй */
  siCap: number | null;
  pitBp: number;
  pitCredits: readonly PitCredit[];
};

/** Сарын орлогоор хөнгөлөлтийн шатлал: from ≤ орлого ≤ to (to = null → дээд хязгааргүй) */
export function pitCreditFor(monthlyIncome: number, credits: readonly PitCredit[]): number {
  const row = credits.find((c) => monthlyIncome >= c.from && (c.to === null || monthlyIncome <= c.to));
  return row?.credit ?? 0;
}

/**
 * @param fraction 1 = бүтэн сар; 0.5 = хагас сарын бие даасан тооцоо (хязгаар, хөнгөлөлт ½; шатлал = gross ÷ fraction)
 */
export function withholdings(gross: number, rates: Rates, fraction = 1) {
  const g = Math.max(0, gross);
  const cap = rates.siCap === null ? null : roundMoney(rates.siCap * fraction);
  const siBase = cap === null ? g : Math.min(g, cap);
  const siEmployee = pct(siBase, rates.employeeSiBp);
  const siEmployer = pct(siBase, rates.employerSiBp);
  const taxable = g - siEmployee;
  const credit = roundMoney(pitCreditFor(roundMoney(g / fraction), rates.pitCredits) * fraction);
  const pitBefore = pct(taxable, rates.pitBp);
  const pit = Math.max(0, pitBefore - credit);
  return { siBase, siEmployee, siEmployer, taxable, pitBefore, credit, pit };
}

// ───────────────────────── Мөр ─────────────────────────

export type Earnings = {
  base: number;
  serviceCommission: number;
  productCommission: number;
  additions: number;
  deductions: number;
};

export type LineResult = Earnings & {
  gross: number;
  siEmployee: number;
  pit: number;
  siEmployer: number;
  advancePaid: number;
  net: number;
  tax: ReturnType<typeof withholdings> | null;
  warnings: string[];
};

export const grossOf = (e: Earnings) => e.base + e.serviceCommission + e.productCommission + e.additions;

/**
 * FULL — бие даасан үе (fraction: бүтэн сар 1, хагас сар 0.5), суутгалтай.
 * ADVANCE — урьдчилгаа: withhold=false бол суутгалгүй; true бол хагас сарын бие даасан суутгал.
 */
export function computeLine(e: Earnings, rates: Rates | null, opts: { withhold: boolean; fraction: number }): LineResult {
  const gross = grossOf(e);
  const tax = opts.withhold && rates ? withholdings(gross, rates, opts.fraction) : null;
  const siEmployee = tax?.siEmployee ?? 0;
  const pit = tax?.pit ?? 0;
  const net = gross - siEmployee - pit - e.deductions;
  const warnings: string[] = [];
  if (opts.withhold && !rates) warnings.push("NO_RATES");
  if (net < 0) warnings.push("NEGATIVE_NET");
  return { ...e, gross, siEmployee, pit, siEmployer: tax?.siEmployer ?? 0, advancePaid: 0, net, tax, warnings };
}

export type AdvanceLine = { gross: number; siEmployee: number; pit: number; siEmployer: number; deductions: number; net: number };

/**
 * Сарын эцэс: бүтэн сарын орлогоор (month = 1-ээс сарын сүүл хүртэлх үндсэн, урамшуулал, хоёр хагасын нэмэлт/хасалт)
 * НДШ, ХХОАТ бодоод урьдчилгааны мөрийг хасна. Хадгалах мөр = сар − урьдчилгаа, тиймээс Σ(хоёр үе) = сарын дүн.
 */
export function computeFinal(month: Earnings, advance: AdvanceLine | null, rates: Rates | null) {
  const full = computeLine(month, rates, { withhold: true, fraction: 1 });
  const a: AdvanceLine = advance ?? { gross: 0, siEmployee: 0, pit: 0, siEmployer: 0, deductions: 0, net: 0 };
  const net = full.net - a.net;
  const warnings = full.warnings.filter((w) => w !== "NEGATIVE_NET");
  if (net < 0) warnings.push("NEGATIVE_NET");
  return {
    month: full,
    line: {
      gross: full.gross - a.gross,
      siEmployee: full.siEmployee - a.siEmployee,
      pit: full.pit - a.pit,
      siEmployer: full.siEmployer - a.siEmployer,
      deductions: month.deductions - a.deductions,
      advancePaid: a.net,
      net,
    },
    warnings,
  };
}
