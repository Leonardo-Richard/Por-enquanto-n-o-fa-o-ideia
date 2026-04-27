import { describe, expect, it } from "vitest";
import { isSuperadminOrganizationsNavVisible } from "./dashboard-shell-fr100";

describe("FR100 — nav «Organizações» só para superadmin", () => {
  it("não-superadmin: ligação não deve ser mostrada (regra)", () => {
    expect(isSuperadminOrganizationsNavVisible(false)).toBe(false);
  });

  it("superadmin: ligação deve ser mostrada (regra)", () => {
    expect(isSuperadminOrganizationsNavVisible(true)).toBe(true);
  });
});
