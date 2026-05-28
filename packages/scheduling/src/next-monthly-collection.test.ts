import { describe, expect, it } from "vitest";
import { computeNextMonthlyCollection } from "./next-monthly-collection";
import { scheduledForSixAmSpIso, utcAtZonedWall, SAO_PAULO } from "./monthly-enqueue";

describe("computeNextMonthlyCollection", () => {
  it("ADN desactivado → adn_disabled", () => {
    const now = utcAtZonedWall(2026, 6, 3, 12, 0, SAO_PAULO);
    expect(
      computeNextMonthlyCollection({
        now,
        monthlyRunDay: 15,
        adnSyncEnabled: false,
        hasMonthlyJobForCurrentPeriod: false,
      }),
    ).toEqual({ kind: "adn_disabled" });
  });

  it("dia 15, hoje dia 3 → 15 deste mês", () => {
    const now = utcAtZonedWall(2026, 6, 3, 12, 0, SAO_PAULO);
    const r = computeNextMonthlyCollection({
      now,
      monthlyRunDay: 15,
      adnSyncEnabled: true,
      hasMonthlyJobForCurrentPeriod: false,
    });
    expect(r).toEqual({
      kind: "next_run",
      scheduledAtIso: scheduledForSixAmSpIso(2026, 6, 15),
      isToday: false,
      alreadyEnqueuedThisMonth: false,
    });
  });

  it("dia 15, hoje dia 15, sem job → hoje", () => {
    const now = utcAtZonedWall(2026, 6, 15, 8, 0, SAO_PAULO);
    const r = computeNextMonthlyCollection({
      now,
      monthlyRunDay: 15,
      adnSyncEnabled: true,
      hasMonthlyJobForCurrentPeriod: false,
    });
    expect(r).toEqual({
      kind: "next_run",
      scheduledAtIso: scheduledForSixAmSpIso(2026, 6, 15),
      isToday: true,
      alreadyEnqueuedThisMonth: false,
    });
  });

  it("dia 15, hoje dia 20, sem job → 15 do mês seguinte", () => {
    const now = utcAtZonedWall(2026, 6, 20, 12, 0, SAO_PAULO);
    const r = computeNextMonthlyCollection({
      now,
      monthlyRunDay: 15,
      adnSyncEnabled: true,
      hasMonthlyJobForCurrentPeriod: false,
    });
    expect(r).toEqual({
      kind: "next_run",
      scheduledAtIso: scheduledForSixAmSpIso(2026, 7, 15),
      isToday: false,
      alreadyEnqueuedThisMonth: false,
    });
  });

  it("job já existe no mês → 15 do mês seguinte mesmo em dia 10", () => {
    const now = utcAtZonedWall(2026, 6, 10, 12, 0, SAO_PAULO);
    const r = computeNextMonthlyCollection({
      now,
      monthlyRunDay: 15,
      adnSyncEnabled: true,
      hasMonthlyJobForCurrentPeriod: true,
    });
    expect(r).toEqual({
      kind: "next_run",
      scheduledAtIso: scheduledForSixAmSpIso(2026, 7, 15),
      isToday: false,
      alreadyEnqueuedThisMonth: true,
    });
  });

  it("virada de ano: dez dia 20, D=15 → 15 jan", () => {
    const now = utcAtZonedWall(2026, 12, 20, 12, 0, SAO_PAULO);
    const r = computeNextMonthlyCollection({
      now,
      monthlyRunDay: 15,
      adnSyncEnabled: true,
      hasMonthlyJobForCurrentPeriod: false,
    });
    expect(r).toEqual({
      kind: "next_run",
      scheduledAtIso: scheduledForSixAmSpIso(2027, 1, 15),
      isToday: false,
      alreadyEnqueuedThisMonth: false,
    });
  });
});
