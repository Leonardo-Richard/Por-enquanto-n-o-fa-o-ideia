# CI — reprodução local e jobs MSYS-01 / MSYS-02

## Pré-requisitos

- Node 22, pnpm 9, Postgres 16 (ou serviço Docker equivalente).
- Variáveis: `DATABASE_URL` apontando para a base após aplicar `db/migrations/*.sql` em ordem.
- Para E2E: `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` coerentes com o servidor Next em `127.0.0.1:3000`.

## Job `quality` (stack completa)

O passo **Unit and integration tests** executa:

- `frontend`: Vitest **sem** `organizations-create.integration.test.ts` (evita duplicar o gate `integration-superadmin`).
- `@repo/shared` e `@repo/scheduling`: Vitest dos pacotes.

## Job `integration-superadmin` (MSYS-01)

Equivalente local:

```bash
pnpm install --frozen-lockfile
# aplicar migrações SQL como no workflow CI
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
pnpm --filter frontend test:integration-superadmin
```

O Vitest executa `organizations-create.integration.test.ts`, cobrindo **201, 400, 401, 403, 409** em `POST /api/v1/organizations`.

## Job `e2e-superadmin-smoke` (MSYS-02)

```bash
pnpm --filter frontend build
cd frontend && pnpm exec playwright install chromium --with-deps
# arranque o Next (ex.: pnpm start) em 3000 com env de teste, depois:
PLAYWRIGHT_LER_SMOKE=1 PLAYWRIGHT_SUPERADMIN_ORG_SMOKE=1 pnpm exec playwright test e2e/ler-smoke.spec.ts e2e/superadmin-organizacoes-smoke.spec.ts
```

Relatórios HTML: `frontend/playwright-report/` (artefactos uploadados no CI em falha ou sempre conforme workflow).

## Branch protection

No GitHub: definir checks obrigatórios **`integration-superadmin`** e **`e2e-superadmin-smoke`** (e os restantes acordados pela equipa) na branch alvo. Evidência para PR: captura das regras *Required* com estes nomes de job.
