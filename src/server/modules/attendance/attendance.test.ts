import { describe, expect, it } from "vitest";
import { defaultStatus } from "@/server/modules/payroll/calc";
import { evaluateGeo, haversineM } from "./geo";
import { hoursOfDay, sessionsOf } from "./sessions";

const SALON = { id: "b1", latitude: 47.918, longitude: 106.917, geoRadiusM: 100, allowedIps: [] as string[] };
/** Хойд зүг рүү `m` метр */
const north = (m: number) => ({ lat: SALON.latitude + m / 111_195, lng: SALON.longitude });

describe("haversine / байршил", () => {
  it("зай", () => {
    expect(Math.round(haversineM(SALON.latitude, SALON.longitude, north(80).lat, north(80).lng))).toBe(80);
  });
  it("80 м → зөвшөөрнө; 400 м → татгалзана", () => {
    expect(evaluateGeo([SALON], { ...north(80), accuracyM: 10 }, null)).toMatchObject({ ok: true, branchId: "b1", flagged: false });
    expect(evaluateGeo([SALON], { ...north(400), accuracyM: 10 }, null)).toMatchObject({ ok: false, reason: "too-far", distanceM: 400 });
  });
  it("нарийвчлалын нэмэлт ≤ 50 м: 140 м + accuracy 60 → OK (100+50); 160 м → үгүй", () => {
    expect(evaluateGeo([SALON], { ...north(140), accuracyM: 60 }, null).ok).toBe(true);
    expect(evaluateGeo([SALON], { ...north(160), accuracyM: 500 }, null).ok).toBe(false);
  });
  it("нарийвчлал > 150 м эсвэл IP таарахгүй → бүртгэнэ, flagged", () => {
    expect(evaluateGeo([SALON], { ...north(20), accuracyM: 200 }, null)).toMatchObject({ ok: true, flagged: true, reasons: ["accuracy"] });
    const withIp = { ...SALON, allowedIps: ["203.0.113.5"] };
    expect(evaluateGeo([withIp], { ...north(20), accuracyM: 10 }, "198.51.100.1")).toMatchObject({ ok: true, flagged: true, reasons: ["ip"] });
    expect(evaluateGeo([withIp], { ...north(20), accuracyM: 10 }, "203.0.113.5")).toMatchObject({ ok: true, flagged: false });
  });
  it("салбарын байршил тохируулаагүй", () => {
    expect(evaluateGeo([{ ...SALON, latitude: null, longitude: null }], { ...north(0), accuracyM: 5 }, null)).toEqual({ ok: false, reason: "no-branch-location" });
  });
});

const t = (hm: string) => new Date(`2026-11-26T${hm}:00+08:00`);

describe("сесс → цаг", () => {
  it("10:00–18:30 → 8.5", () => {
    expect(hoursOfDay([{ type: "CHECK_IN", at: t("10:00") }, { type: "CHECK_OUT", at: t("18:30") }])).toBe(8.5);
  });
  it("хоёр сесс 10–13, 14–19 → 8", () => {
    expect(
      hoursOfDay([
        { type: "CHECK_IN", at: t("10:00") },
        { type: "CHECK_OUT", at: t("13:00") },
        { type: "CHECK_IN", at: t("14:00") },
        { type: "CHECK_OUT", at: t("19:00") },
      ]),
    ).toBe(8);
  });
  it("0.25 цагаар бөөрөнхийлнө; нээлттэй сесс тоологдохгүй", () => {
    expect(hoursOfDay([{ type: "CHECK_IN", at: t("10:00") }, { type: "CHECK_OUT", at: t("17:08") }])).toBe(7.25);
    expect(sessionsOf([{ type: "CHECK_IN", at: t("10:00") }])).toEqual([{ in: t("10:00"), out: null }]);
    expect(hoursOfDay([{ type: "CHECK_IN", at: t("10:00") }])).toBe(0);
  });
});


describe("автомат ирц (PROMPT 20)", () => {
  const cal = { weekdays: new Set([1, 2, 3, 4, 5]), holidays: new Set<string>(), autoSince: "2026-11-23", today: "2026-11-26" };
  it("autoSince-ээс хойш өнгөрсөн хуваарийн өдөр бүртгэлгүй бол ABSENT; өнөөдөр/ирээдүй, өмнөх, амралт — хуучнаар", () => {
    expect(defaultStatus("2026-11-24", cal)).toBe("ABSENT");
    expect(defaultStatus("2026-11-26", cal)).toBe("WORKED");
    expect(defaultStatus("2026-11-20", cal)).toBe("WORKED");
    expect(defaultStatus("2026-11-22", cal)).toBe("OFF");
    expect(defaultStatus("2026-11-24", { ...cal, autoSince: null })).toBe("WORKED");
  });
});
