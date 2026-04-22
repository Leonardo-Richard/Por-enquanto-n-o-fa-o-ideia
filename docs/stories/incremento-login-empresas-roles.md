# User stories — Incremento: login, seleção de empresa e papéis (Superadmin / Admin / User)

**Produto:** Portal de Automação de Notas Fiscais (por empresa)  
**Fontes:** `docs/prd-atualizacao-login-empresas-roles.md`, `docs/front-end-spec-login-empresas-roles.md`, `docs/architecture-login-empresas-roles.md`  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-22  
**Estado do conjunto:** **Approved for development** (**v0.4**) — gate PO fechado no registo abaixo; todas as LER estão **Ready for dev**. *Nota:* assinatura **PO agent (Pax / AIOS)** = validação documental no fluxo AIOS; o **PO humano** pode acrescentar linha adicional ou reabrir o gate se a governança do projeto o exigir.

---

## Índice

| ID | Título resumido | Dependências principais |
| -- | ----------------- | ------------------------ |
| **LER-01** | DDL: `company_memberships`, `users.is_superadmin`, `audit_events`, sessão `active_company_id` | Tabela `companies` existente; `users` apenas colunas extra **se** já existir — ver nota de **ordem LER-01 / LER-02** abaixo |
| **LER-02** | Autenticação real (registo, login, logout, recuperação mínima) + substituição do mock | **LER-01** concluído **no que toca a** memberships + audit + extensão de sessão; criação/evolução da tabela `users` pelo **adapter de auth** pode ocorrer nesta história se ainda não existir (coordenar uma migração única ou PRs encadeados sem drift) |
| **LER-03** | API: `/me`, `/session/active-company`, `/companies/accessible` | **LER-01**, **LER-02** |
| **LER-04** | Middleware Next + guards de rota (workspace exige empresa ativa) | **LER-02**, **LER-03** |
| **LER-05** | UI “Escolha sua Empresa” (picker) + estados 0 / 1 / N | **LER-03**, **LER-04** |
| **LER-06** | API + UI gestão de utilizadores por empresa (CRUD vínculo) | **LER-03**, **LER-04** |
| **LER-07** | Auditoria (`audit_events` nos fluxos FR32) | **LER-01**, **LER-06** (ou **LER-03** para `active_company_set`) |
| **LER-08** | Rate limiting (login / pesquisa) + smoke E2E | **LER-02**–**LER-06** mínimo |

**Ordem sugerida de implementação:** LER-01 → LER-02 → LER-03 → LER-04 → LER-05 ∥ LER-06 (paralelizável após LER-04) → LER-07 → LER-08.

**Nota LER-01 / LER-02 (clarificação PO):** **LER-01** entrega o **domínio multi-empresa** (`company_memberships`, `audit_events`, coluna `is_superadmin` em `users` **se** a tabela `users` já existir, e extensão de sessão com `active_company_id`). **LER-02** integra Auth.js/Better Auth: se o adapter criar a tabela `users`, a migração pode ser **única** (LER-01+02) ou **LER-01** só cria tabelas que não conflituem com o adapter — o importante é não haver **dois donos** de schema `users` sem coordenação. O bloqueio “LER-02 após LER-01” refere-se a **memberships prontos** para ligar sessão a empresas, não a exigir “utilizadores persistidos” antes do auth existir.

### Rastreio PRD → LER (revisão sprint)

| LER | FR / NFR principais |
| --- | ------------------- |
| LER-01 | FR20, FR21, base FR32; prepara FR24 (campo sessão) |
| LER-02 | FR19, NFR11 |
| LER-03 | FR22, FR23, FR24, FR25 (payload), Epic 2 (membership admin criador — AC6) |
| LER-04 | FR31, NFR11 |
| LER-05 | FR23, FR25, NFR12, NFR13 |
| LER-06 | FR26–FR30, NFR12 |
| LER-07 | FR32 |
| LER-08 | NFR14, critérios globais PRD §9 |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit em PR; `@architect` em **LER-01**, **LER-03**, **LER-04** (authz, 403/404, sessão).  
- **Foco:** ausência de decisões de segurança só no cliente; cookies HttpOnly; SQL/`company_id` sempre validado; sem vazar existência de empresa em respostas inconsistentes com a política acordada.

---

## Definition of Done (por fatia) — critérios PO

