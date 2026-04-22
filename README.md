# Portal de Automação de Notas Fiscais

Monorepo **Turborepo** + **pnpm** conforme `docs/architecture.md` (Story P01).

## Pré-requisitos

- Node.js **22** LTS (ou compatível com o campo `packageManager` em `package.json`)
- [pnpm](https://pnpm.io/) 9.x (pode usar [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`)

## Instalação

Na raiz do repositório:

```bash
pnpm install
```

## Comandos

| Comando            | Descrição                          |
| ------------------ | ---------------------------------- |
| `pnpm dev`         | Dev server (Next.js em `apps/web`) |
| `pnpm build`       | Build de todos os pacotes (Turbo)  |
| `pnpm lint`        | ESLint (app web)                   |
| `pnpm typecheck`   | `tsc --noEmit` nos pacotes TS      |

## Health check

Com o dev server a correr (`pnpm dev`), o endpoint público responde em:

- `GET http://localhost:3000/api/health` → `{ "status": "ok", "app": "portal-automacao-nf" }` (liveness — **sem** consulta à base)

### Readiness (Postgres)

- `GET http://localhost:3000/api/health/ready` — verificação `select 1` via `getDb()`.
- **Sem** a variável `READINESS_SECRET` no ambiente: responde **503** com JSON a indicar que o readiness está desativado (evita endpoint público sem proteção).
- **Com** `READINESS_SECRET`: enviar cabeçalho `Authorization: Bearer <READINESS_SECRET>`. Resposta JSON apenas `{"status":"ok"}` ou `{"status":"degraded"}` (sem host, utilizador ou password da URI).

## Supabase — ambiente e migrações (SB-01 / SB-02)

1. No [Supabase Dashboard](https://supabase.com/dashboard) do projeto: **Project Settings → Database → Connection string** e escolher **Transaction** (pooler, porta **6543**, `sslmode=require`).
2. Copiar `.env.example` para `apps/web/.env.local` (ou configurar secrets no CI/Vercel) e definir:
   - `DATABASE_URL` — URI do pooler (servidor apenas).
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — **o mesmo projeto** que `DATABASE_URL` (FR1). Ver comentários FR2 em `.env.example`.
3. Aplicar os ficheiros SQL em `db/migrations/` ao Postgres remoto **por ordem** (SQL editor do Supabase, `psql`, ou pipeline interno). Garantir que o schema remoto corresponde ao repositório antes de smoke em cloud.
4. Smoke sugerido: login na app, `GET /api/v1/me` com sessão válida, e `GET /api/health` (ver story SB-01 AC3: sem `DATABASE_URL`, `/api/v1/me` não deve devolver 200 de sucesso falso).

## Estrutura

- `apps/web` — Next.js (App Router, API routes)
- `packages/shared` — tipos e constantes partilhados (`@repo/shared`)

## Multi-tenant (ORG-09) — ACL

- Acesso a empresas monitoradas considera **`organization_memberships`** e `company_memberships` (papel efectivo = o mais permissivo entre vínculo na organização dona do CNPJ e vínculo na empresa).
- `GET /api/v1/companies/accessible` filtra por **membership na organização**; resposta inclui cabeçalhos `Deprecation` e `Link` para `GET /api/v1/organizations/accessible` (rota preferida).
- Contrato OpenAPI (parcial): `docs/api/openapi-v1-organizations-session.yaml`.

## CI

O workflow `.github/workflows/ci.yml` executa **lint**, **typecheck**, **testes** (`pnpm test` com Postgres de serviço e `DATABASE_URL`) e **build** em pushes e pull requests para `main`.

### Branch default protegida

No GitHub: **Settings → Branches → Branch protection rules** para `main` — exigir que o check **CI / quality** passe antes do merge. Se o remoto ainda não estiver configurado, aplicar esta regra quando o repositório estiver no GitHub.

### Checklist de PR (NFR1 + SB-03)

Colar no PR ou executar localmente (com [ripgrep](https://github.com/BurntSushi/ripgrep) `rg` na raiz do repo):

```bash
# NFR1 — padrões sensíveis (revisão manual do resultado)
rg -n "service_role|DATABASE_URL=postgres://|postgresql://[^:]+:[^@]+@" --glob '!*.md'

# SB-03 — imports de DB na UI (deve ser vazio)
rg "getDb\\(|createDb\\(|from [\"']@/lib/db[\"']|from [\"']@repo/db[\"']" apps/web/src/hooks apps/web/src/components
rg "getDb\\(|createDb\\(|from [\"']@repo/db[\"']" apps/web/src/app --glob '!apps/web/src/app/api/**'
```

Smoke rápido (SB-01 / SB-02): `GET /api/health` (200); com `READINESS_SECRET` definido, `GET /api/health/ready` com `Authorization: Bearer …` → `ok` ou `degraded`; liveness continua 200 se a DB falhar.

## Documentação de produto

- PRD: `docs/prd.md`
- Arquitetura: `docs/architecture.md`
- Backlog MVP: `docs/stories/mvp-backlog-prioritized.md`
