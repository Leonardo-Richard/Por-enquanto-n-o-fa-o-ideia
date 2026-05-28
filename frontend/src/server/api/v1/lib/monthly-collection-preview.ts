import {
  buildSchedMonthlyIdempotencyKey,
  computeNextMonthlyCollection,
  monthlyPeriodKeySp,
  toMonthlyCollectionPreview,
} from "@repo/scheduling";
import type { MonthlyCollectionPreview } from "@repo/shared";
import { eq } from "drizzle-orm";
import type { Db } from "@repo/db";
import { adnSyncJobs } from "@repo/db";

export async function loadMonthlyCollectionPreview(
  db: Db,
  input: {
    companyId: string;
    monthlyRunDay: number;
    adnSyncEnabled: boolean;
    now?: Date;
  },
): Promise<MonthlyCollectionPreview> {
  const now = input.now ?? new Date();
  const periodKey = monthlyPeriodKeySp(now);
  const idempotencyKey = buildSchedMonthlyIdempotencyKey(input.companyId, periodKey);

  const [existing] = await db
    .select({ id: adnSyncJobs.id })
    .from(adnSyncJobs)
    .where(eq(adnSyncJobs.idempotencyKey, idempotencyKey))
    .limit(1);

  const result = computeNextMonthlyCollection({
    now,
    monthlyRunDay: input.monthlyRunDay,
    adnSyncEnabled: input.adnSyncEnabled,
    hasMonthlyJobForCurrentPeriod: Boolean(existing),
  });

  return toMonthlyCollectionPreview(result, input.adnSyncEnabled);
}
