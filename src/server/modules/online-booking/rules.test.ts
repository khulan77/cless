import { describe, expect, it } from "vitest";
import { blockedByNoShows, bookingWindowProblem, canCustomerCancel, tooManyFuture } from "./rules";

const now = new Date("2026-12-01T02:00:00Z");
const h = (n: number) => new Date(now.getTime() + n * 3_600_000);
const S = { minLeadHours: 2, maxDaysAhead: 60 };

describe("онлайн захиалгын дүрэм", () => {
  it.each([
    [h(1.9), "TOO_SOON"],
    [h(2), null],
    [h(60 * 24), null],
    [h(60 * 24 + 1), "TOO_FAR"],
  ])("хугацааны хүрээ %s → %s", (at, want) => expect(bookingWindowProblem(at, now, S)).toBe(want));

  it("цуцлах эрх: эхлэхээс 24 цагийн өмнө хүртэл", () => {
    expect(canCustomerCancel(h(24), now, 24)).toBe(true);
    expect(canCustomerCancel(h(23.9), now, 24)).toBe(false);
    expect(canCustomerCancel(h(1), now, 0)).toBe(true);
  });

  it("3 ирээдүйн захиалгын хязгаар, 2+ ирээгүй бол хаагдана", () => {
    expect(tooManyFuture(2)).toBe(false);
    expect(tooManyFuture(3)).toBe(true);
    expect(blockedByNoShows(1)).toBe(false);
    expect(blockedByNoShows(2)).toBe(true);
  });
});
