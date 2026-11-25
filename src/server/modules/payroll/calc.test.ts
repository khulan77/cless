/**
 * Цалингийн тооцооны жишээ тохиолдлууд (PROMPT 14 §4). Хувь хэмжээ нь ЗӨВХӨН ТЕСТИЙН утга —
 * албан ёсны хувь биш (албан ёсны утгыг нягтлан Цалингийн тохиргоонд оруулж баталгаажуулна).
 */
import { describe, expect, it } from "vitest";
import {
  basePay,
  computeFinal,
  computeLine,
  daysBetween,
  defaultStatus,
  pct,
  pitCreditFor,
  plannedDaysInMonth,
  resolveAttendance,
  roundMoney,
  salaryAt,
  withholdings,
  type Rates,
  type WorkCalendar,
  type WorkStatus,
} from "./calc";

/** Тестийн хувь: НДШ 11.5% / 12.5%, дээд хязгаар 5 сая, ХХОАТ 10%, хөнгөлөлтийн шатлал */
const RATES: Rates = {
  employeeSiBp: 1150,
  employerSiBp: 1250,
  siCap: 5_000_000,
  pitBp: 1000,
  pitCredits: [
    { from: 0, to: 500_000, credit: 20_000 },
    { from: 500_001, to: 1_000_000, credit: 18_000 },
    { from: 1_000_001, to: 1_500_000, credit: 16_000 },
    { from: 1_500_001, to: 2_000_000, credit: 14_000 },
    { from: 2_000_001, to: 2_500_000, credit: 12_000 },
    { from: 2_500_001, to: 3_000_000, credit: 10_000 },
    { from: 3_000_001, to: null, credit: 0 },
  ],
};

/** 2026 оны 11-р сар: 1-нд Ням гараг. Да–Ба = 21 ажлын өдөр. */
const MONFRI: WorkCalendar = { weekdays: new Set([1, 2, 3, 4, 5]), holidays: new Set() };
const NOV = daysBetween("2026-11-01", "2026-11-30");
const attendance = (cal: WorkCalendar, overrides: Record<string, WorkStatus> = {}, days = NOV) =>
  resolveAttendance(days, new Map(Object.entries(overrides)), cal).map(({ date, status }) => ({ date, status }));

describe("бөөрөнхийлөлт — нэг дүрэм", () => {
  it.each([
    [2.5, 3],
    [-2.5, -3],
    [2.4999, 2],
    [100_000.5, 100_001],
  ])("roundMoney(%s) = %s", (x, y) => expect(roundMoney(x)).toBe(y));

  it("pct: basis point, бүхэл ₮", () => {
    expect(pct(1_000_000, 1150)).toBe(115_000);
    expect(pct(333, 1150)).toBe(38); // 38.295
  });
});

describe("ирц ба төлөвлөсөн өдөр", () => {
  it("2026-11: 21 ажлын өдөр; амралтын өдөр (11/26) хасагдана", () => {
    expect(plannedDaysInMonth("2026-11", MONFRI)).toBe(21);
    expect(plannedDaysInMonth("2026-11", { ...MONFRI, holidays: new Set(["2026-11-26"]) })).toBe(20);
  });

  it("тэмдэглээгүй өдөр: хуваарийн өдөр → WORKED, амралт/нийтийн амралт → OFF", () => {
    const cal = { ...MONFRI, holidays: new Set(["2026-11-26"]) };
    expect(defaultStatus("2026-11-02", cal)).toBe("WORKED"); // Даваа
    expect(defaultStatus("2026-11-01", cal)).toBe("OFF"); // Ням
    expect(defaultStatus("2026-11-26", cal)).toBe("OFF"); // нийтийн амралт
  });

  it("цалингийн түүх: тухайн өдөр хүчинтэй дүн", () => {
    const h = [
      { effectiveFrom: "2026-01-01", monthly: 2_100_000 },
      { effectiveFrom: "2026-11-16", monthly: 3_150_000 },
    ];
    expect(salaryAt(h, "2026-11-15", 0)).toBe(2_100_000);
    expect(salaryAt(h, "2026-11-16", 0)).toBe(3_150_000);
    expect(salaryAt([], "2026-11-16", 999)).toBe(999);
  });
});

