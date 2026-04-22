/**
 * Fuso fixo do PRD / worker (sem TZ por empresa neste incremento).
 * `utcAtZonedWall` usa `Intl` + busca binária — adequado para América/São Paulo
 * (sem DST desde 2019). Para outros fusos com transições, preferir biblioteca TZ dedicada.
 */
export const SAO_PAULO = "America/Sao_Paulo" as const;

type Wall = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function readWall(timeZone: string, utcMs: number): Wall {
  const d = new Date(utcMs);
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      m[p.type] = p.value;
    }
  }
  return {
    year: Number(m.year),
    month: Number(m.month),
    day: Number(m.day),
    hour: Number(m.hour),
    minute: Number(m.minute),
  };
}

function cmpWall(a: Wall, b: Wall): number {
  return (
    a.year - b.year ||
    a.month - b.month ||
    a.day - b.day ||
    a.hour - b.hour ||
    a.minute - b.minute
  );
}

/**
 * Instante UTC em que o relógio civil em `timeZone` é exatamente
 * `year-month-day hh:mm` (SP não tem transição DST desde 2019).
 */
export function utcAtZonedWall(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const target: Wall = { year, month, day, hour, minute };
  let lo = Date.UTC(year, month - 1, day, 0, 0, 0) - 40 * 3600000;
  let hi = Date.UTC(year, month - 1, day, 0, 0, 0) + 40 * 3600000;
  let best = lo;
  for (let i = 0; i < 64; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const w = readWall(timeZone, mid);
    const c = cmpWall(w, target);
    if (c === 0) {
      return new Date(mid);
    }
    if (c < 0) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
    best = mid;
  }
  return new Date(best);
}

export function zonedPartsFromInstant(now: Date): Wall {
  return readWall(SAO_PAULO, now.getTime());
}

export function zonedNow(now: Date): Wall {
  return zonedPartsFromInstant(now);
}

/** Chave civil `YYYY-MM` em América/São Paulo (âncora do idempotency). */
export function monthlyPeriodKeySp(now: Date): string {
  const w = zonedPartsFromInstant(now);
  return `${w.year}-${String(w.month).padStart(2, "0")}`;
}

export function civilDayOfMonthSp(now: Date): number {
  return zonedPartsFromInstant(now).day;
}

/** `sched_monthly:{companyId}:{YYYY-MM}` — mês civil SP. */
export function buildSchedMonthlyIdempotencyKey(
  companyId: string,
  periodKey: string,
): string {
  return `sched_monthly:${companyId}:${periodKey}`;
}

/**
 * `scheduled_for` = dia D às 06:00 em SP, armazenado como instante UTC (TIMESTAMPTZ).
 */
export function scheduledForSixAmSpIso(year: number, month: number, day: number): string {
  return utcAtZonedWall(year, month, day, 6, 0, SAO_PAULO).toISOString();
}

export type MonthlyEnqueueDecision =
  | { action: "skip_inactive" }
  | { action: "skip_not_target_day"; daySp: number; monthlyRunDay: number }
  | { action: "skip_duplicate"; idempotencyKey: string }
  | {
      action: "enqueue";
      idempotencyKey: string;
      scheduledForIso: string;
      periodKey: string;
    };

/**
 * Decisão pura para o tick diário: o INSERT com `ON CONFLICT DO NOTHING`
 * continua a ser feito na DB; aqui apenas calculamos chave e instante.
 *
 * AC5/AC7: o caller deve passar `existingKeys` com todas as chaves já
 * reservadas para esse `YYYY-MM` (qualquer estado), para não voltar a
 * enfileirar ao mudar `monthly_run_day` no mesmo mês.
 */
export function decideMonthlyScheduledEnqueue(input: {
  now: Date;
  companyId: string;
  monthlyRunDay: number;
  active: boolean;
  /** Chaves `sched_monthly:…` já existentes para esta empresa (mês actual incluído). */
  existingKeys: ReadonlySet<string>;
}): MonthlyEnqueueDecision {
  if (!input.active) {
    return { action: "skip_inactive" };
  }
  const w = zonedPartsFromInstant(input.now);
  const daySp = w.day;
  if (daySp !== input.monthlyRunDay) {
    return {
      action: "skip_not_target_day",
      daySp,
      monthlyRunDay: input.monthlyRunDay,
    };
  }
  const periodKey = `${w.year}-${String(w.month).padStart(2, "0")}`;
  const idempotencyKey = buildSchedMonthlyIdempotencyKey(input.companyId, periodKey);
  if (input.existingKeys.has(idempotencyKey)) {
    return { action: "skip_duplicate", idempotencyKey };
  }
  return {
    action: "enqueue",
    idempotencyKey,
    periodKey,
    scheduledForIso: scheduledForSixAmSpIso(w.year, w.month, w.day),
  };
}
