-- UP: LER-01/02 — Better Auth (tabelas user/session/account/verification), memberships, auditoria, sessão.activeCompanyId, companies.account_id.
-- Rollback (1 linha): DROP TABLE IF EXISTS audit_events, company_memberships CASCADE; DROP TABLE IF EXISTS session, account, verification CASCADE; ALTER TABLE companies DROP COLUMN IF EXISTS account_id; ALTER TABLE "user" DROP COLUMN IF EXISTS "isSuperadmin"; DROP TABLE IF EXISTS "user" CASCADE; DROP TYPE IF EXISTS company_role;

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "isSuperadmin" BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "activeCompanyId" UUID REFERENCES companies (id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES "user" ("id") ON DELETE SET NULL;

DO $$ BEGIN
  CREATE TYPE company_role AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS company_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  company_role company_role NOT NULL,
  job_title TEXT,
  department TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_memberships_user_company_unique UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS company_memberships_company_id_idx ON company_memberships (company_id);
CREATE INDEX IF NOT EXISTS company_memberships_user_id_idx ON company_memberships (user_id);
CREATE INDEX IF NOT EXISTS company_memberships_company_role_idx ON company_memberships (company_id, company_role);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  target_user_id TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
  company_id UUID REFERENCES companies (id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_events_company_occurred_idx ON audit_events (company_id, occurred_at);
CREATE INDEX IF NOT EXISTS audit_events_actor_occurred_idx ON audit_events (actor_user_id, occurred_at);
