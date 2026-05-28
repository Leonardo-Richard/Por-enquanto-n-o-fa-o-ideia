import {
  scheduledForSixAmSpIso,
  zonedPartsFromInstant,
} from "./monthly-enqueue";

export type NextMonthlyCollectionPreview =
  | { kind: "adn_disabled" }
  | {
      kind: "next_run";
      scheduledAtIso: string;
      isToday: boolean;
      alreadyEnqueuedThisMonth: boolean;
    };

function nextCalendarMonth(year: number, month: number): { year: number; month: number } {
  if (month >= 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

function scheduledAtForDay(year: number, month: number, day: number): string {
  return scheduledForSixAmSpIso(year, month, day);
}

/**
 * Próximo instante nominal (06:00 SP) em que o cron tentará enfileirar
 * a coleta mensal automática, alinhado a `decideMonthlyScheduledEnqueue`.
 */
export function computeNextMonthlyCollection(input: {
  now: Date;
  monthlyRunDay: number;
  adnSyncEnabled: boolean;
  hasMonthlyJobForCurrentPeriod: boolean;
}): NextMonthlyCollectionPreview {
  if (!input.adnSyncEnabled) {
    return { kind: "adn_disabled" };
  }

  const w = zonedPartsFromInstant(input.now);
  const d = input.monthlyRunDay;

  if (input.hasMonthlyJobForCurrentPeriod) {
    const next = nextCalendarMonth(w.year, w.month);
    return {
      kind: "next_run",
      scheduledAtIso: scheduledAtForDay(next.year, next.month, d),
      isToday: false,
      alreadyEnqueuedThisMonth: true,
    };
  }

  if (w.day < d) {
    return {
      kind: "next_run",
      scheduledAtIso: scheduledAtForDay(w.year, w.month, d),
      isToday: false,
      alreadyEnqueuedThisMonth: false,
    };
  }

  if (w.day === d) {
    return {
      kind: "next_run",
      scheduledAtIso: scheduledAtForDay(w.year, w.month, d),
      isToday: true,
      alreadyEnqueuedThisMonth: false,
    };
  }

  const next = nextCalendarMonth(w.year, w.month);
  return {
    kind: "next_run",
    scheduledAtIso: scheduledAtForDay(next.year, next.month, d),
    isToday: false,
    alreadyEnqueuedThisMonth: false,
  };
}

/** Mapeia o resultado puro para o contrato partilhado da API. */
export function toMonthlyCollectionPreview(
  result: NextMonthlyCollectionPreview,
  adnSyncEnabled: boolean,
): {
  scheduledAt: string | null;
  adnSyncEnabled: boolean;
  alreadyEnqueuedThisMonth: boolean;
  isToday: boolean;
} {
  if (result.kind === "adn_disabled") {
    return {
      scheduledAt: null,
      adnSyncEnabled: false,
      alreadyEnqueuedThisMonth: false,
      isToday: false,
    };
  }
  return {
    scheduledAt: result.scheduledAtIso,
    adnSyncEnabled,
    alreadyEnqueuedThisMonth: result.alreadyEnqueuedThisMonth,
    isToday: result.isToday,
  };
}
