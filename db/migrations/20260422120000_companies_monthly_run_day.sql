-- UP: dia civil da coleta mensal (1–28) por empresa (FR10 / AG-02).
-- Rollback (1 linha): DROP CONSTRAINT companies_monthly_run_day_range; ALTER TABLE companies DROP COLUMN monthly_run_day;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS monthly_run_day SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_monthly_run_day_range;

ALTER TABLE companies
  ADD CONSTRAINT companies_monthly_run_day_range
  CHECK (monthly_run_day >= 1 AND monthly_run_day <= 28);
