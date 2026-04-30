import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/** Mock DB: fluxo sem candidatos ADN — não chama `insert`. Cobre evidência HTTP 200 (QA CM-02). */
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    }),
  })),
}));

describe("cron monthly-enqueue auth", () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-secret-value";
  });

  afterEach(() => {
    process.env.CRON_SECRET = prevSecret;
  });

  it("401 sem Bearer correcto", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/internal/v1/adn/cron/monthly-enqueue", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("500 quando CRON_SECRET não está definido", async () => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/internal/v1/adn/cron/monthly-enqueue"));
    expect(res.status).toBe(500);
    process.env.CRON_SECRET = "test-secret-value";
  });
});

describe("cron monthly-enqueue sucesso (mock DB, zero candidatos)", () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "cron-success-test-secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = prevSecret;
  });

  it("200 com ok, enqueued e skipped quando não há empresas ADN", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/internal/v1/adn/cron/monthly-enqueue", {
        headers: { Authorization: "Bearer cron-success-test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      enqueued: number;
      skipped: number;
      candidates: number;
      periodKey: string;
    };
    expect(body.ok).toBe(true);
    expect(body.candidates).toBe(0);
    expect(body.enqueued).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.periodKey).toMatch(/^\d{4}-\d{2}$/);
  });
});
