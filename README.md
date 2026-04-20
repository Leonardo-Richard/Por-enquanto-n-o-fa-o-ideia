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

- `GET http://localhost:3000/api/health` → `{ "status": "ok", "app": "portal-automacao-nf" }`

## Estrutura

- `apps/web` — Next.js (App Router, API routes)
- `packages/shared` — tipos e constantes partilhados (`@repo/shared`)

## CI

O workflow `.github/workflows/ci.yml` executa **lint**, **typecheck** e **build** em pushes e pull requests para `main`.

### Branch default protegida

No GitHub: **Settings → Branches → Branch protection rules** para `main` — exigir que o check **CI / quality** passe antes do merge. Se o remoto ainda não estiver configurado, aplicar esta regra quando o repositório estiver no GitHub.

## Documentação de produto

- PRD: `docs/prd.md`
- Arquitetura: `docs/architecture.md`
- Backlog MVP: `docs/stories/mvp-backlog-prioritized.md`
