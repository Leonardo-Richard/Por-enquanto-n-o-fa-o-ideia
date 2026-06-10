import { describe, expect, it } from "vitest";
import {
  databaseUrlFromComponents,
  parseDatabaseUrlForDiagnostics,
  resolveDatabaseUrlFromEnv,
} from "./resolve-database-url";

describe("resolveDatabaseUrlFromEnv", () => {
  it("prefere PORTAL_DATABASE_URL sobre DATABASE_URL", () => {
    const resolved = resolveDatabaseUrlFromEnv({
      PORTAL_DATABASE_URL: "postgresql://a:b@host:5432/postgres",
      DATABASE_URL: "postgresql://c:d@other:5432/postgres",
    });
    expect(resolved?.source).toBe("PORTAL_DATABASE_URL");
    expect(resolved?.url).toContain("@host:5432");
  });

  it("prefere SUPABASE_DB_* sobre DATABASE_URL injectada pelo painel", () => {
    const resolved = resolveDatabaseUrlFromEnv({
      DATABASE_URL: "postgresql://postgres:wrong@internal-postgres:5432/postgres",
      NEXT_PUBLIC_SUPABASE_URL: "https://abc123.supabase.co",
      SUPABASE_DB_PASSWORD: "real-password",
      SUPABASE_DB_HOST: "aws-1-sa-east-1.pooler.supabase.com",
    });
    expect(resolved?.source).toBe("SUPABASE_DB_COMPONENTS");
    expect(resolved?.url).toContain("aws-1-sa-east-1.pooler.supabase.com");
    expect(resolved?.url).not.toContain("internal-postgres");
  });

  it("monta URI a partir de SUPABASE_DB_* quando não há DATABASE_URL", () => {
    const resolved = resolveDatabaseUrlFromEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc123.supabase.co",
      SUPABASE_DB_PASSWORD: "p@ss:word",
      SUPABASE_DB_HOST: "aws-1-sa-east-1.pooler.supabase.com",
      SUPABASE_DB_PORT: "6543",
      SUPABASE_DB_POOLER: "transaction",
    });
    expect(resolved?.source).toBe("SUPABASE_DB_COMPONENTS");
    expect(resolved?.url).toContain("aws-1-sa-east-1.pooler.supabase.com:6543");
    expect(resolved?.url).toContain(encodeURIComponent("p@ss:word"));
    expect(resolved?.url).toContain("pgbouncer=true");
  });
});

describe("databaseUrlFromComponents", () => {
  it("requer password e host", () => {
    expect(databaseUrlFromComponents({ SUPABASE_DB_PASSWORD: "x" })).toBeUndefined();
    expect(
      databaseUrlFromComponents({
        SUPABASE_DB_PASSWORD: "x",
        SUPABASE_DB_HOST: "host",
        SUPABASE_DB_USER: "postgres.ref",
      }),
    ).toContain("postgres.ref");
  });
});

describe("parseDatabaseUrlForDiagnostics", () => {
  it("extrai host e user sem password", () => {
    const info = parseDatabaseUrlForDiagnostics(
      "postgresql://postgres.ref:secret@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
    );
    expect(info?.host).toBe("aws-1-sa-east-1.pooler.supabase.com");
    expect(info?.user).toBe("postgres.ref");
    expect(info?.port).toBe("5432");
  });
});