describe("1. үндсэн цалин — ажилласан өдрөөр", () => {
  const H = [{ effectiveFrom: "2026-01-01", monthly: 2_100_000 }];

  it("бүтэн сар: 2,100,000 ÷ 21 × 21 = 2,100,000", () => {
    const r = basePay({ days: attendance(MONFRI), history: H, fallbackMonthly: 0, cal: MONFRI });
    expect(r).toMatchObject({ amount: 2_100_000, workedDays: 21, plannedDays: 21 });
  });

  it("хагас өдөр (0.5) + тасалсан (0) + цалинтай чөлөө (1): 19.5 өдөр = 1,950,000", () => {
    const days = attendance(MONFRI, { "2026-11-10": "HALF_DAY", "2026-11-11": "ABSENT", "2026-11-12": "PAID_LEAVE" });
    const r = basePay({ days, history: H, fallbackMonthly: 0, cal: MONFRI });
    expect(r.workedDays).toBe(19.5);
    expect(r.amount).toBe(1_950_000);
    const days2 = attendance(MONFRI, { "2026-11-10": "HALF_DAY", "2026-11-11": "ABSENT", "2026-11-12": "UNPAID_LEAVE" });
    // цалингүй чөлөө (0) → 18.5 өдөр
    expect(basePay({ days: days2, history: H, fallbackMonthly: 0, cal: MONFRI }).amount).toBe(1_850_000);
  });

  it("цалин үеийн дундуур өөрчлөгдсөн: 10 өдөр × 100,000 + 11 өдөр × 150,000 = 2,650,000", () => {
    const h = [...H, { effectiveFrom: "2026-11-16", monthly: 3_150_000 }];
    const r = basePay({ days: attendance(MONFRI), history: h, fallbackMonthly: 0, cal: MONFRI });
    expect(r.amount).toBe(2_650_000);
  });

  it("нийтийн амралттай сар: 2,100,000 ÷ 20 × 20 = 2,100,000 (амралтын өдөр цалин хасахгүй)", () => {
    const cal = { ...MONFRI, holidays: new Set(["2026-11-26"]) };
    const r = basePay({ days: attendance(cal), history: H, fallbackMonthly: 0, cal });
    expect(r).toMatchObject({ amount: 2_100_000, workedDays: 20, plannedDays: 20 });
  });

  it("нийлбэрийг нэг удаа бөөрөнхийлнө: 1,000,000 ÷ 21 × 21 = 1,000,000 (999,999 биш)", () => {
    const r = basePay({ days: attendance(MONFRI), history: [{ effectiveFrom: "2026-01-01", monthly: 1_000_000 }], fallbackMonthly: 0, cal: MONFRI });
    expect(r.amount).toBe(1_000_000);
  });

  it("хуваарьт ажлын өдөргүй сар → 0, анхааруулга", () => {
    const none: WorkCalendar = { weekdays: new Set(), holidays: new Set() };
    const r = basePay({ days: [{ date: "2026-11-02", status: "WORKED" }], history: H, fallbackMonthly: 0, cal: none });
    expect(r.amount).toBe(0);
    expect(r.warnings).toContain("NO_PLANNED_DAYS");
  });
});

describe("5–8. НДШ, ХХОАТ, гарт олгох", () => {
  it.each([
    // gross, SI ажилтан, ХХОАТ, ажил олгогч, гарт (хасалтгүй)
    { gross: 1_000_000, si: 115_000, pit: 70_500, er: 125_000, net: 814_500 }, // 88,500 − 18,000 хөнгөлөлт
    { gross: 6_000_000, si: 575_000, pit: 542_500, er: 625_000, net: 4_882_500 }, // дээд хязгаар 5 сая
    { gross: 100_000, si: 11_500, pit: 0, er: 12_500, net: 88_500 }, // хөнгөлөлт > татвар → 0 (сөрөг биш)
    { gross: 0, si: 0, pit: 0, er: 0, net: 0 },
  ])("gross $gross → НДШ $si, ХХОАТ $pit, ажил олгогч $er, гарт $net", ({ gross, si, pit, er, net }) => {
    const r = computeLine({ base: gross, serviceCommission: 0, productCommission: 0, additions: 0, deductions: 0 }, RATES, { withhold: true, fraction: 1 });
    expect(r).toMatchObject({ gross, siEmployee: si, pit, siEmployer: er, net });
    expect(r.warnings).toEqual([]);
  });

  it("хөнгөлөлтийн шатлал: хил дээрх утга", () => {
    expect(pitCreditFor(500_000, RATES.pitCredits)).toBe(20_000);
    expect(pitCreditFor(500_001, RATES.pitCredits)).toBe(18_000);
    expect(pitCreditFor(9_000_000, RATES.pitCredits)).toBe(0);
    expect(pitCreditFor(100, [])).toBe(0);
  });

  it("gross = үндсэн + үйлчилгээний + бүтээгдэхүүний урамшуулал + нэмэлт; хасалт гарт олгохоос", () => {
    const r = computeLine({ base: 800_000, serviceCommission: 150_000, productCommission: 20_000, additions: 30_000, deductions: 50_000 }, RATES, { withhold: true, fraction: 1 });
    expect(r.gross).toBe(1_000_000);
    expect(r.net).toBe(814_500 - 50_000);
  });

  it("сөрөг үр дүн: хасалт > цалин → NEGATIVE_NET анхааруулга (батлахыг хориглоно)", () => {
    const r = computeLine({ base: 300_000, serviceCommission: 0, productCommission: 0, additions: 0, deductions: 500_000 }, RATES, { withhold: true, fraction: 1 });
    expect(r.net).toBeLessThan(0);
    expect(r.warnings).toContain("NEGATIVE_NET");
  });

  it("хувь хэмжээ баталгаажаагүй/байхгүй → NO_RATES", () => {
    const r = computeLine({ base: 1_000_000, serviceCommission: 0, productCommission: 0, additions: 0, deductions: 0 }, null, { withhold: true, fraction: 1 });
    expect(r.warnings).toContain("NO_RATES");
  });

  it("хагас сарын бие даасан тооцоо: хязгаар ½, хөнгөлөлт ½ (шатлал — сарын дүйцэх 2,000,000-оор)", () => {
    const w = withholdings(1_000_000, RATES, 0.5);
    expect(w).toMatchObject({ siEmployee: 115_000, credit: 7_000, pit: 81_500 });
    expect(withholdings(3_000_000, RATES, 0.5).siBase).toBe(2_500_000);
  });
});

