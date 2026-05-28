import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const migrationsDir = join(repoRoot, "db", "migrations");

/** Tabelas expostas no Drizzle que devem existir nas migrações SQL. */
const EXPECTED_TABLES = [
  "organizations",
  "companies",
  "company_certificates",
  "company_certificate_audits",
  "adn_sync_jobs",
  "adn_artifact_drafts",
  "adn_artifacts",
  "adn_ingestion_failures",
  "organization_memberships",
  "company_memberships",
  "audit_events",
  "user",
  "session",
  "account",
  "verification",
  "schema_migrations",
] as const;

describe("schema contract vs db/migrations", () => {
  it("exporta pgTable para entidades principais", () => {
    expect(schema.organizations).toBeDefined();
    expect(schema.companies).toBeDefined();
    expect(schema.companyCertificates).toBeDefined();
    expect(schema.adnSyncJobs).toBeDefined();
  });

  it("cada tabela esperada aparece em pelo menos um ficheiro SQL", () => {
    const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const combined = sqlFiles
      .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
      .join("\n")
      .toLowerCase();

    const patterns: Record<string, RegExp> = {
      user: /create table if not exists "user"/i,
    };

    for (const table of EXPECTED_TABLES) {
      const pattern = patterns[table] ?? new RegExp(`\\b${table}\\b`, "i");
      expect(combined, `tabela ${table} ausente em db/migrations`).toMatch(pattern);
    }
  });

  it("lista de migrações inclui registo schema_migrations", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    expect(files.some((f) => f.includes("schema_migrations"))).toBe(true);
  });
});
