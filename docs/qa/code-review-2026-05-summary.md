# Revisão geral de código — maio 2026

Revisão **read-only** do monorepo `portal-automacao-nf`, com follow-ups de consistência aplicados na mesma sprint (ver secção «Alterações de follow-up»).

## Conclusão

O código está **adequado a um MVP fiscal multitenant com integração ADN**: camadas claras (BFF → handlers → `@repo/*`), API interna com HMAC, CI com Postgres + Vitest + Playwright + pytest, e UI ADN com estados de acesso explícitos.

Principais gaps identificados: **documentação desactualizada**, **duplicação `frontend`/`backend`**, **formato de erros API** vs arquitectura, **RLS parcial** (aceitável enquanto o DB for só servidor).

Detalhe completo: plano de revisão em `.cursor/plans/` (nome: «Revisão geral código») e [security-audit-adn-2026-05.md](./security-audit-adn-2026-05.md).

## Alterações de follow-up (pós-revisão)

| Item | Ficheiro / pacote |
|------|-------------------|
| `DATABASE_URL` unificado | `@repo/db/portal-db` — `createPortalDbAccessor` |
| Env validado (Zod) | `@repo/shared/server-env` + `frontend/src/lib/env.ts` |
| Auth/proxy usam env tipado | `frontend/src/lib/auth.ts`, `internal-api-forward.ts` |
| Arquitectura alinhada ao código | `docs/architecture.md` (pnpm, Next 15, auth em layouts) |

## Recomendações ainda em aberto

1. Remover `SUPABASE_SERVICE_ROLE_KEY` dos workers após smoke de `fetch-vault-envelope` em staging.
2. `requestId` global e formato `{ error: { code, requestId } }` nas APIs públicas (ou actualizar spec).
3. Testes de paridade `frontend` vs `backend` nas rotas internas ADN.
4. RLS em tabelas de negócio se PostgREST/anon key expuser dados.

## Checklist para novas rotas API

- [ ] `getAuthedSession` ou gate ADN (`adn-public-access`)
- [ ] Filtro por `organization_id` / org activa
- [ ] Sem `@repo/db` em `components/` ou hooks (SB-03)
