# Arquitetura técnica — Supabase, ambiente e separação frontend / backend

**Entradas:** [prd-atualizacao-supabase-separacao-fe-be.md](prd-atualizacao-supabase-separacao-fe-be.md), [front-end-spec-supabase-fe-be.md](front-end-spec-supabase-fe-be.md), [briefing-atualizacao-supabase-separacao-fe-be.md](briefing-atualizacao-supabase-separacao-fe-be.md).  
**Arquitetura base:** [architecture.md](architecture.md) — este documento define **deltas** de integração, limites de camadas e observabilidade; não substitui o desenho global do produto.

---

## 1. Resumo executivo

| Tópico | Decisão |
|--------|---------|
| **Papel do Supabase** | **Hospedeiro de Postgres** (Nível A): `DATABASE_URL` aponta para o **mesmo** projeto que `NEXT_PUBLIC_SUPABASE_URL`. Auth continua **Better Auth** (CR1). |
| **Cliente browser** | `NEXT_PUBLIC_SUPABASE_*` apenas se **FR8** for aprovado; caso contrário, nenhum `@supabase/supabase-js` no bundle. |
| **Acesso a dados** | **Somente servidor:** `getDb()` / Drizzle / `packages/db` invocados a partir de Route Handlers, Server Actions ou Server Components que **não** serializem credenciais para o cliente. |
| **Contratos HTTP** | Rotas `app/api/v1/*` e `app/api/auth/*` **inalteradas** em forma e semântica (FR6 / CR3), salvo versionamento explícito noutro documento. |
| **Pooler** | `DATABASE_URL` em modo **Transaction** (porta **6543** típica Supabase) com TLS; adequado a ligações curtas em runtime serverless (NFR3). |
| **Segredos** | `service_role` e password de DB **apenas** env servidor; nunca `NEXT_PUBLIC_*` (NFR1). |
| **UX de falhas** | APIs devolvem JSON com `message` quando possível; UI usa `messageFromApiJson` e padrões do [front-end-spec-supabase-fe-be.md](front-end-spec-supabase-fe-be.md). |
| **Health** | Evoluir de “liveness” estático para modelo **liveness + readiness** (ver §6), sem expor strings de ligação na resposta pública. |

---

## 2. Vista em camadas (alvo)

```mermaid
flowchart TB
  subgraph Browser
    UI[App Router pages / client components]
    Hooks[hooks/*]
  end
  subgraph NextServer[Next.js servidor]
    RSC[Server Components]
    RH[Route Handlers app/api/**]
    SA[Server Actions]
    Lib[lib/* auth db authz audit]
  end
  subgraph Packages
    DB[(packages/db Drizzle + postgres)]
    Shared[@repo/shared tipos e helpers]
  end
  subgraph SupabaseCloud[Projeto Supabase]
    PG[(PostgreSQL)]
  end
  UI -->|HTTPS fetch /api| RH
  Hooks -->|HTTPS fetch /api| RH
  RSC -->|opcional: fetch interno| RH
  RSC --> Lib
  SA --> Lib
  RH --> Lib
  Lib --> DB
  DB -->|TLS pooler| PG
```

**Regra de dependência (FR4, FR5):** `apps/web/src/app/(rotas UI)`, `components/*` e `hooks/*` **não** importam `getDb`, `createDb`, `@repo/db` com side-effect de ligação, nem pacotes que leem `DATABASE_URL`.

---

## 3. Configuração e ambientes

### 3.1 Matriz de variáveis

| Variável | Onde corre | Finalidade |
|----------|------------|--------------|
| `DATABASE_URL` | Servidor apenas | URI Postgres (pooler transacional); usada por `getDb()` em `apps/web/src/lib/db.ts`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Build + browser | Origem do projeto Supabase; hoje documentação e eventual cliente anon. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Build + browser | Chave anon/publicável; **só** se existir código cliente Supabase com RLS (FR8, NFR2). |
| `BETTER_AUTH_*`, `BETTER_AUTH_SECRET`, etc. | Servidor | Inalterado (CR1). |
| `SUPABASE_SERVICE_ROLE` (nome ilustrativo) | Servidor opcional | **Não** obrigatório para Nível A; usar apenas se integração servidor-a-servidor com APIs Supabase exigir (fora do MVP deste PRD se não necessário). |

### 3.2 Paridade dev / staging / prod

- **Recomendação:** um ficheiro `.env.example` completo (FR2); segredos reais em `.env.local` (dev) e secret manager do deploy (Vercel, etc.).  
- **Decisão em aberto (PRD §7):** Postgres local vs remoto em dev — arquitetura **neutra**: ambos válidos desde que migrações em `db/migrations/` sejam a fonte de verdade do schema (CR2).

---

## 4. Camada de dados

- **Driver:** pacote `postgres` + **Drizzle** em `packages/db/src/client.ts`.  
- **Conexão:** singleton em `globalThis.__portalDb` no web app para reutilizar pool em desenvolvimento e limitar ligações (padrão atual).  
- **Migrações:** SQL versionado em `db/migrations/` aplicável ao Postgres Supabase; responsabilidade partilhada com @data-engineer para compatibilidade de extensões e permissões (`CREATE` em schema `public`, etc.).  
- **RLS:** não exigida para fluxo **exclusivamente servidor** via Drizzle; torna-se **obrigatória** se FR8 expuser tabelas via PostgREST/anon key — aí o @data-engineer define políticas antes de qualquer merge de cliente.

