import { describe, expect, it } from "vitest";
import type { ApptStatus } from "@/generated/prisma/enums";
import { ApptStateError, availableActions, isEditable, nextApptStatus, type ApptAction } from "./state";

const ALL: ApptStatus[] = ["PENDING", "BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "DONE", "CANCELLED", "NO_SHOW"];
const now = new Date("2026-12-02T05:00:00Z");
const started = new Date("2026-12-02T04:00:00Z");
const future = new Date("2026-12-02T06:00:00Z");

describe("appointment state machine", () => {
  const allowed: Record<ApptAction, ApptStatus[]> = {
    confirm: ["BOOKED"],
    arrive: ["BOOKED", "CONFIRMED"],
    start: ["ARRIVED"],
    complete: ["ARRIVED", "IN_PROGRESS"],
    cancel: ["PENDING", "BOOKED", "CONFIRMED"],
    noShow: ["BOOKED", "CONFIRMED"],
    approve: ["PENDING"],
    reject: ["PENDING"],
  };
  const ctx = { now, startsAt: started, reason: "Үйлчлүүлэгч цуцалсан" };

  for (const [action, from] of Object.entries(allowed) as [ApptAction, ApptStatus[]][]) {
    for (const s of ALL) {
      it(`${action} from ${s} → ${from.includes(s) ? "ok" : "rejected"}`, () => {
        if (from.includes(s)) expect(() => nextApptStatus(s, action, ctx)).not.toThrow();
        else expect(() => nextApptStatus(s, action, ctx)).toThrow(ApptStateError);
      });
    }
  }

  it("targets", () => {
    expect(nextApptStatus("BOOKED", "confirm")).toBe("CONFIRMED");
    expect(nextApptStatus("CONFIRMED", "arrive")).toBe("ARRIVED");
    expect(nextApptStatus("ARRIVED", "start")).toBe("IN_PROGRESS");
    expect(nextApptStatus("IN_PROGRESS", "complete", { now, startsAt: started, reason: "x" })).toBe("DONE");
    expect(nextApptStatus("BOOKED", "cancel", { reason: "x" })).toBe("CANCELLED");
    expect(nextApptStatus("BOOKED", "noShow", { now, startsAt: started })).toBe("NO_SHOW");
  });

  it("cancel needs a reason; ARRIVED cannot be cancelled", () => {
    expect(() => nextApptStatus("BOOKED", "cancel", { reason: "  " })).toThrow(/шалтгаан/);
    expect(() => nextApptStatus("ARRIVED", "cancel", { reason: "x" })).toThrow(/POS/);
  });

  it("no-show only after the start time", () => {
    expect(() => nextApptStatus("BOOKED", "noShow", { now, startsAt: future })).toThrow(/эхлээгүй/);
  });

  it("manual complete: only ARRIVED/IN_PROGRESS, after the start time, with a reason", () => {
    expect(() => nextApptStatus("BOOKED", "complete", { now, startsAt: started, reason: "x" })).toThrow(/ирсэн/);
    expect(() => nextApptStatus("CONFIRMED", "complete", { now, startsAt: started, reason: "x" })).toThrow(/ирсэн/);
    expect(() => nextApptStatus("ARRIVED", "complete", { now, startsAt: future, reason: "x" })).toThrow(/эхлээгүй/);
    expect(() => nextApptStatus("ARRIVED", "complete", { now, startsAt: started, reason: " " })).toThrow(/шалтгаан/);
    expect(nextApptStatus("ARRIVED", "complete", { now, startsAt: started, reason: "POS-гүй" })).toBe("DONE");
  });

  it("editable / available actions", () => {
    expect(isEditable("BOOKED")).toBe(true);
    expect(isEditable("ARRIVED")).toBe(false);
    expect(availableActions("CONFIRMED")).toEqual(["arrive", "cancel", "noShow"]);
    expect(availableActions("DONE")).toEqual([]);
  });
});
