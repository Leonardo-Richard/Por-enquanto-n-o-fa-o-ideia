# Pilha tecnológica

| Camada | Tecnologia |
|--------|------------|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend / API | Next.js 15, React 19, TypeScript |
| Auth | Better Auth + Drizzle |
| Base de dados | PostgreSQL (Supabase pooler em produção) |
| ORM | Drizzle (`packages/db`) |
| Storage ADN / certificados | Supabase Storage (service role só no servidor) |
| Rate limit | In-memory + Upstash Redis (opcional) |
| Worker ADN | Python 3.12 (`workers/nfse-portal-bridge`) |
| Motor alternativo | Playwright (`workers/adn-playwright-motor`) |
| Testes TS | Vitest; E2E Playwright |
| Testes Python | pytest |
| CI | GitHub Actions (Postgres 16 de serviço) |
| Deploy | Vercel (portal), Docker/Easypanel (worker) — ver runbooks |

Variáveis: `.env.example`. Readiness: `READINESS_SECRET` + `GET /api/health/ready`.
