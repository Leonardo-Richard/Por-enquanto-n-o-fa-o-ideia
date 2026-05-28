# Padrões de código — Portal de Automação de NF

Fonte viva derivada de `docs/architecture.md` (v0.7) e práticas do monorepo.

## TypeScript / Next.js

- App principal em `frontend/` (App Router). API dedicada opcional em `backend/` (porta 3001).
- **SB-03:** `frontend/src/components`, `hooks` e rotas UI **não** importam `getDb`, `createDb` nem `@repo/db`.
- Dados sensíveis e Drizzle só em Route Handlers, Server Actions e `server/*`.
- Erros de API: preferir `jsonError` / códigos estáveis em rotas públicas; rotas internas ADN usam `@repo/adn-internal` + `adnHandlerToResponse`.

## Pacotes

| Pacote | Uso |
|--------|-----|
| `@repo/db` | Schema Drizzle + cliente Postgres |
| `@repo/shared` | Tipos e constantes partilhados |
| `@repo/adn-internal` | Handlers internos ADN (HMAC) |
| `@repo/scheduling` | Agendamento mensal |

## SQL e migrações

- Ficheiros em `db/migrations/` com prefixo `YYYYMMDDHHMMSS_slug.sql`.
- Aplicar com `pnpm db:apply-migrations` (requer `DATABASE_URL`).
- Bases já migradas manualmente: `pnpm db:apply-migrations -- --baseline` uma vez.

## Python (worker)

- `workers/nfse-portal-bridge/` — fila Postgres, HMAC ao portal, sem service role por defeito.
- Testes: `pytest` em `workers/nfse-portal-bridge/tests/`.

## Gestor de pacotes

- **pnpm 9** na raiz (`packageManager` em `package.json`).
- CI: `pnpm install --frozen-lockfile`.