---

## 5. API e domínio

- **Localização:** `apps/web/src/app/api/v1/**/route.ts`, `apps/web/src/app/api/auth/[...all]/route.ts`, utilitários em `apps/web/src/app/api/v1/_lib/*`.  
- **Responsabilidades:** autenticação de sessão, `authz` por `companyId` / `account_id`, rate limit onde existir, serialização JSON estável.  
- **Erros:** corpo JSON estruturado com `message` legível; códigos HTTP explícitos (401/403/4xx/5xx) para o cliente mapear UX conforme spec (401 → login, 403 → permissão, 5xx → retry).  
- **Compatibilidade:** sem alterar paths nem nomes de campos públicos sem bump de versão de API (FR6).

---

## 6. Observabilidade e health (NFR4)

**Estado atual:** `GET /api/health` devolve JSON estático `{ status: "ok", app }` — adequado a **liveness** de processo.

**Alvo arquitetural:**

1. **Liveness (público):** manter rota leve sem dependência de DB (load balancers, CI rápido).  
2. **Readiness (restrito ou enriquecido):** verificar `SELECT 1` (ou equivalente) via `getDb()` num handler **protegido** (header secreto, rede interna, ou rota não exposta em documentação pública), devolvendo apenas `ok` / `degraded` **sem** detalhes de `DATABASE_URL`.

Isto cumpre NFR4 e a opção UX de health interno sem misturar diagnóstico sensível com utilizadores finais.

---

## 7. Front-end e limites de bundle (alinhamento UX)

- **Dados:** hooks e componentes `"use client"` consomem apenas `fetch` para `/api/...` (ou props de RSC).  
- **Mensagens:** centralizar tratamento de erro com `messageFromApiJson` (`apps/web/src/lib/api-error-message.ts`) e componentes shadcn descritos na spec UX (`Alert`, toast, `Skeleton`).  
- **Componente opcional `ApiErrorBanner`:** props mínimas (`message`, `onRetry?`), `role="alert"` — encaixa na camada de apresentação sem tocar em domínio.  
- **Realtime (FR8):** se aprovado, módulo dedicado (ex.: `lib/supabase-browser.ts`) instanciado **só** em árvores cliente que precisem de canal; **proibido** inicializar na `layout` raiz sem necessidade (evita subscrições globais e fuga de política RLS).

---

## 8. Segurança em profundidade

| Camada | Medida |
|--------|--------|
| Rede | TLS obrigatório para Postgres; pooler Supabase. |
| Aplicação | Authz em `lib/authz.ts` + sessão Better Auth em todas as rotas mutáveis. |
| Config | Secrets fora do repositório; revisão de PR para padrões `service_role`, `postgres:password@` em strings. |
| Cliente eventual | RLS + anon key apenas em tabelas mínimas; nunca dados administrativos via anon. |

---

## 9. Testes e CI (NFR6)

- **Integração:** manter possibilidade de `DATABASE_URL` apontar para Postgres local (Docker) em CI para custo zero e determinismo.  
- **Smoke contra cloud:** opcional com secrets de repositório; não versionar URLs com credenciais.  
- **E2E:** Playwright existente deve continuar a funcionar com env injetado no job; ajustar apenas se URLs base mudarem.

---

## 10. Runtime e deploy

- Route Handlers que usam `postgres` nativo devem executar em **Node.js** (runtime por defeito das rotas `app/api` no Next.js atual do projeto). **Não** mover estes handlers para Edge sem substituir o driver por um compatível com Edge.  
- **Monorepo:** manter `@repo/db` e `@repo/shared` como fronteiras de pacote (CR4); opcional futuro `packages/api-client` **só** com tipos + `fetch`, sem segredos.

---

## 11. Riscos técnicos e mitigação (cruzamento com PRD §9)

| Risco | Mitigação arquitetural |
|-------|-------------------------|
| Timeout do pool em picos | Pooler transacional + limite `max` em `createDb`; monitorizar conexões no dashboard Supabase. |
| Health que acerta na DB em cada probe | Separar liveness leve de readiness profundo com frequência baixa ou gating por segredo. |
| Import acidental de `getDb` em cliente | ESLint `import/no-restricted-paths` ou boundary plugin (avaliação @dev); code review. |

---

## 12. Delegação

- **Schema detalhado, RLS, índices:** @data-engineer.  
- **Implementação de rotas, hooks, ESLint:** @dev.  
- **Copy e estados de erro visuais:** [front-end-spec-supabase-fe-be.md](front-end-spec-supabase-fe-be.md) + @ux-design-expert.

---

## 13. Changelog

| Data | Versão | Descrição | Autor |
|------|--------|-----------|--------|
| 2026-04-22 | 1.0 | Arquitetura inicial alinhada ao PRD e spec UX | Architect |

---

— Aria, arquitetando o futuro
