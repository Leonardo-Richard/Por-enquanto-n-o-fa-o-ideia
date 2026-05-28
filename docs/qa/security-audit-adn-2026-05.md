# Security audit — ADN, cofre de certificados e Postgres (2026-05)

Auditoria alinhada à task AIOS `security-audit`, focada no incremento ADN e multitenant.

## Resumo executivo

| Área | Estado | Acção |
|------|--------|-------|
| RLS em certificados | OK para `anon`/`authenticated` | Manter; não expor PostgREST sem políticas adicionais |
| RLS em ADN/org | Não aplicada | Aceitável **se** acesso DB for só servidor; documentar decisão (§3) |
| Worker + cofre | Melhorado | API HMAC `fetch-vault-envelope`; evitar `SUPABASE_SERVICE_ROLE_KEY` no worker |
| Migrações | Melhorado | `pnpm db:apply-migrations` + `schema_migrations` |
| Proxy API interna | Melhorado | Allowlist de cabeçalhos em `internal-api-forward.ts` |

## 1. RLS e exposição Supabase

### Certificados (`company_certificates`, `company_certificate_audits`)

- Migração: `db/migrations/20260426140000_company_certificate_rls.sql`
- Políticas: deny total para roles `authenticated` e `anon` quando existirem.
- **Risco residual:** role Postgres `adn_worker` com `SELECT` em `company_certificates` lê `vault_ref`; conteúdo sensível deve ser obtido só via servidor (API HMAC), não Storage directo no worker.

### Demais tabelas (ADN, organizations, companies, auth)

- Sem políticas RLS nas migrações actuais.
- Modelo actual: autorização na aplicação (Drizzle + `authz.ts`).

### Checklist operacional (staging/prod)

1. Supabase Dashboard → **Database** → confirmar que API **anon** não tem grants indevidos em tabelas de negócio.
2. Se activar PostgREST público no futuro: adicionar RLS por `organization_id` **antes** de expor tabelas.
3. Role `adn_worker`: usar `ADN_WORKER_DATABASE_URL` com password dedicada (`docs/runbooks/adn-worker-postgres-least-privilege.md`).

## 2. Worker ADN e segredos

### Antes

- Worker descarregava PKCS#12 com `SUPABASE_SERVICE_ROLE_KEY` no host Windows/Docker.

### Depois (implementado)

- Rota interna: `POST /api/internal/v1/adn/certificates/fetch-vault-envelope` (HMAC, mesmo segredo que prepare/commit).
- Worker: `cert_materialization._download_vault_payload_bytes` usa API por defeito.
- Legado: `ADN_CERT_VAULT_DIRECT_STORAGE=1` + `SUPABASE_SERVICE_ROLE_KEY` apenas se necessário em transição.

### Variáveis obrigatórias no worker (recomendado)

- `ADN_WORKER_HMAC_SECRET`
- `API_INTERNAL_URL` ou `PORTAL_INTERNAL_URL` (HTTPS em produção)
- `ADN_WORKER_DATABASE_URL` (role `adn_worker`)

### Não recomendado no worker

- `SUPABASE_SERVICE_ROLE_KEY` (remover após validar fetch-vault-envelope em staging)

## 3. Decisão arquitectural — RLS vs app-layer

**Decisão (MVP):** Postgres acessível apenas pelo portal (Drizzle, `DATABASE_URL`) e pelo worker com role limitada. RLS obrigatória em certificados por exposição potencial via Supabase Auth roles; restante domínio protegido na camada de aplicação.

**Revisitar quando:** qualquer tabela de negócio for exposta via cliente Supabase (`@supabase/supabase-js` no browser com anon key).

## 4. API interna e rate limit

- HMAC: `frontend/src/lib/adn-hmac.ts` — `timingSafeEqual`, skew 5 min.
- Rate limit: `adn-rate-limit.ts` + Upstash opcional.
- Proxy: cabeçalhos reencaminhados limitados a `content-type`, `x-adn-timestamp`, `x-adn-signature`.

## 5. Seguimento

- [ ] Remover `SUPABASE_SERVICE_ROLE_KEY` dos ambientes de worker após smoke em staging
- [ ] Integração Vitest para `fetch-vault-envelope` com Postgres + mock vault (opcional)
- [ ] Políticas RLS ADN se PostgREST for activado
