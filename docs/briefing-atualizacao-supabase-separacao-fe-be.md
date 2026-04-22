# Briefing: Supabase como base de dados, variáveis públicas e separação frontend / backend

## 1. Objetivo

Documentar o âmbito e os critérios de sucesso para:

1. **Alinhar o site ao projeto Supabase indicado** (URL pública do projeto e chave **publishable** para uso no browser).
2. **Garantir ligação segura ao Postgres** do mesmo projeto (para Drizzle / Better Auth e rotas de API já existentes).
3. **Clarificar a fronteira frontend vs backend** (UI e hooks apenas consomem APIs; persistência e regras sensíveis ficam em rotas servidor).

Este documento é **somente briefing**; não substitui PRD nem inclui implementação.

---

## 2. Contexto técnico atual (brownfield)

- **Monorepo** com `apps/web` (Next.js App Router) e `packages/db` (**Drizzle** + `postgres` via `DATABASE_URL` em `apps/web/src/lib/db.ts`).
- **APIs** já organizadas sob `apps/web/src/app/api/` (ex.: `api/v1/...`, `api/auth/[...all]`).
- **`.env.example`** já documenta `NEXT_PUBLIC_SUPABASE_URL` apontando ao host `https://bvmjwzjpalkfdgaumlva.supabase.co` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` vazio (a preencher localmente).

Conclusão: o produto já trata o “backend” como **Route Handlers** no mesmo app; a atualização é sobretudo **configuração**, **opcional cliente Supabase** e **disciplina de camadas**, não necessariamente um novo repositório.

---

## 3. Configuração do projeto Supabase (o que entra onde)

### 3.1 Variáveis públicas (browser)

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (já conhecida: host `bvmjwzjpalkfdgaumlva.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave **anon / publishable** — exposta ao cliente; adequada apenas para operações permitidas por **RLS** e políticas do projeto. |

**Segurança:** não commitar valores reais de chaves em repositório nem colá-las em issues/PRs. Definir em `.env.local` (dev) e nos segredos da plataforma de deploy (ex.: Vercel). Rotacionar a chave se tiver sido exposta em canal inseguro.

### 3.2 Servidor (obrigatório para Drizzle / auth de servidor)

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | URI PostgreSQL (recomendado: **Transaction pooler** do Supabase, `sslmode=require`), alinhada ao **mesmo** projeto que `NEXT_PUBLIC_SUPABASE_URL`. |

Sem `DATABASE_URL` correto para o projeto cloud, o servidor continua a falhar com “DATABASE_URL não definido” ou ligação a base errada.

### 3.3 Chaves que não devem ir para `NEXT_PUBLIC_*`

- **`service_role`** (se alguma vez for necessária): apenas variáveis de ambiente **servidor**, nunca expostas ao bundle do cliente.

---

## 4. “Conectar com o Supabase” — três níveis (para evitar ambiguidade)

1. **Nível A — Postgres apenas (estado atual conceptual)**  
   App servidor fala com Postgres via Drizzle. Supabase é “hospedeiro” do Postgres. **Migrações** em `db/migrations/` (ou fluxo acordado) devem estar aplicadas no projeto Supabase.

2. **Nível B — Cliente `@supabase/supabase-js` no frontend**  
   Necessário se a UI usar **Auth do Supabase**, **Realtime**, **Storage** ou queries diretas à API PostgREST. Implica **RLS** bem definida para dados expostos à chave publicável.

3. **Nível C — Supabase Auth vs Better Auth**  
   Hoje o código aponta para **Better Auth**. Trocar o fornecedor de identidade é **decisão de produto/arquitetura** fora deste briefing; aqui apenas regista-se o risco de duplicar sessões ou esquemas de utilizador se se misturarem dois sistemas sem plano.

**Recomendação de briefing:** para esta fase, assumir **Nível A obrigatório** + **Nível B opcional** apenas onde houver requisito explícito (ex.: Realtime). Documentar a escolha no PR de implementação.

---

## 5. Separação frontend / backend (com routes)

### 5.1 Princípios

- **Frontend (Server Components + Client Components):** renderização, estado de UI, chamadas a `/api/...` ou Server Actions **finas** que delegam em serviços.
- **Backend (Route Handlers + libs em `src/lib`):** validação de sessão, autorização por empresa/recurso, acesso a `getDb()`, integrações e segredos.

### 5.2 Mapa alvo (ilustrativo)

| Camada | Local sugerido | Responsabilidade |
|--------|----------------|-------------------|
| UI | `apps/web/src/app/**`, `components/**`, `hooks/**` | Sem `DATABASE_URL`; sem service role; opcionalmente cliente Supabase só com operações seguras. |
| API HTTP | `apps/web/src/app/api/**/route.ts` | Contratos estáveis (JSON), auth, rate limit, orquestração. |
| Domínio / DB | `packages/db`, `apps/web/src/lib/*.ts` | Queries Drizzle, mapeamentos, auditoria. |

### 5.3 Evolução opcional (pacotes)

Se a equipa quiser **pacote `packages/api-client`** (tipos + funções `fetch` para o frontend), deve partilhar contratos com `packages/shared` (padrão já existente para tipos API), mantendo implementação de auth no servidor.

---

## 6. Critérios de aceitação (definição de “feito”)

1. **Ambiente:** `.env.example` descreve todas as variáveis necessárias; `.env.local` / CI contêm `DATABASE_URL` + chaves públicas sem erros de build.
2. **Runtime:** arranque local e health check passam com base no projeto Supabase (sem fallback silencioso para Postgres local, salvo flag explícita de dev).
3. **Segurança:** nenhuma chave `service_role` ou string de base com password em código ou em ficheiros versionados.
4. **Fronteira:** nenhum componente de UI importa `getDb()` ou módulos que exijam `DATABASE_URL`.
5. **Documentação:** README ou doc interno com passos “linkar projeto Supabase → copiar pooler URI → aplicar migrações” (pode ser um parágrafo no PR).

---

## 7. Riscos e dependências

- **RLS:** se o frontend usar `supabase-js` contra tabelas de negócio, políticas incompletas expõem dados.
- **Pooler vs sessão:** usar modo adequado ao Drizzle/serverless (documentação Supabase: Transaction pooler para muitas ligações curtas).
- **Migrações:** schema local vs remoto deve estar sincronizado antes de apontar produção ao novo projeto.
- **Testes:** `companies-api.integration.test.ts` e E2E dependem de URLs e env; atualizar fixtures/CI para o novo host se for obrigatório testar contra cloud.

---

## 8. Próximos passos sugeridos (fora deste briefing)

1. Confirmar com @architect / @data-engineer o **Nível A/B/C** de Supabase desejado.
2. Implementar env + validação opcional de `NEXT_PUBLIC_*` no arranque (só onde o cliente Supabase existir).
3. Rever rotas `api/v1/*` para garantir que toda persistência passa por `getDb()` / serviços servidor.

---

*Briefing preparado no âmbito do agente Analyst (Atlas); entrega única conforme pedido — sem alterações de código nesta tarefa.*
