#!/usr/bin/env node
/**
 * Aplica ficheiros SQL em db/migrations/ por ordem lexicográfica.
 * Regista versões em schema_migrations (ver 20260528130000_schema_migrations_registry.sql).
 *
 * Uso: DATABASE_URL=... node scripts/apply-migrations.mjs
 *      pnpm db:apply-migrations
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "db", "migrations");

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL é obrigatório.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function ensureRegistryTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function appliedVersions() {
  const rows = await sql`SELECT version FROM schema_migrations`;
  return new Set(rows.map((r) => r.version));
}

async function main() {
  await ensureRegistryTable();
  const done = await appliedVersions();
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (process.argv.includes("--baseline")) {
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      await sql`INSERT INTO schema_migrations (version) VALUES (${version}) ON CONFLICT DO NOTHING`;
    }
    console.log(`Baseline: ${files.length} versão(ões) registadas (sem executar SQL).`);
    await sql.end({ timeout: 5 });
    return;
  }

  let applied = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (done.has(version)) {
      console.log(`skip ${file}`);
      continue;
    }
    const fullPath = path.join(migrationsDir, file);
    const body = await readFile(fullPath, "utf8");
    console.log(`apply ${file}`);
    await sql.unsafe(body);
    await sql`INSERT INTO schema_migrations (version) VALUES (${version})`;
    applied += 1;
  }
  console.log(applied === 0 ? "Nenhuma migração pendente." : `Aplicadas ${applied} migração(ões).`);
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
