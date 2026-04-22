-- UP: ADN-01 — flag org, jobs, rascunhos de artefacto, artefactos, falhas de ingestão.
-- Rollback (manual): DROP TABLE IF EXISTS adn_ingestion_failures CASCADE; DROP TABLE IF EXISTS adn_artifacts CASCADE; DROP TABLE IF EXISTS adn_artifact_drafts CASCADE; DROP TABLE IF EXISTS adn_sync_jobs CASCADE; ALTER TABLE organizations DROP COLUMN IF EXISTS adn_sync_enabled;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS adn_sync_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS adn_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed')),
  trigger TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger IN ('manual', 'scheduled', 'retry', 'worker')),
  requested_by_user_id TEXT NULL REFERENCES "user" (id) ON DELETE SET NULL,
  idempotency_key TEXT NULL,
  idempotency_body_fingerprint CHAR(64) NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  summary_json JSONB NULL,
  worker_correlation_id TEXT NULL,
  http_429_count INT NOT NULL DEFAULT 0,
  http_503_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adn_sync_jobs_org_company_created_idx
  ON adn_sync_jobs (organization_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS adn_sync_jobs_org_status_idx
  ON adn_sync_jobs (organization_id, status);

CREATE TABLE IF NOT EXISTS adn_artifact_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  access_key CHAR(44) NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('xml', 'pdf')),
  content_sha256 CHAR(64) NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_object_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS adn_artifact_drafts_expires_idx ON adn_artifact_drafts (expires_at);

CREATE TABLE IF NOT EXISTS adn_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  adn_sync_job_id UUID NULL REFERENCES adn_sync_jobs (id) ON DELETE SET NULL,
  access_key CHAR(44) NOT NULL,
  access_key_prefix TEXT NULL,
  access_key_suffix TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('xml', 'pdf')),
  content_sha256 CHAR(64) NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_object_key TEXT NOT NULL,
  content_type TEXT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  byte_size BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT adn_artifacts_company_access_kind UNIQUE (company_id, access_key, kind)
);

CREATE INDEX IF NOT EXISTS adn_artifacts_org_company_issued_idx
  ON adn_artifacts (organization_id, company_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS adn_ingestion_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  adn_sync_job_id UUID NULL REFERENCES adn_sync_jobs (id) ON DELETE SET NULL,
  access_key CHAR(44) NULL,
  kind TEXT NULL CHECK (kind IS NULL OR kind IN ('xml', 'pdf')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_code TEXT NOT NULL,
  error_detail TEXT NULL,
  can_retry BOOLEAN NOT NULL DEFAULT true,
  resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS adn_ingestion_failures_org_company_open_idx
  ON adn_ingestion_failures (organization_id, company_id, resolved_at)
  WHERE resolved_at IS NULL;
