-- UP: ORG-01 — organizations, organization_memberships, colunas nullable (organization_id, activeOrganizationId).
-- Rollback (1 linha): DROP TABLE IF EXISTS organization_memberships CASCADE; DROP TABLE IF EXISTS organizations CASCADE; ALTER TABLE companies DROP COLUMN IF EXISTS organization_id; ALTER TABLE audit_events DROP COLUMN IF EXISTS organization_id; ALTER TABLE session DROP COLUMN IF EXISTS "activeOrganizationId";

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trade_name TEXT,
  tax_id_digits CHAR(14),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_active_idx ON organizations (active);
CREATE INDEX IF NOT EXISTS organizations_name_idx ON organizations (name);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  org_role company_role NOT NULL,
  job_title TEXT,
  department TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_memberships_user_org_unique UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS organization_memberships_org_id_idx ON organization_memberships (organization_id);
CREATE INDEX IF NOT EXISTS organization_memberships_user_id_idx ON organization_memberships (user_id);

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS companies_organization_id_idx ON companies (organization_id);

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audit_events_organization_occurred_idx ON audit_events (organization_id, occurred_at);

ALTER TABLE session
  ADD COLUMN IF NOT EXISTS "activeOrganizationId" UUID REFERENCES organizations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS session_active_organization_idx ON session ("activeOrganizationId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'jobs'
  ) THEN
    EXECUTE 'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE';
    EXECUTE 'CREATE INDEX IF NOT EXISTS jobs_organization_id_idx ON jobs (organization_id)';
  END IF;
END $$;

-- company_memberships e session.activeCompanyId mantêm-se (deprecação em ORG-09).
