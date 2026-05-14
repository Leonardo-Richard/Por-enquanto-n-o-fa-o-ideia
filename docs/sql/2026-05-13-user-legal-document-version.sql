-- Migração LGPD: versão dos documentos legais aceites no registo ou marcador de provisão administrativa.
-- Executar na base Postgres (Supabase SQL editor, `psql`, etc.) antes ou imediatamente após deploy do código
-- que passa a persistir `legalDocumentVersion` via Better Auth.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "legalDocumentVersion" text;

COMMENT ON COLUMN "user"."legalDocumentVersion" IS
  'Versão dos documentos legais (registo público) ou marcador org-admin-provisioned-v1 / integration-test-v1.';
