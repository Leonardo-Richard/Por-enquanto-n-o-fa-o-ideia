/**
 * Marca como `failed` jobs ADN em `running` com started_at anterior ao corte (órfãos).
 * @param {string} repoRoot - raiz do monorepo
 * @param {number} hours - idade mínima em horas (mínimo 1)
 * @returns {Promise<{ ok: true, hours: number, cutoff: string, released: unknown[], count: number } | { ok: false, error: string, released: [] }>}
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { loadMergedMonorepoDotenv } from "./merge-monorepo-dotenv.mjs";

export async function releaseStaleRunningJobs(repoRoot, hours) {
  const requireFromFrontend = createRequire(join(repoRoot, "frontend", "package.json"));
  let postgres;
  try {
    postgres = requireFromFrontend("postgres");
  } catch {
    return { ok: false, error: "postgres não instalado (npm install na raiz)", released: [] };
  }

  const merged = loadMergedMonorepoDotenv(repoRoot);
  const url = merged.DATABASE_URL?.trim();
  if (!url) {
    return { ok: false, error: "DATABASE_URL em falta", released: [] };
  }

  const h = Math.max(1, Math.floor(Number(hours) || 24));
  const cutoff = new Date(Date.now() - h * 3600 * 1000).toISOString();
  const summary = {
    phase: "error",
    message: `Job libertado: estado running há mais de ${h}h sem conclusão (órfão de worker ou crash).`,
  };

  const sql = postgres(url, { max: 1 });
  try {
    const released = await sql.unsafe(
      `UPDATE adn_sync_jobs
       SET status = 'failed',
           completed_at = NOW(),
           updated_at = NOW(),
           summary_json = $1::jsonb
       WHERE status = 'running'
         AND completed_at IS NULL
         AND started_at IS NOT NULL
         AND started_at < $2::timestamptz
       RETURNING id::text, organization_id::text, started_at::text`,
      [JSON.stringify(summary), cutoff],
    );
    return {
      ok: true,
      hours: h,
      cutoff,
      released,
      count: released.length,
    };
  } finally {
    await sql.end();
  }
}
