import { describe, expect, it } from "vitest";
import {
  adnJobDetailLabel,
  adnJobStatusBadgeClass,
  adnJobStatusLabel,
  failureCategoryUserMessage,
  isAdnJobInProgress,
} from "./adn-executions-display";

describe("adn-executions-display", () => {
  it("adnJobStatusLabel mapeia estados ADN", () => {
    expect(adnJobStatusLabel("queued")).toBe("Na fila");
    expect(adnJobStatusLabel("running")).toBe("Em execução");
    expect(adnJobStatusLabel("failed")).toBe("Falhou");
    expect(adnJobStatusLabel("partial")).toBe("Parcial");
    expect(adnJobStatusLabel("completed")).toBe("Concluída");
  });

  it("isAdnJobInProgress", () => {
    expect(isAdnJobInProgress("queued")).toBe(true);
    expect(isAdnJobInProgress("running")).toBe(true);
    expect(isAdnJobInProgress("completed")).toBe(false);
  });

  it("adnJobDetailLabel — fila e falha amigável", () => {
    expect(adnJobDetailLabel({ status: "queued" })).toContain("worker");
    expect(
      adnJobDetailLabel({
        status: "failed",
        summary: { failureCategory: "session" },
      }),
    ).toMatch(/sessão/i);
  });

  it("failureCategoryUserMessage", () => {
    expect(failureCategoryUserMessage("portal")).toMatch(/portal/i);
    expect(failureCategoryUserMessage("")).toBeNull();
  });

  it("adnJobStatusBadgeClass inclui classes por estado", () => {
    expect(adnJobStatusBadgeClass("failed")).toContain("red");
    expect(adnJobStatusBadgeClass("queued")).toContain("amber");
    expect(adnJobStatusBadgeClass("completed")).toContain("emerald");
  });
});
