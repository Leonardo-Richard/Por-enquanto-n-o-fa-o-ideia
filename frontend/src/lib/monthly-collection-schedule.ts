import { computeNextMonthlyCollection, toMonthlyCollectionPreview } from "@repo/scheduling";
import type { MonthlyCollectionPreview } from "@repo/shared";

export const SAO_PAULO_TZ = "America/Sao_Paulo";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TZ,
  dateStyle: "long",
  timeStyle: "short",
});

/** Diferença em dias civis SP entre `now` e `scheduledAtIso`. */
export function civilDaysUntilSp(scheduledAtIso: string, now: Date = new Date()): number {
  const sched = new Date(scheduledAtIso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = (d: Date) => {
    const p = fmt.formatToParts(d);
    const m: Record<string, string> = {};
    for (const x of p) {
      if (x.type !== "literal") {
        m[x.type] = x.value;
      }
    }
    return (
      Number(m.year) * 10_000 + Number(m.month) * 100 + Number(m.day)
    );
  };
  return Math.round((parts(sched) - parts(now)) / 1);
}

export function formatScheduledAtPtBr(scheduledAtIso: string): string {
  return dateTimeFormatter.format(new Date(scheduledAtIso));
}

export function relativeDaysLabel(days: number, isToday: boolean): string | null {
  if (isToday) {
    return "hoje";
  }
  if (days === 1) {
    return "daqui a 1 dia";
  }
  if (days > 1) {
    return `daqui a ${days} dias`;
  }
  return null;
}

export function buildMonthlyCollectionPreview(input: {
  monthlyRunDay: number;
  adnSyncEnabled: boolean;
  hasMonthlyJobForCurrentPeriod: boolean;
  now?: Date;
}): MonthlyCollectionPreview {
  const result = computeNextMonthlyCollection({
    now: input.now ?? new Date(),
    monthlyRunDay: input.monthlyRunDay,
    adnSyncEnabled: input.adnSyncEnabled,
    hasMonthlyJobForCurrentPeriod: input.hasMonthlyJobForCurrentPeriod,
  });
  return toMonthlyCollectionPreview(result, input.adnSyncEnabled);
}