### LER-01

- Migração aplicada com rollback documentado (1 linha ou ficheiro DOWN).  
- Script opcional de backfill `account_id` → membership `admin` descrito em `docs/architecture-login-empresas-roles.md` §11 executável ou documentado no PR.

### LER-02

- Nenhum fluxo de autorização depende de `localStorage` para identidade.  
- Testes automatizados: login feliz + credenciais inválidas (alinhado Story 1.2 PRD).

### LER-03

- Contratos JSON alinhados à secção 6 da arquitetura do incremento (nomes camel no wire, snake na DB conforme convenção do repo).  
- Testes de integração: utilizador comum não lista empresa alheia (**404/403** conforme política).

### LER-04

- Aceder a rota de workspace sem `active_company_id` válido redireciona para picker (ou `/empresas`) com `next` preservado quando aplicável.  
- Superadmin sem membership não consegue mutar dados de negócio (teste ou contrato explícito no serviço).

### LER-05

- Checklist WCAG do picker (label busca, `h1`, botões com nome acessível) verificada ou evidência no PR.

### LER-06

- User puro: 403 ou redirect em `/empresas/[id]/usuarios`; Admin só vê membros da empresa corrente.  
- Modal de remoção com copy da spec (conta global permanece).  
- **Último admin (AC6):** teste de integração (ou e2e API) que prova **409** ao tentar `PATCH`/`DELETE` que deixaria a empresa sem admin — evidência no PR ou CI (critério PO v0.2).

### LER-07

- Cada mutação de membership gera `audit_events` com `event_type` correto; **`active_company_set` em toda alteração bem-sucedida** de `POST /session/active-company` (sem “opcional MVP” — volume aceite até haver política de amostragem).
- Evento `superadmin_access_company` conforme política fechada no AC2 de LER-07 (abaixo).

### LER-08

- Smoke E2E documentado ou verde em CI: registo/login → picker (se N>1) → definir empresa → abrir lista utilizadores como Admin.  
- Rate limit configurado (env) e não bloqueia E2E (conta de teste ou bypass só em `NODE_ENV=test` se aceite pelo arquiteto).

---

## PO — Decisão de âmbito vinculativa

Em conformidade com `docs/prd-atualizacao-login-empresas-roles.md` §3 — **fora deste incremento:** SSO/MFA, RBAC fino por módulo fiscal, eliminação global de conta, limite operacional de Superadmins (política manual).

---

## Registo de aprovação PO

| Data | Versão | Decisão | Assinatura |
| ---- | ------ | -------- | ---------- |
| _pendente_ | 0.1 | Gate `*validate-story-draft` | @po |
| 2026-04-22 | 0.2 | Refino SM pós-feedback PO (estados, LER-01/02, AC último admin, auditoria, AC6 LER-03, rastreio FR) — aguarda validação | @sm |
| 2026-04-22 | 0.4 | **Approved for development** — conjunto LER-01…LER-08; critérios v0.3 cumpridos; SM atualiza estados para Ready for dev | PO agent (Pax / AIOS) |

---

## LER-01 — Story: Persistência de memberships, superadmin e auditoria

**Status:** Ready for dev  

**Dependências (DoR):** Tabela `companies` (ou migração inicial que a crie). Tabela `users`: se ainda não existir, **LER-01** cria apenas objetos que não colidam com o adapter de **LER-02**; caso contrário, aplicar `is_superadmin` e FKs de `company_memberships` na mesma migração coordenada com `@architect`.

**Referências:** `docs/architecture-login-empresas-roles.md` §§3–4; PRD **FR20**, **FR21**, **FR32** (estrutura).

