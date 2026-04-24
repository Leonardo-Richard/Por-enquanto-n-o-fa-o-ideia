-- UP: UBR-03 — metadados de certificado ADN (sem PFX) + auditoria de eventos.
-- Rollback (manual): DROP TABLE IF EXISTS company_certificate_audits CASCADE; DROP TABLE IF EXISTS company_certificates CASCADE;

CREATE TABLE IF NOT EXISTS company_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending_validation', 'active', 'revoked')),
  not_after DATE NULL,
  vault_ref TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id TEXT NULL REFERENCES "user" (id) ON DELETE SET NULL,
  CONSTRAINT company_certificates_company_unique UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS company_certificates_org_company_idx
  ON company_certificates (organization_id, company_id);

CREATE TABLE IF NOT EXISTS company_certificate_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  error_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_certificate_audits_company_created_idx
  ON company_certificate_audits (company_id, created_at DESC);
