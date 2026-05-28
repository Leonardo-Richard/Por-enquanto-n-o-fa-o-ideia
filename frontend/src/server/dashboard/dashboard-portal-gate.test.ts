import { describe, expect, it } from "vitest";
import { resolveDashboardPortalGateFromSession } from "./dashboard-portal-gate";

describe("resolveDashboardPortalGateFromSession", () => {
  it("sem sessão → login", () => {
    expect(resolveDashboardPortalGateFromSession(null)).toBe("login");
  });

  it("com sessão → allow", () => {
    expect(resolveDashboardPortalGateFromSession({ user: { id: "u1" } })).toBe("allow");
  });
});
