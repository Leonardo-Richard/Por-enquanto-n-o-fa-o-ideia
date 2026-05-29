import { z } from "zod";

/** Valores alinhados ao CHECK SQL em `adn_sync_jobs.status`. */
export const adnSyncJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
]);

/** Valores alinhados ao CHECK SQL em `adn_sync_jobs.trigger`. */
export const adnSyncJobTriggerSchema = z.enum([
  "manual",
  "scheduled",
  "retry",
  "worker",
  "monthly",
]);

export type AdnSyncJobStatus = z.infer<typeof adnSyncJobStatusSchema>;
export type AdnSyncJobTrigger = z.infer<typeof adnSyncJobTriggerSchema>;

/** Rótulos de UI / mock — não confundir com `AdnSyncJobTrigger` da DB. */
export type ExecutionDisplayTrigger = "signup" | "monthly" | "manual";

export function mapAdnJobTriggerToDisplay(trigger: AdnSyncJobTrigger): ExecutionDisplayTrigger {
  if (trigger === "monthly" || trigger === "scheduled") return "monthly";
  if (trigger === "manual") return "manual";
  return "manual";
}
