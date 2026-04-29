/**
 * Marca **todos** os jobs ADN em `running` como `failed` (reset operacional).
 * Uso pontual: `npm run fix:adn-all-running`
 *
 * O worker só consome `queued`; jobs presos em `running` bloqueiam a percepção do estado no UI.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMergedMonorepoDotenv } from "./lib/merge-monorepo-dotenv.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromFrontend = createRequire(join(root, "frontend", "package.json"));
const postgres = requireFromFrontend("postgres");
const merged = loadMergedMonorepoDotenv(root);
const url = merged.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL em falta");
  process.exit(1);
}

const summary = {
  phase: "error",
  message:
    "Job marcado como failed (reset): estava em running sem conclusão — use «Buscar notas» para enfileirar novo job.",
};

const sql = postgres(url, { max: 1 });
try {
  const rows = await sql.unsafe(
    `UPDATE adn_sync_jobs
     SET status = 'failed',
         completed_at = NOW(),
         updated_at = NOW(),
         summary_json = $1::jsonb
     WHERE status = 'running'
       AND completed_at IS NULL
     RETURNING id::text, organization_id::text, started_at::text`,
    [JSON.stringify(summary)],
  );
  if (rows.length === 0) {
    console.log("Nenhum job em running.");
  } else {
    console.log(`Marcados como failed (${rows.length}):`);
    console.log(JSON.stringify(rows, null, 2));
  }
} finally {
  await sql.end();
}
