# ADN — activação em *staging* (MVP)

## 1. Migrações

Aplicar na base do **mesmo** projecto que `DATABASE_URL`, por ordem lexicográfica dos ficheiros em `db/migrations/`:

```bash
# Na raiz do monorepo (requer DATABASE_URL e cliente postgres via pnpm)
pnpm db:apply-migrations
```

Lista completa (13 ficheiros à data de 2026-05-28):

| Ficheiro | Notas |
|----------|--------|
| `20260422120000_companies_monthly_run_day.sql` | `companies`, `monthly_run_day` |
| `20260423120000_ler_auth_multitenant.sql` | Better Auth, memberships, audit |
| `20260424103000_org_01_multitenant_ddl.sql` | `organizations` |
| `20260424103100_org_02_multitenant_backfill.sql` | Backfill (irreversível após NOT NULL) |
| `20260425103000_adn_01_ddl.sql` | Fila ADN, artefactos |
| `20260426120000_company_certificate_ddl.sql` | Certificados |
| `20260426140000_company_certificate_rls.sql` | RLS deny anon/authenticated |
| `20260427120000_org_local_download_root.sql` | Espelho Windows |
| `20260427140000_organizations_tax_id_digits_unique_partial.sql` | Unicidade CNPJ org |
| `20260430120000_adn_sync_jobs_monthly_idempotency.sql` | Idempotência mensal |
| `20260528120000_adn_system_audit_user.sql` | Utilizador técnico scheduler |
| `20260528120100_adn_worker_role_grants.sql` | Role `adn_worker` |
| `20260528130000_schema_migrations_registry.sql` | Tabela `schema_migrations` |

**Base já migrada manualmente (sem `schema_migrations`):** executar uma vez `node scripts/apply-migrations.mjs --baseline` com `DATABASE_URL` definido, depois `pnpm db:apply-migrations` para migrações novas.

**Worker espelho (LM-02):** após migração e `GET`/`PATCH` em `…/adn-sync-settings`, o `poll_jobs.py` lê `organizations.local_download_root`. `NFSE_LOCAL_MIRROR_DISABLED=1` desactiva cópia local sem falhar o job.

**Testes integração (LM-01B):** com Postgres acessível: `cd frontend && pnpm exec vitest run src/app/api/v1/organization-adn-sync-settings.integration.test.ts` (requer `DATABASE_URL`).

## 2. Variáveis

Ver `.env.example` (secção ADN). Obrigatório para *worker* e rotas internas:

- `ADN_WORKER_HMAC_SECRET` — segredo partilhado portal ↔ VM.
- `API_INTERNAL_URL` ou `PORTAL_INTERNAL_URL` — URL HTTPS do portal acessível ao worker.
- `SUPABASE_SERVICE_ROLE_KEY` — **apenas no servidor Next** (portal/backend), não no worker após adoptar fetch-vault-envelope.
- `NEXT_PUBLIC_SUPABASE_URL` — já existente (FR1).
- `ADN_STORAGE_BUCKET` — bucket privado para artefactos NFS-e.

**Worker — cofre de certificado:** por defeito o worker chama `POST /api/internal/v1/adn/certificates/fetch-vault-envelope` (HMAC). Não definir `SUPABASE_SERVICE_ROLE_KEY` no worker. Legado: `ADN_CERT_VAULT_DIRECT_STORAGE=1` se ainda precisar de leitura directa ao Storage.

## 3. Activar a funcionalidade por organização

```sql
UPDATE organizations
SET adn_sync_enabled = true
WHERE id = '<uuid-da-org-de-teste>';
```

**Checklist:** confirmar ambiente de *staging*; não versionar UUIDs reais em docs.

## 4. Exemplo HMAC (corpo *raw* UTF-8)

Alinhado a `docs/stories/incremento-integracao-nfse-dist-adn.md` **ADN-03 AC2**:

1. Corpo JSON exactamente como enviado (sem reformatar).
2. `X-ADN-Timestamp` = segundos Unix UTC (string decimal).
3. `X-ADN-Signature` = hex minúsculo de `HMAC_SHA256(secret, rawBody)`.

Node (substituir `SECRET` e o JSON):

```bash
node -e "const c=require('crypto');const body=JSON.stringify({organizationId:'...',companyId:'...',accessKey:'0'.repeat(44),sha256:'a'.repeat(64),contentType:'application/xml'});const ts=String(Math.floor(Date.now()/1000));const sig=c.createHmac('sha256',process.env.ADN_WORKER_HMAC_SECRET).update(Buffer.from(body,'utf8')).digest('hex');console.log('X-ADN-Timestamp:',ts);console.log('X-ADN-Signature:',sig);console.log(body);"
```

Enviar `POST /api/internal/v1/adn/uploads/prepare` com esse corpo e cabeçalhos.

## 5. Ordem worker (*happy path*)

1. `uploads:prepare` → URL PUT assinada.  
2. `PUT` bytes no Storage.  
3. `artifacts:commit` com `artifactDraftId`.  
4. Certificado (se activo): `certificates/fetch-vault-envelope` → materialização local.  
5. Espelho local quando `local_download_root` preenchido e `NFSE_LOCAL_MIRROR_DISABLED` ≠ `1`.  
6. `PATCH /api/internal/v1/adn/jobs/:jobId` para estado / resumo.

## 6. 429 no ADN nacional

Se o worker reportar *rate limit* ao ADN, reduzir paralelismo no **NFSE_dist** antes de subir réplicas do portal.

## 7. Auditoria de segurança

Ver `docs/qa/security-audit-adn-2026-05.md`.
