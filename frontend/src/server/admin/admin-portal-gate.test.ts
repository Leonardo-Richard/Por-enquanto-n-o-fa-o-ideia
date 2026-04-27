import { describe, expect, it } from "vitest";
import { resolveAdminPortalGateFromSession } from "./admin-portal-gate";

describe("resolveAdminPortalGateFromSession (SMEM-06)", () => {
  it("retorna login sem sessão", () => {
    expect(resolveAdminPortalGateFromSession(null)).toBe("login");
  });

  it("retorna dashboard quando autenticado sem superadmin", () => {
    expect(
      resolveAdminPortalGateFromSession({
        user: { id: "u1", email: "a@b", name: "A", isSuperadmin: false },
      }),
    ).toBe("dashboard");
  });

  it("retorna allow quando superadmin", () => {
    expect(
      resolveAdminPortalGateFromSession({
        user: { id: "u1", email: "a@b", name: "A", isSuperadmin: true },
      }),
    ).toBe("allow");
  });
});
