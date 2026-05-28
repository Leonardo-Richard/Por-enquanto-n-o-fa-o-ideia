-- Role de menor privilégio para o worker ADN (ver docs/runbooks/adn-worker-postgres-least-privilege.md).
-- Aplicar manualmente em produção com password forte; em CI/dev pode falhar se role já existir — ignorar nesse caso.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'adn_worker') THEN
    CREATE ROLE adn_worker NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO adn_worker;
GRANT SELECT, UPDATE ON TABLE public.adn_sync_jobs TO adn_worker;
GRANT SELECT ON TABLE public.organizations TO adn_worker;
GRANT SELECT ON TABLE public.companies TO adn_worker;
GRANT SELECT ON TABLE public.company_certificates TO adn_worker;
GRANT SELECT ON TABLE public.adn_artifacts TO adn_worker;
