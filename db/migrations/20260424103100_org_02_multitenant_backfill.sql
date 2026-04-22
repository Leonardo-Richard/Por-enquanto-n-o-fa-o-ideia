-- UP: ORG-02 — backfill idempotente + NOT NULL + unicidade por organização.
-- Regra normativa: docs/stories/incremento-dois-niveis-organizacao-vs-empresas-fiscais.md (secção «Regra de backfill vinculativa (MVP) — ORG-02»).
-- Rollback: não suportado de forma segura após NOT NULL (restaurar backup); ORG-01 rollback remove colunas antes desta migração.

DO $$
DECLARE
  aid TEXT;
  new_id UUID;
  nm TEXT;
  cmp_id UUID;
BEGIN
  -- Grupo A — account_id não nulo: uma organization por account_id distinto
  FOR aid IN
    SELECT DISTINCT c.account_id
    FROM companies c
    WHERE c.account_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM companies c2
        WHERE c2.account_id = c.account_id AND c2.organization_id IS NULL
      )
  LOOP
    SELECT organization_id INTO new_id
    FROM companies
    WHERE account_id = aid AND organization_id IS NOT NULL
    LIMIT 1;

    IF new_id IS NOT NULL THEN
      UPDATE companies SET organization_id = new_id
      WHERE account_id = aid AND organization_id IS NULL;
      CONTINUE;
    END IF;

    SELECT trade_name, id INTO nm, cmp_id
    FROM companies
    WHERE account_id = aid
    ORDER BY created_at ASC
    LIMIT 1;

    INSERT INTO organizations (id, name, trade_name, active, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      COALESCE(NULLIF(trim(nm), ''), 'Organização ' || substring(cmp_id::text, 1, 8)),
      NULLIF(trim(nm), ''),
      true,
      now(),
      now()
    )
    RETURNING id INTO new_id;

    UPDATE companies SET organization_id = new_id
    WHERE account_id = aid AND organization_id IS NULL;
  END LOOP;

  -- Grupo B — account_id nulo: uma organization dedicada por linha companies
  FOR cmp_id IN
    SELECT id FROM companies WHERE account_id IS NULL AND organization_id IS NULL
  LOOP
    SELECT trade_name INTO nm FROM companies WHERE id = cmp_id;
    INSERT INTO organizations (id, name, trade_name, active, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      COALESCE(NULLIF(trim(nm), ''), 'Organização ' || substring(cmp_id::text, 1, 8)),
      NULLIF(trim(nm), ''),
      true,
      now(),
      now()
    )
    RETURNING id INTO new_id;
    UPDATE companies SET organization_id = new_id WHERE id = cmp_id;
  END LOOP;
END $$;

INSERT INTO organization_memberships (
  id,
  organization_id,
  user_id,
  org_role,
  job_title,
  department,
  phone,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  c.organization_id,
  cm.user_id,
  cm.company_role,
  cm.job_title,
  cm.department,
  cm.phone,
  cm.created_at,
  cm.updated_at
FROM company_memberships cm
INNER JOIN companies c ON c.id = cm.company_id
WHERE c.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO UPDATE SET
  org_role = CASE
    WHEN EXCLUDED.org_role = 'admin'::company_role OR organization_memberships.org_role = 'admin'::company_role
    THEN 'admin'::company_role
    ELSE EXCLUDED.org_role
  END,
  updated_at = now();

UPDATE session s
SET "activeOrganizationId" = c.organization_id
FROM companies c
WHERE s."activeCompanyId" IS NOT NULL
  AND s."activeCompanyId" = c.id
  AND c.organization_id IS NOT NULL;

UPDATE audit_events a
SET organization_id = c.organization_id
FROM companies c
WHERE a.company_id IS NOT NULL
  AND a.company_id = c.id
  AND c.organization_id IS NOT NULL
  AND a.organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'organization_id'
  ) THEN
    EXECUTE $j$
      UPDATE jobs j
      SET organization_id = c.organization_id
      FROM companies c
      WHERE j.company_id = c.id
        AND c.organization_id IS NOT NULL
        AND j.organization_id IS DISTINCT FROM c.organization_id
    $j$;
  END IF;
END $$;

ALTER TABLE companies ALTER COLUMN organization_id SET NOT NULL;

DROP INDEX IF EXISTS companies_org_cnpj_system_unique;

CREATE UNIQUE INDEX companies_org_cnpj_system_unique
  ON companies (organization_id, cnpj_digits, system_code);
