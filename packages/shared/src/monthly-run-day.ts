/** Dia civil da coleta mensal (1–28). Alinhado a docs/architecture-agendamento-por-empresa.md. */

export const MONTHLY_RUN_DAY_MIN = 1 as const;
export const MONTHLY_RUN_DAY_MAX = 28 as const;

export function clampMonthlyRunDay(n: number): number {
  if (Number.isNaN(n) || n < MONTHLY_RUN_DAY_MIN) {
    return MONTHLY_RUN_DAY_MIN;
  }
  if (n > MONTHLY_RUN_DAY_MAX) {
    return MONTHLY_RUN_DAY_MAX;
  }
  return Math.trunc(n);
}

/** Hidrata valor persistido (JSON) ou campo opcional: omissão → 1. */
export function hydrateMonthlyRunDay(value: unknown): number {
  if (value === null || value === undefined) {
    return MONTHLY_RUN_DAY_MIN;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampMonthlyRunDay(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return clampMonthlyRunDay(n);
    }
  }
  return MONTHLY_RUN_DAY_MIN;
}

export type MonthlyRunDayParseResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

/**
 * Corpo JSON (POST/PATCH). Omissão → default 1.
 * `0`, `29`, strings não numéricas → erro (HTTP 400 no servidor).
 */
export function parseMonthlyRunDayFromRequest(value: unknown): MonthlyRunDayParseResult {
  if (value === undefined || value === null) {
    return { ok: true, value: MONTHLY_RUN_DAY_MIN };
  }
  if (typeof value === "string") {
    if (value.trim() === "") {
      return { ok: true, value: MONTHLY_RUN_DAY_MIN };
    }
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, message: "monthlyRunDay deve ser um inteiro entre 1 e 28." };
    }
    if (n < MONTHLY_RUN_DAY_MIN || n > MONTHLY_RUN_DAY_MAX) {
      return { ok: false, message: "monthlyRunDay deve estar entre 1 e 28." };
    }
    return { ok: true, value: n };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return { ok: false, message: "monthlyRunDay deve ser um inteiro entre 1 e 28." };
    }
    if (value < MONTHLY_RUN_DAY_MIN || value > MONTHLY_RUN_DAY_MAX) {
      return { ok: false, message: "monthlyRunDay deve estar entre 1 e 28." };
    }
    return { ok: true, value: value };
  }
  return { ok: false, message: "monthlyRunDay inválido." };
}

/** Mensagem para `role="alert"` / `fieldError`, ou `null` se o valor é aceite pela API. */
export function messageFromMonthlyRunDayParse(value: unknown): string | null {
  const r = parseMonthlyRunDayFromRequest(value);
  return r.ok ? null : r.message;
}