**Riscos:** Migração em base já populada — coordenar backfill com `@architect`.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@data-engineer` (DDL, índices) ou `@architect`  
- **quality_gate_tools:** revisão de constraints `UNIQUE (user_id, company_id)`

### Story

**As a** sistema,  
**I want** persistir vínculos utilizador–empresa com papel, flag de superadmin e tabela de auditoria,  
**so that** as APIs e a UI possam aplicar autorização consistente e rastreável.

### Acceptance Criteria

1. Tabela `company_memberships` com colunas e constraints da arquitetura §3.2; `ON DELETE CASCADE` coerente com política de produto (remover empresa remove vínculos).  
2. Coluna `users.is_superadmin BOOLEAN NOT NULL DEFAULT FALSE` **quando** a tabela `users` existir; se `users` for criada só em LER-02, este AC verifica-se no PR de LER-02 com referência cruzada a LER-01.  
3. Tabela `audit_events` com colunas da arquitetura §3.4; índices `(company_id, occurred_at)` e `(actor_user_id, occurred_at)`.  
4. Extensão de sessão com `active_company_id` nullable e FK para `companies(id)` (ou modelo equivalente documentado se a lib de auth usar outro padrão).  
5. Seed ou script de desenvolvimento cria pelo menos um superadmin de teste (email em env) **apenas** fora de produção.

### Tasks / Subtasks

- [x] Migração SQL/Drizzle/Prisma conforme stack do repo  
- [x] Documentar rollback numa linha no ficheiro de migração  
- [ ] (Opcional) Script backfill a partir de `companies.account_id`  

### Dev Notes

- Preferir enum Postgres para `company_role`.  
- Não expor `is_superadmin` em endpoints públicos sem necessidade.

### Testing

- Migração `up`/`down` em base limpa local; inserção manual de membership e verificação de unique violation.

---

## LER-02 — Story: Autenticação credencial e sessão segura

**Status:** Ready for dev  

**Dependências (DoR):** **LER-01** concluído para **memberships + audit_events + modelo de sessão com `active_company_id`**; ver nota no índice se `users` for propriedade exclusiva do adapter neste PR.

**Referências:** PRD **FR19**, **NFR11**; `docs/architecture.md` (Auth.js / Better Auth); `docs/front-end-spec-login-empresas-roles.md` §1.3.

### Story

**As a** utilizador,  
**I want** registo, login, logout e recuperação de senha mínima com sessão em cookie HttpOnly,  
**so that** a minha identidade não dependa de armazenamento inseguro no browser.

### Acceptance Criteria

1. Fluxos de **registo**, **login** e **logout** funcionam com a biblioteca de auth escolhida; sessão não armazena segredos em `localStorage` para decisões de segurança.  
2. Senhas com hash forte (argon2/bcrypt conforme lib) e política mínima de complexidade visível na UI.  
3. Recuperação de senha: pelo menos UI de “esqueci” + endpoint/token com expiração (MVP pode ser email stub em dev documentado).  
4. `PortalProvider` deixa de ser fonte de verdade para identidade; pode permanecer para estado puramente UI até refactor final, **mas** rotas protegidas usam sessão servidor.  
5. Testes automatizados cobrem fluxo feliz e credenciais inválidas.

### Tasks / Subtasks

- [x] Configurar adapter DB para users  
- [x] Substituir `login()` mock nas rotas críticas  
- [x] Páginas `/registo`, `/recuperar` alinhadas à spec UX  

### Testing

- Vitest/integration ou e2e parcial; verificar cookie attributes em resposta (documentar no PR).

---

## LER-03 — Story: API de sessão, empresa ativa e listagem acessível

**Status:** Ready for dev  

**Dependências (DoR):** **LER-01**, **LER-02**.

**Referências:** `docs/architecture-login-empresas-roles.md` §§4–6; PRD **FR22–FR24**, **FR25** (flags no payload).

### Story

**As a** aplicação web,  
**I want** endpoints `/me`, `/session/active-company` e `/companies/accessible`,  
**so that** o cliente obtenha contexto de sessão e lista de empresas com capacidades calculadas no servidor.

### Acceptance Criteria

1. `GET /api/v1/me` (ou Route Handler equivalente) devolve utilizador autenticado, `isSuperadmin`, `activeCompanyId`.  
2. `POST /api/v1/session/active-company` com `{ companyId }` valida membership ou superadmin; atualiza sessão; responde **204** ou corpo mínimo; falhas **403/404** conforme política §5 da arquitetura.  
3. `GET /api/v1/companies/accessible` suporta `q`, paginação; cada item inclui `canOpenCompanyAdmin`, `canManageUsers`, `memberCount`, `active`, CNPJ mascarado.  
4. Utilizador sem acesso a `companyId` nunca recebe **200** nesse recurso.  
5. Zod (ou equivalente) em `packages/shared` valida query/body dos endpoints.  
6. **Epic 2 / PRD §8:** em qualquer fluxo **POST** (ou equivalente) que cria uma **nova** empresa, o sistema cria automaticamente um `company_memberships` com `company_role = 'admin'` para o `user_id` autenticado criador (transacional: falha de membership → falha de criação da empresa).

### Testing

- Testes de integração: user A + empresa B alheia → 404; admin da empresa → 200; superadmin lista todas.

---

## LER-04 — Story: Middleware e guards de workspace

**Status:** Ready for dev  

**Dependências (DoR):** **LER-02**, **LER-03**.

**Referências:** `docs/architecture-login-empresas-roles.md` §7; `docs/front-end-spec-login-empresas-roles.md` §3; PRD **FR31**, **NFR11**.

### Story

**As a** produto,  
**I want** garantir que rotas de dashboard exigem sessão válida e empresa ativa,  
**so that** não haja fuga de dados entre tenants por URL direta.

### Acceptance Criteria

1. `middleware.ts` (ou padrão equivalente) redireciona não autenticados para `/login?next=`.  
2. Rotas de workspace `(dashboard)/**` (allowlist excluindo `/empresas` picker e `/conta` se aplicável) exigem `active_company_id` válido; caso contrário redirect `/empresas`.  
3. Serviços de domínio (`CompanyService`, `JobService`, …) recebem `session` e validam `canMutateCompanyBusinessData` antes de mutações (regra MVP superadmin §4 PRD).  
4. Documentação no PR com matriz curta de rotas × requisitos.

### Testing

- Teste de middleware ou contract test: GET dashboard sem active company → redirect.

---

## LER-05 — Story: UI “Escolha sua Empresa” (picker)

**Status:** Ready for dev  

**Dependências (DoR):** **LER-03**, **LER-04**.

**Referências:** `docs/front-end-spec-login-empresas-roles.md` §§4.1, 5.1, 6, 10; PRD **FR23**, **FR25**, decisões §2 (0/1/N empresas).

### Story

**As a** utilizador com acesso a uma ou mais empresas,  
**I want** ver uma lista pesquisável de empresas e escolher em qual trabalhar,  
**so that** o contexto da sessão corresponda à organização correta.

### Acceptance Criteria

1. Rota `/empresas` (ou nome acordado) com `h1` “Escolha sua Empresa”, busca com label acessível, grid de cards conforme spec §5.1.  
2. **N > 1:** utilizador escolhe e **Acessar** chama `POST /session/active-company` e redireciona para o dashboard.  
3. **N === 1:** após login, atalho automático define empresa ativa e salta picker (pode mostrar flash opcional).  
4. **N === 0** (não superadmin): estado vazio com copy `pick.empty.none` da spec §10.  
5. Botão **Admin** só renderizado quando `canOpenCompanyAdmin` do payload for `true` (preferir ocultar a disabled sem tooltip, salvo exceção UX).  
6. Estados loading (skeleton) e erro (`role="alert"` + retry) conforme **NFR13**.

### Testing

- Teste de componente ou e2e: renderização condicional do botão Admin; smoke manual documentado.

---

## LER-06 — Story: Gestão de utilizadores da empresa (API + UI)

**Status:** Ready for dev  

**Dependências (DoR):** **LER-03**, **LER-04**.

**Referências:** PRD **FR26–FR30**; `docs/front-end-spec-login-empresas-roles.md` §§4.3–4.6, 5.2; arquitetura §6 (rotas members).

### Story

**As a** administrador de empresa (ou superadmin),  
**I want** listar, vincular, criar, editar e remover vínculos de utilizadores na minha empresa,  
**so that** a equipa aceda ao portal com os papéis certos.

### Acceptance Criteria

1. Rota `/empresas/[id]/usuarios` com tabela, busca, toolbar e copy da spec §5.2; **403** com página amigável se `canManageUsers` for falso.  
2. `GET /companies/:id/members` com paginação e `q`; apenas utilizadores com `canManageUsers`.  
3. `POST` com `mode: 'link' | 'create'` conforme PRD **FR27/FR28**; erros 400 com mensagens claras (email duplicado, já membro).  
4. `PATCH` e `DELETE` membership conforme **FR29/FR30**; DELETE não remove `users` global.  
5. Modal de confirmação de remoção com texto obrigatório da spec §4.6.  
6. **Último admin (fechado):** qualquer `PATCH`/`DELETE` que deixaria a empresa **sem** pelo menos um membership com `company_role = 'admin'` deve ser rejeitado com **409** e mensagem clara (ex.: “Promova outro utilizador a administrador antes de remover ou rebaixar o último administrador.”). Superadmin pode executar a promoção no mesmo fluxo (UI + API) e só depois remover/rebaixar o anterior.

### Testing

- Integração: User tenta `GET members` → 403; Admin → 200.  
- Integração: empresa com um único admin — `PATCH` que rebaixa `company_role` de `admin` para `user` **ou** `DELETE` desse membership → **409** e corpo de erro alinhado ao AC6 (sem estado inconsistente na DB).  
- (Opcional) Dois admins: remover um → **200**; tentar remover o último → **409**.

---

## LER-07 — Story: Eventos de auditoria nas mutações

**Status:** Ready for dev  

**Dependências (DoR):** **LER-01**, **LER-06**; opcionalmente integrar `active_company_set` já em **LER-03**.

**Referências:** PRD **FR32**; arquitetura §3.4, §8.

### Story

**As a** operador de compliance,  
**I want** que ações sensíveis de membros e superadmin fiquem registadas,  
**so that** possamos investigar acessos e alterações de papéis.

### Acceptance Criteria

1. Inserção em `audit_events` para: `membership_created`, `membership_removed`, `membership_role_changed`.  
2. **`superadmin_access_company` (política única):** registar **uma linha por mutação** de membership (`POST` / `PATCH` / `DELETE` em `/companies/:id/members`) quando o ator tem `is_superadmin = true` **e** **não** possui membership em `company_id` (nem como `user` nem `admin`). **Não** registar este evento em `GET` apenas de listagem (MVP; se compliance exigir leitura auditada, abrir follow-up fora deste conjunto).  
3. **`active_company_set`:** em **toda** resposta bem-sucedida de `POST /session/active-company`, inserir `audit_events` com `event_type = 'active_company_set'` e `metadata` mínimo `{ "previousCompanyId": "…"|null, "newCompanyId": "…" }` (sem PII extra).  
4. `metadata` JSON sem dados sensíveis proibidos pela política.

### Testing

- Teste de integração: após `POST`/`DELETE` membership → linha em `audit_events` com `event_type` esperado.  
- Teste de integração: `POST /session/active-company` bem-sucedido → linha `active_company_set`.  
- Superadmin sem membership: primeira mutação de members em empresa X → inclui linha `superadmin_access_company` (além da linha do evento de membership).

---

## LER-08 — Story: Rate limiting e smoke E2E do fluxo crítico

**Status:** Ready for dev  

**Dependências (DoR):** **LER-02** a **LER-06** mínimo funcional.

**Referências:** **NFR14**; PRD §9 critérios globais; `docs/architecture-login-empresas-roles.md` §8.

### Story

**As a** equipa de engenharia,  
**I want** limitar abusos em login e pesquisas e um teste E2E do fluxo auth → empresa → utilizadores,  
**so that** o incremento seja seguro e regressões sejam detetadas cedo.

### Acceptance Criteria

1. Rate limit aplicado a **login** (por IP) e a endpoint de **pesquisa de membros** ou `companies/accessible` conforme arquitetura (Upstash ou alternativa já no projeto).  
2. Limites documentados em `.env.example`.  
3. Playwright (ou ferramenta existente no repo) cobre: registo ou login → (se necessário) picker → dashboard com empresa correta → abrir utilizadores como Admin.  
4. Pipeline CI executa smoke E2E em job dedicado (não bloquear unitários se flaky — documentar tags `@smoke`).

### Testing

- CI verde ou justificativa temporal no PR com plano para ativar CI.

---

## Dev Agent Record

### Agent Model Used

Composer (GPT-5.2) via Cursor.

### Completion Notes

- Entregue MVP técnico LER-01…LER-08: migrações Postgres, pacote `@repo/db` (Drizzle), Better Auth (sessão com `activeCompanyId`), APIs `/api/v1` (me, sessão, empresas, membros), middleware com cookie + rate limit de login (Upstash opcional), UI picker `/empresas`, gestão `/empresas/[id]/usuarios`, auditoria em mutações e `active_company_set`, teste Vitest (regra último admin) e smoke Playwright (`@smoke`).
- **Correções pós-QA (@dev):** `GET companies/accessible` deixa de expor `cnpjDigits` no wire (só `cnpjMasked`); mensagens de erro em `auth-browser` leem `error.message` (jsonError/Better Auth); testes Vitest de integração com Postgres (`companies-api.integration.test.ts`, skip sem `DATABASE_URL`); smoke Playwright LER (`e2e/ler-smoke.spec.ts`, ativar `PLAYWRIGHT_LER_SMOKE=1`); CI com Postgres + migrações + `pnpm test` + job `e2e-ler-smoke` (Playwright fluxo registo→empresa→utilizadores). `displayCnpjLabel` em `@repo/shared` para execuções com CNPJ mascarado.
- O repositório usa **`pnpm-lock.yaml`** no CI (`pnpm install --frozen-lockfile`); o `packageManager` na raiz pode permanecer npm para quem instala com npm localmente.
- Em ambientes Windows, se `npm install` falhar com erro interno do npm, repetir ou usar cache limpo.

### File List

- `db/migrations/20260422120000_companies_monthly_run_day.sql`
- `db/migrations/20260423120000_ler_auth_multitenant.sql`
- `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/*`
- `packages/shared/package.json`, `packages/shared/src/api-v1.ts`, `packages/shared/src/cnpj.ts`, `packages/shared/src/index.ts`
- `apps/web/package.json`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`, `apps/web/e2e/ler-smoke.spec.ts`
- `apps/web/src/lib/api-error-message.ts`, `apps/web/src/lib/api-error-message.test.ts`, `apps/web/src/lib/auth-browser.test.ts`, `apps/web/src/app/api/v1/companies-api.integration.test.ts`
- `apps/web/src/middleware.ts`, `apps/web/src/lib/*`, `apps/web/src/context/*`, `apps/web/src/hooks/*`, `apps/web/src/components/*`, `apps/web/src/app/**/*`
- `.env.example`, `.github/workflows/ci.yml`

---

## Change Log

| Versão | Data | Descrição |
| ------ | ---- | --------- |
| 2026-04-22 | — | Implementação técnica incremento login/empresas/papéis (MVP) — @dev (AIOS) |
| 2026-04-22 | — | Follow-up QA: integração API+DB, mascaramento `accessible`, mensagens auth, smoke LER e CI — @dev (AIOS) |
| 0.4 | 2026-04-22 | Gate PO fechado (registo v0.4); cabeçalho **Approved for development**; LER-01…LER-08 **Ready for dev**; assinatura PO agent (Pax / AIOS) — critério PO para nota documental 10/10 |
| 0.3 | 2026-04-22 | Critérios PO (reavaliação 9/10): DoD LER-06 espelha AC6 (409 último admin + prova em PR/CI); Testing LER-06 com casos 409 e dois-admins; cabeçalho + registo com passos explícitos pós-aprovação PO → Ready for dev |
| 0.2 | 2026-04-22 | Alinhamento com critérios PO: status grooming consistente; nota LER-01/02; tabela rastreio FR; AC6 LER-03 (membership admin ao criar empresa); AC6 LER-07 (último admin → 409); política única auditoria `superadmin_access_company` + `active_company_set` obrigatório; DoD LER-07 atualizado |
| 0.1 | 2026-04-22 | Rascunho inicial das histórias LER-01–LER-08 a partir do PRD e da arquitetura do incremento |

---

— River (SM) — AIOS; **gate PO fechado (v0.4)** — handoff para `@dev` por ordem LER-01 → LER-08.

---

## QA Results

**Revisão:** Quinn (QA / AIOS) — 2026-04-22  
**Âmbito:** implementação atual no repositório (migrações, `apps/web`, `packages/db`, `packages/shared`, middleware, testes).  
**Decisão de gate:** **CONCERNS** — funcionalidade base credível e alinhada ao incremento; lacunas em evidência de testes, E2E/CI e alguns detalhes de contrato/segurança impedem **PASS** sem follow-up.

### Rastreio LER → evidência

| LER | Veredito | Notas |
| --- | -------- | ----- |
| **LER-01** | **PASS** | Migrações `db/migrations/*` com `company_memberships`, `audit_events`, `"user"."isSuperadmin"`, `"session"."activeCompanyId"`, rollback referido no SQL. Script backfill opcional continua em aberto (aceitável como opcional). |
| **LER-02** | **CONCERNS** | Better Auth + rotas `/registo`, `/recuperar`, `/login` sem identidade em `localStorage` para sessão. **Gap:** DoD pedia testes automatizados login feliz + credenciais inválidas — não há testes de integração/API dedicados (apenas fluxo manual). Erros em `signInEmail` assumem `body.message`; a API pode devolver `{ error: { message } }` — risco de mensagem genérica. |
| **LER-03** | **CONCERNS** | Endpoints `/api/v1/me`, `session/active-company`, `companies/accessible`, CRUD empresa e membros existem; Zod em `@repo/shared`. **Gap:** testes de integração (user A vs empresa B → 404, etc.) não encontrados no repo. Payload `companies/accessible` inclui `cnpjDigits` além de `cnpjMasked` — reavaliar vs política de mascaramento no wire. |
| **LER-04** | **CONCERNS** | Middleware com cookie + `WorkspaceGate` redireciona para `/empresas?next=…` quando falta empresa ativa (preserva query na mesma navegação). **Gap:** validação de sessão no edge é só presença de cookie (aceitável como otimização, mas NFR11 exige validação no servidor nas ações — depende de handlers). **Gap DoD:** “superadmin sem membership não muta dados de negócio” sem teste automatizado explícito (lógica em `authz` + POST empresa; reforçar com teste). |
| **LER-05** | **CONCERNS** | Picker com `h1`, pesquisa com label, estados 0/1/N tratados em grande parte; atalho N=1. **Gap:** checklist WCAG formal não evidenciada (sem registo de verificação). Filtro de pesquisa é sobretudo **client-side** após carregar lista (não invalida critério, mas não exercita rate limit de pesquisa no servidor). |
| **LER-06** | **CONCERNS** | UI `/empresas/[id]/usuarios` com 403 dedicado; modal de remoção com copy alinhada à FR30. API com 409 último admin. **Gap:** DoD pedia **teste de integração ou E2E API** para 409 — existe apenas teste unitário isolado (`last-admin.test.ts`) que **não** chama a API nem a DB. |
| **LER-07** | **PASS** | `insertAuditEvent` em membros + `active_company_set` em `POST` sessão; `superadmin_access_company` antes de mutações quando aplicável. |
| **LER-08** | **CONCERNS** | Rate limit login (middleware + Upstash opcional) e rate limit em `companies/accessible` / membros; `.env.example` documenta limites. Playwright com tag `@smoke` cobre **/** e **/login** apenas — **não** cumpre o smoke DoD (registo/login → picker → dashboard → utilizadores admin). **CI:** workflow `.github/workflows/ci.yml` usa **pnpm**; monorepo declara `packageManager: npm@11.9.0` — risco de desalinhamento; **não** há job Playwright no CI analisado. |

