import type { MonthlyEnqueueDecision } from "./monthly-enqueue";

export type EnqueueDuplicateLogLevel = "info" | "warn";

/**
 * Log estruturado quando o enqueue mensal é ignorado por chave idempotente duplicada (DoD AG-03).
 * O worker deve chamar após `ON CONFLICT DO NOTHING` ou quando `decideMonthlyScheduledEnqueue` devolve `skip_duplicate`.
 */
export function logStructuredMonthlyEnqueueDuplicateIgnored(
  input: { companyId: string; idempotencyKey: string },
  log: Pick<Console, "info" | "warn"> = console,
  level: EnqueueDuplicateLogLevel = "info",
): void {
  const payload = {
    event: "scheduled_monthly_enqueue_ignored",
    reason: "duplicate_idempotency_key",
    companyId: input.companyId,
    idempotencyKey: input.idempotencyKey,
    ts: new Date().toISOString(),
  };
  const line = JSON.stringify(payload);
  if (level === "warn") {
    log.warn(line);
  } else {
    log.info(line);
  }
}

export function maybeLogMonthlyEnqueueDecision(
  decision: MonthlyEnqueueDecision,
  companyId: string,
  log: Pick<Console, "info" | "warn"> = console,
): void {
  if (decision.action === "skip_duplicate") {
    logStructuredMonthlyEnqueueDuplicateIgnored(
      { companyId, idempotencyKey: decision.idempotencyKey },
      log,
    );
  }
}
