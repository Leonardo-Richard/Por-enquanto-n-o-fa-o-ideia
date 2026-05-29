-- UP: tipos enum para adn_sync_jobs.status e adn_sync_jobs.trigger (alinha Drizzle pgEnum).
-- DOWN (manual):
--   ALTER TABLE adn_sync_jobs ALTER COLUMN status TYPE TEXT USING status::text;
--   ALTER TABLE adn_sync_jobs ALTER COLUMN trigger TYPE TEXT USING trigger::text;
--   ALTER TABLE adn_sync_jobs ADD CONSTRAINT adn_sync_jobs_status_check
--     CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed'));
--   ALTER TABLE adn_sync_jobs ADD CONSTRAINT adn_sync_jobs_trigger_check
--     CHECK (trigger IN ('manual', 'scheduled', 'retry', 'worker', 'monthly'));
--   DROP TYPE IF EXISTS adn_sync_job_status;
--   DROP TYPE IF EXISTS adn_sync_job_trigger;

DO $$ BEGIN
  CREATE TYPE adn_sync_job_status AS ENUM (
    'queued', 'running', 'completed', 'partial', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE adn_sync_job_trigger AS ENUM (
    'manual', 'scheduled', 'retry', 'worker', 'monthly'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE adn_sync_jobs DROP CONSTRAINT IF EXISTS adn_sync_jobs_status_check;
ALTER TABLE adn_sync_jobs DROP CONSTRAINT IF EXISTS adn_sync_jobs_trigger_check;
ALTER TABLE adn_sync_jobs DROP CONSTRAINT IF EXISTS adn_sync_jobs_trigger_check1;

ALTER TABLE adn_sync_jobs
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN trigger DROP DEFAULT;

ALTER TABLE adn_sync_jobs
  ALTER COLUMN status TYPE adn_sync_job_status USING status::adn_sync_job_status,
  ALTER COLUMN trigger TYPE adn_sync_job_trigger USING trigger::adn_sync_job_trigger;

ALTER TABLE adn_sync_jobs
  ALTER COLUMN status SET DEFAULT 'queued',
  ALTER COLUMN trigger SET DEFAULT 'manual';