### Riscos (probabilidade × impacto)

1. **Médio — CI vs lockfile:** `ci.yml` com `pnpm install --frozen-lockfile` vs equipa local em npm pode falhar ou mascarar estado real do lockfile.
2. **Médio — Recuperação de senha:** cliente usa `POST /api/auth/request-password-reset`; convém validar contra a versão exata do Better Auth em runtime (path/corpo).
3. **Baixo — Sessão no cliente:** `get-session` + normalização manual; regressões de formato JSON do Better Auth podem partir o gate sem testes de contrato.

### Recomendações obrigatórias antes de **PASS**

1. Adicionar **testes de integração** (Vitest + DB de teste ou HTTP contra app de teste) para: 404 empresa alheia; 403 membros; **409** último admin em `PATCH`/`DELETE` reais.
2. Estender **E2E @smoke** (ou job dedicado) ao fluxo mínimo DoD LER-08 com seed (utilizador admin + 2 empresas ou fluxo equivalente).
3. Alinhar **CI** ao gestor de pacotes do projeto (npm ou pnpm) e incluir `npm run test` / Playwright smoke conforme política de flaky.
4. Rever exposição de **`cnpjDigits`** em `GET companies/accessible` vs requisito de mascaramento.

### Opcionais (dívida aceitável)

- Script backfill LER-01 (opcional na story).
- Evidência WCAG (checklist ou screenshot anotado no PR).

**Próximo passo sugerido para @dev:** fechar itens “Recomendações obrigatórias”; depois **\*gate** ou nova passagem QA para promover a **PASS**.

— Quinn, guardião da qualidade 🛡️
