-- UP: CM-01 — `trigger` inclui `monthly`; unicidade de `idempotency_key` quando não nulo (jobs manuais sem chave mantêm múltiplas linhas).
-- Compatível com inserts em `frontend/src/server/api/v1/handlers/adn-sync.ts` (`manual`, `retry`, corpo + idempotency HTTP).
-- Rollback (manual):
--   DROP INDEX IF EXISTS adn_sync_jobs_idempotency_key_unique_partial;
--   ALTER TABLE adn_sync_jobs DROP CONSTRAINT IF EXISTS adn_sync_jobs_trigger_check;
--   ALTER TABLE adn_sync_jobs ADD CONSTRAINT adn_sync_jobs_trigger_check
--     CHECK (trigger IN ('manual', 'scheduled', 'retry', 'worker'));

ALTER TABLE adn_sync_jobs DROP CONSTRAINT IF EXISTS adn_sync_jobs_trigger_check;

ALTER TABLE adn_sync_jobs ADD CONSTRAINT adn_sync_jobs_trigger_check
  CHECK (trigger IN ('manual', 'scheduled', 'retry', 'worker', 'monthly'));

CREATE UNIQUE INDEX IF NOT EXISTS adn_sync_jobs_idempotency_key_unique_partial
  ON adn_sync_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
