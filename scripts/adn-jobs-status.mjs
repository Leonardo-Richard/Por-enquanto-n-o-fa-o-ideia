/**
 * Estado dos jobs ADN na base (Postgres).
 *
 * Uso:
 *   npm run status:adn-jobs
 *   npm run status:adn-jobs -- 65805583000173
 *
 * O primeiro argumento opcional é o CNPJ (só dígitos) para listar os últimos jobs dessa empresa.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMergedMonorepoDotenv } from "./lib/merge-monorepo-dotenv.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromFrontend = createRequire(join(root, "frontend", "package.json"));
let postgres;
try {
  postgres = requireFromFrontend("postgres");
} catch {
  console.error("Instale dependências na raiz: npm install");
  process.exit(1);
}

const merged = loadMergedMonorepoDotenv(root);
const url = merged.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL em falta após merge .env");
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const cnpjArg = args.find((a) => /^\d{11,14}$/.test(a.replace(/\D/g, "")));
const cnpj = cnpjArg ? cnpjArg.replace(/\D/g, "") : null;

const sql = postgres(url, { max: 1 });
try {
  const contagens7d = await sql`
    SELECT status, count(*)::int AS n
    FROM adn_sync_jobs
    WHERE created_at > now() - interval '7 days'
    GROUP BY status
    ORDER BY status
  `;

  const jobsRunningGlobal = await sql`
    SELECT j.id::text, j.status, j.created_at::text, j.updated_at::text, j.started_at::text,
           c.cnpj_digits::text AS cnpj
    FROM adn_sync_jobs j
    INNER JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'running'
    ORDER BY j.updated_at DESC NULLS LAST
    LIMIT 25
  `;

  const ultimosNaBase = await sql`
    SELECT j.id::text, j.status, j.created_at::text, c.cnpj_digits::text AS cnpj,
           left(j.summary_json::text, 160) AS summary_preview
    FROM adn_sync_jobs j
    INNER JOIN companies c ON c.id = j.company_id
    ORDER BY j.created_at DESC
    LIMIT 12
  `;

  const out = {
    consulta: new Date().toISOString(),
    filtroCnpj: cnpj,
    contagensUltimos7Dias: contagens7d,
    jobsEmRunning: jobsRunningGlobal,
    ultimosJobsCriados: ultimosNaBase,
  };

  if (cnpj) {
    out.ultimosJobsEmpresa = await sql`
      SELECT j.id::text, j.status, j.created_at::text, j.updated_at::text, j.started_at::text, j.completed_at::text,
             left(j.summary_json::text, 220) AS summary_preview
      FROM adn_sync_jobs j
      INNER JOIN companies c ON c.id = j.company_id
      WHERE c.cnpj_digits = ${cnpj}
      ORDER BY j.created_at DESC
      LIMIT 10
    `;
  }

  console.log(JSON.stringify(out, null, 2));
} finally {
  await sql.end();
}
