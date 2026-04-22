import { describe, expect, it } from "vitest";

/** Espelha a regra: não pode ficar 0 admins. */
function wouldViolateLastAdmin(
  adminCount: number,
  targetIsAdmin: boolean,
  action: "demote" | "remove",
): boolean {
  if (!targetIsAdmin) {
    return false;
  }
  if (adminCount <= 1) {
    return action === "demote" || action === "remove";
  }
  return false;
}

describe("último admin", () => {
  it("bloqueia rebaixar único admin", () => {
    expect(wouldViolateLastAdmin(1, true, "demote")).toBe(true);
  });
  it("bloqueia remover único admin", () => {
    expect(wouldViolateLastAdmin(1, true, "remove")).toBe(true);
  });
  it("permite remover um admin quando há outro", () => {
    expect(wouldViolateLastAdmin(2, true, "remove")).toBe(false);
  });
  it("permite rebaixar user não-admin", () => {
    expect(wouldViolateLastAdmin(1, false, "demote")).toBe(false);
  });
});
