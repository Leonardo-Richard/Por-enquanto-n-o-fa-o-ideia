import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/server/api/v1/lib/session", () => ({
  getAuthedSession: vi.fn(),
}));

import { getAuthedSession } from "@/server/api/v1/lib/session";
import { isAuthedSession, requireAuthedSession, requireSuperadminSession } from "./require-session";

describe("require-session", () => {
  it("requireAuthedSession devolve 401 quando não há sessão", async () => {
    vi.mocked(getAuthedSession).mockResolvedValueOnce(null);
    const out = await requireAuthedSession(new Request("http://test/"));
    expect(out).toBeInstanceOf(NextResponse);
    expect((out as NextResponse).status).toBe(401);
  });

  it("requireSuperadminSession devolve 403 para utilizador normal", async () => {
    vi.mocked(getAuthedSession).mockResolvedValueOnce({
      user: { id: "u1", isSuperadmin: false },
      session: { id: "s1" },
    } as never);
    const out = await requireSuperadminSession(new Request("http://test/"));
    expect(out).toBeInstanceOf(NextResponse);
    expect((out as NextResponse).status).toBe(403);
  });

  it("isAuthedSession distingue sessão de NextResponse", async () => {
    vi.mocked(getAuthedSession).mockResolvedValueOnce({
      user: { id: "u1", isSuperadmin: true },
      session: { id: "s1" },
    } as never);
    const out = await requireSuperadminSession(new Request("http://test/"));
    expect(isAuthedSession(out)).toBe(true);
  });
});
