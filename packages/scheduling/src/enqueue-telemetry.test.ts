import { describe, expect, it, vi } from "vitest";
import {
  logStructuredMonthlyEnqueueDuplicateIgnored,
  maybeLogMonthlyEnqueueDecision,
} from "./enqueue-telemetry";
import {
  decideMonthlyScheduledEnqueue,
  utcAtZonedWall,
  SAO_PAULO,
} from "./monthly-enqueue";

describe("logStructuredMonthlyEnqueueDuplicateIgnored", () => {
  it("emite JSON em console.info (observabilidade AG-03)", () => {
    const info = vi.fn();
    logStructuredMonthlyEnqueueDuplicateIgnored(
      { companyId: "c1", idempotencyKey: "sched_monthly:c1:2026-02" },
      { info, warn: vi.fn() },
    );
    expect(info).toHaveBeenCalledTimes(1);
    const raw = info.mock.calls[0][0] as string;
    const obj = JSON.parse(raw) as Record<string, string>;
    expect(obj.event).toBe("scheduled_monthly_enqueue_ignored");
    expect(obj.reason).toBe("duplicate_idempotency_key");
    expect(obj.companyId).toBe("c1");
    expect(obj.idempotencyKey).toContain("sched_monthly:");
  });
});

describe("maybeLogMonthlyEnqueueDecision", () => {
  it("regista apenas em skip_duplicate", () => {
    const info = vi.fn();
    maybeLogMonthlyEnqueueDecision(
      { action: "skip_not_target_day", daySp: 3, monthlyRunDay: 15 },
      "c2",
      { info, warn: vi.fn() },
    );
    expect(info).not.toHaveBeenCalled();

    maybeLogMonthlyEnqueueDecision(
      { action: "skip_duplicate", idempotencyKey: "k" },
      "c2",
      { info, warn: vi.fn() },
    );
    expect(info).toHaveBeenCalled();
  });

  it("integração com decideMonthlyScheduledEnqueue + chave existente", () => {
    const info = vi.fn();
    const now = utcAtZonedWall(2026, 6, 15, 10, 0, SAO_PAULO);
    const d = decideMonthlyScheduledEnqueue({
      now,
      companyId: "c3",
      monthlyRunDay: 15,
      active: true,
      existingKeys: new Set(["sched_monthly:c3:2026-06"]),
    });
    expect(d.action).toBe("skip_duplicate");
    if (d.action === "skip_duplicate") {
      maybeLogMonthlyEnqueueDecision(d, "c3", { info, warn: vi.fn() });
    }
    expect(info).toHaveBeenCalled();
  });
});
