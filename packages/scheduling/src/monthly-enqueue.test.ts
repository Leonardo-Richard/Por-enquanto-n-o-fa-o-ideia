import { describe, expect, it } from "vitest";
import {
  decideMonthlyScheduledEnqueue,
  buildSchedMonthlyIdempotencyKey,
  monthlyPeriodKeySp,
  scheduledForSixAmSpIso,
  utcAtZonedWall,
  SAO_PAULO,
} from "./monthly-enqueue";

describe("buildSchedMonthlyIdempotencyKey", () => {
  it("usa prefixo e mês civil", () => {
    expect(buildSchedMonthlyIdempotencyKey("co-1", "2026-02")).toBe(
      "sched_monthly:co-1:2026-02",
    );
  });
});

describe("#fevereiro-d28", () => {
  it("28 fev 2026 SP às 06:05 → enqueue com scheduled_for 06:00 SP", () => {
    const now = utcAtZonedWall(2026, 2, 28, 6, 5, SAO_PAULO);
    expect(monthlyPeriodKeySp(now)).toBe("2026-02");
    const d = decideMonthlyScheduledEnqueue({
      now,
      companyId: "c1",
      monthlyRunDay: 28,
      active: true,
      existingKeys: new Set(),
    });
    expect(d.action).toBe("enqueue");
    if (d.action === "enqueue") {
      expect(d.idempotencyKey).toBe("sched_monthly:c1:2026-02");
      expect(d.scheduledForIso).toBe(scheduledForSixAmSpIso(2026, 2, 28));
    }
  });
});

describe("#duplo-tick-mesmo-dia", () => {
  it("segundo tick vê chave existente → skip_duplicate", () => {
    const now = utcAtZonedWall(2026, 3, 15, 6, 10, SAO_PAULO);
    const key = buildSchedMonthlyIdempotencyKey("c2", "2026-03");
    const first = decideMonthlyScheduledEnqueue({
      now,
      companyId: "c2",
      monthlyRunDay: 15,
      active: true,
      existingKeys: new Set(),
    });
    expect(first.action).toBe("enqueue");
    const second = decideMonthlyScheduledEnqueue({
      now,
      companyId: "c2",
      monthlyRunDay: 15,
      active: true,
      existingKeys: new Set([key]),
    });
    expect(second).toEqual({ action: "skip_duplicate", idempotencyKey: key });
  });
});

describe("#mudanca-intra-mes", () => {
  it("job já agendado no mês → novo dia D não enfileira de novo", () => {
    const nowDay10 = utcAtZonedWall(2026, 4, 10, 6, 10, SAO_PAULO);
    const period = monthlyPeriodKeySp(nowDay10);
    const key = buildSchedMonthlyIdempotencyKey("c3", period);
    const d = decideMonthlyScheduledEnqueue({
      now: nowDay10,
      companyId: "c3",
      monthlyRunDay: 10,
      active: true,
      existingKeys: new Set([key]),
    });
    expect(d.action).toBe("skip_duplicate");
  });
});

describe("#pos-execucao-mesmo-mes", () => {
  it("chave existente (pós-execução) bloqueia novo enqueue no mesmo YYYY-MM", () => {
    const now = utcAtZonedWall(2026, 5, 20, 7, 0, SAO_PAULO);
    const key = buildSchedMonthlyIdempotencyKey("c4", "2026-05");
    const d = decideMonthlyScheduledEnqueue({
      now,
      companyId: "c4",
      monthlyRunDay: 20,
      active: true,
      existingKeys: new Set([key]),
    });
    expect(d.action).toBe("skip_duplicate");
  });
});
