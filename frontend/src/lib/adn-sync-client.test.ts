import { describe, expect, it } from "vitest";
import {
  buildAdnSyncSyncUrl,
  interpretAdnSyncGetResponse,
  interpretAdnSyncPostResponse,
} from "./adn-sync-client";

describe("buildAdnSyncSyncUrl", () => {
  it("monta o path BFF com org e empresa", () => {
    expect(buildAdnSyncSyncUrl("org-1", "co-2")).toBe(
      "/api/v1/organizations/org-1/monitored-companies/co-2/adn/sync",
    );
  });
});

describe("interpretAdnSyncGetResponse", () => {
  it("200 → active com lastJob", async () => {
    const job = {
      id: "j1",
      status: "done",
      trigger: "manual",
      summary: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const r = new Response(JSON.stringify({ lastJob: job }), { status: 200 });
    const out = await interpretAdnSyncGetResponse(r);
    expect(out).toEqual({ kind: "active", lastJob: job });
  });

  it("200 → active sem lastJob", async () => {
    const r = new Response(JSON.stringify({ lastJob: null }), { status: 200 });
    const out = await interpretAdnSyncGetResponse(r);
    expect(out).toEqual({ kind: "active", lastJob: null });
  });

  it("404 → feature_off", async () => {
    const out = await interpretAdnSyncGetResponse(new Response(null, { status: 404 }));
    expect(out).toEqual({ kind: "feature_off" });
  });

  it("403 → forbidden", async () => {
    const out = await interpretAdnSyncGetResponse(new Response(null, { status: 403 }));
    expect(out).toEqual({ kind: "forbidden" });
  });

  it("500 → error", async () => {
    const out = await interpretAdnSyncGetResponse(new Response(null, { status: 500 }));
    expect(out).toEqual({ kind: "error" });
  });
});

describe("interpretAdnSyncPostResponse", () => {
  it("202 → accepted", async () => {
    const out = await interpretAdnSyncPostResponse(new Response(null, { status: 202 }));
    expect(out).toEqual({ kind: "accepted" });
  });

  it("403 → forbidden", async () => {
    const r = new Response(JSON.stringify({ message: "no" }), { status: 403 });
    const out = await interpretAdnSyncPostResponse(r);
    expect(out).toEqual({ kind: "forbidden", message: "no" });
  });

  it("429 → rate_limited com Retry-After", async () => {
    const r = new Response(JSON.stringify({ message: "busy" }), {
      status: 429,
      headers: { "Retry-After": "42" },
    });
    const out = await interpretAdnSyncPostResponse(r);
    expect(out.kind).toBe("rate_limited");
    if (out.kind === "rate_limited") {
      expect(out.retryAfter).toBe("42");
      expect(out.message).toContain("42");
      expect(out.message).toContain("busy");
    }
  });

  it("400 → other_error com fallback", async () => {
    const out = await interpretAdnSyncPostResponse(new Response(null, { status: 400 }));
    expect(out).toEqual({
      kind: "other_error",
      message: "Não foi possível pedir a sincronização.",
    });
  });
});