describe("урьдчилгаа + сарын эцэс", () => {
  it("урьдчилгаа суутгалгүй 1,050,000; сарын эцэст бүтэн сараар суутгаад урьдчилгааг хасна → 744,125", () => {
    // 1–15: үндсэн 1,000,000 + урамшуулал 50,000; 16–30: үндсэн 1,100,000 + урамшуулал 70,000; нэмэлт 30,000, хасалт 10,000
    const adv = computeLine({ base: 1_000_000, serviceCommission: 50_000, productCommission: 0, additions: 0, deductions: 0 }, RATES, { withhold: false, fraction: 0.5 });
    expect(adv).toMatchObject({ gross: 1_050_000, siEmployee: 0, pit: 0, net: 1_050_000 });

    const month = { base: 2_100_000, serviceCommission: 120_000, productCommission: 0, additions: 30_000, deductions: 10_000 };
    const f = computeFinal(month, { ...adv, deductions: 0 }, RATES);
    // Сар: gross 2,250,000; НДШ 258,750; ХХОАТ 199,125 − 12,000 = 187,125; гарт 1,794,125
    expect(f.month).toMatchObject({ gross: 2_250_000, siEmployee: 258_750, pit: 187_125, net: 1_794_125 });
    expect(f.line).toMatchObject({ gross: 1_200_000, siEmployee: 258_750, pit: 187_125, advancePaid: 1_050_000, net: 744_125 });
    // Хоёр үеийн нийлбэр = сарын дүн
    expect(adv.gross + f.line.gross).toBe(f.month.gross);
    expect(adv.net + f.line.net).toBe(f.month.net);
    // Мөр бүрт ижил томьёо: гарт = gross − НДШ − ХХОАТ − хасалт (FINAL-ийн gross нь сарын gross − урьдчилгааны gross)
    expect(f.line.gross - f.line.siEmployee - f.line.pit - f.line.deductions).toBe(f.line.net);
  });

  it("урьдчилгааг суутгалтай олгосон бол сарын эцэст тэр суутгалыг давхар хасахгүй", () => {
    const adv = computeLine({ base: 1_000_000, serviceCommission: 0, productCommission: 0, additions: 0, deductions: 0 }, RATES, { withhold: true, fraction: 0.5 });
    const month = { base: 2_000_000, serviceCommission: 0, productCommission: 0, additions: 0, deductions: 0 };
    const f = computeFinal(month, { ...adv, deductions: 0 }, RATES);
    expect(adv.siEmployee + f.line.siEmployee).toBe(f.month.siEmployee);
    expect(adv.pit + f.line.pit).toBe(f.month.pit);
    expect(adv.net + f.line.net).toBe(f.month.net);
  });

  it("урьдчилгаа сарын цалингаас их → сарын эцэс сөрөг, анхааруулга", () => {
    const f = computeFinal({ base: 500_000, serviceCommission: 0, productCommission: 0, additions: 0, deductions: 0 }, { gross: 800_000, siEmployee: 0, pit: 0, siEmployer: 0, deductions: 0, net: 800_000 }, RATES);
    expect(f.line.net).toBeLessThan(0);
    expect(f.warnings).toContain("NEGATIVE_NET");
  });
});
