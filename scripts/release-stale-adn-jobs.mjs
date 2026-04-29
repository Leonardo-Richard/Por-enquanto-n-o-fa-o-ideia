/**
 * Marca como `failed` jobs ADN em `running` há mais de N horas (órfãos de worker).
 * Uso: `npm run fix:adn-stale-jobs` ou `ADN_STALE_JOB_HOURS=48 npm run fix:adn-stale-jobs` (mais conservador).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseStaleRunningJobs } from "./lib/adn-release-stale-running.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hours = Math.max(1, Number(process.env.ADN_STALE_JOB_HOURS || "24"));
const result = await releaseStaleRunningJobs(root, hours);

if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}

if (result.count === 0) {
  console.log(`Nenhum job running com started_at anterior a ${result.cutoff} (${result.hours}h).`);
} else {
  console.log(`Marcados como failed (${result.count}):`);
  console.log(JSON.stringify(result.released, null, 2));
}
