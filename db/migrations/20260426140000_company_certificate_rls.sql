-- UP: UBR-03 / BR-NFR5 — RLS defesa em profundidade para acesso directo (ex.: PostgREST com role anon/authenticated).
-- O pool do portal usa normalmente um superutilizador ou *service_role* que em Postgres **ignora** RLS enquanto for dono da tabela (sem FORCE).
-- Políticas negam explicitamente anon/authenticated quando esses roles existem (Supabase).
-- Rollback (manual): DROP POLICY …; ALTER TABLE … DISABLE ROW LEVEL SECURITY;

ALTER TABLE company_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_certificate_audits ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    DROP POLICY IF EXISTS company_certificates_deny_authenticated ON company_certificates;
    CREATE POLICY company_certificates_deny_authenticated ON company_certificates
      FOR ALL TO authenticated
      USING (false)
      WITH CHECK (false);
    DROP POLICY IF EXISTS company_certificate_audits_deny_authenticated ON company_certificate_audits;
    CREATE POLICY company_certificate_audits_deny_authenticated ON company_certificate_audits
      FOR ALL TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    DROP POLICY IF EXISTS company_certificates_deny_anon ON company_certificates;
    CREATE POLICY company_certificates_deny_anon ON company_certificates
      FOR ALL TO anon
      USING (false)
      WITH CHECK (false);
    DROP POLICY IF EXISTS company_certificate_audits_deny_anon ON company_certificate_audits;
    CREATE POLICY company_certificate_audits_deny_anon ON company_certificate_audits
      FOR ALL TO anon
      USING (false)
      WITH CHECK (false);
  END IF;
END
$rls$;
