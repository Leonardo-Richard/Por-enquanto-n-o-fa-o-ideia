import { describe, expect, it, vi } from "vitest";
import { handlePatchJob } from "./patch-job";

function mockDbChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const whereSelect = vi.fn(() => ({ limit }));
  const fromSelect = vi.fn(() => ({ where: whereSelect }));
  const select = vi.fn(() => ({ from: fromSelect }));

  const whereUpdate = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where: whereUpdate }));
  const update = vi.fn(() => ({ set }));

  return {
    db: { select, update } as never,
    select,
    update,
    set,
  };
}

describe("handlePatchJob", () => {
  it("retorna ok mesmo quando a auditoria falha", async () => {
    const jobId = "f323c819-18a2-4385-9882-515019b48a34";
    const orgId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const companyId = "11111111-2222-3333-4444-555555555555";
    const { db, update } = mockDbChain([
      {
        id: jobId,
        organizationId: orgId,
        companyId,
        status: "running",
        requestedByUserId: null,
        trigger: "manual",
      },
    ]);

    const insertAudit = vi.fn().mockRejectedValue(new Error("FK audit_events_actor"));

    const result = await handlePatchJob(
      db,
      jobId,
      {
        organizationId: orgId,
        status: "failed",
        summaryJson: { phase: "error", failureCategory: "extension" },
        completedAt: new Date().toISOString(),
      },
      insertAudit,
    );

    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(update).toHaveBeenCalled();
    expect(insertAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ eventType: "adn_sync_failed" }),
    );
  });
});
