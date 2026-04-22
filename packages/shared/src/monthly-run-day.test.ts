import { describe, expect, it } from "vitest";
import {
  hydrateMonthlyRunDay,
  parseMonthlyRunDayFromRequest,
  clampMonthlyRunDay,
  messageFromMonthlyRunDayParse,
} from "./monthly-run-day";

describe("hydrateMonthlyRunDay", () => {
  it("omissão → 1", () => {
    expect(hydrateMonthlyRunDay(undefined)).toBe(1);
    expect(hydrateMonthlyRunDay(null)).toBe(1);
  });

  it("clamp 1–28", () => {
    expect(hydrateMonthlyRunDay(0)).toBe(1);
    expect(hydrateMonthlyRunDay(29)).toBe(28);
    expect(hydrateMonthlyRunDay(15)).toBe(15);
  });
});

describe("parseMonthlyRunDayFromRequest (API)", () => {
  it("0, 29 e string inválida → erro", () => {
    expect(parseMonthlyRunDayFromRequest(0).ok).toBe(false);
    expect(parseMonthlyRunDayFromRequest(29).ok).toBe(false);
    expect(parseMonthlyRunDayFromRequest("x").ok).toBe(false);
  });

  it("28 em fevereiro (valor) → ok", () => {
    const r = parseMonthlyRunDayFromRequest(28);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(28);
    }
  });

  it("omissão → 1", () => {
    const r = parseMonthlyRunDayFromRequest(undefined);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(1);
    }
  });
});

describe("clampMonthlyRunDay", () => {
  it("trunca para inteiro dentro do intervalo", () => {
    expect(clampMonthlyRunDay(3.9)).toBe(3);
  });
});

describe("messageFromMonthlyRunDayParse (UI / API 400)", () => {
  it("valor inválido → mensagem; válido → null", () => {
    expect(messageFromMonthlyRunDayParse(29)).toContain("28");
    expect(messageFromMonthlyRunDayParse(15)).toBeNull();
  });
});

describe("Persistência JSON (proxy AC5 AG-02 — sem DB)", () => {
  it("dia 28 sobrevive a JSON.stringify/parse como na coluna futura", () => {
    const persisted = { tradeName: "Acme", monthlyRunDay: 28 };
    const wire = JSON.parse(JSON.stringify(persisted)) as { monthlyRunDay?: unknown };
    expect(hydrateMonthlyRunDay(wire.monthlyRunDay)).toBe(28);
    const again = parseMonthlyRunDayFromRequest(wire.monthlyRunDay);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value).toBe(28);
    }
  });
});
