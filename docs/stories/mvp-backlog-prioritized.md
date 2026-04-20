# Backlog MVP — User stories priorizadas

**Produto:** Portal de Automação de Notas Fiscais (por empresa)  
**Fontes:** `docs/prd.md`, `docs/architecture.md`, `docs/front-end-spec.md`  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-20  
**Versão:** 0.4 — alinhamento DoR/PO (dependências explícitas, riscos, critérios de corte)

---

## Como ler este documento

- **Prioridade (P01–P14):** ordem sugerida de implementação para **respeitar dependências técnicas** e entregar valor incremental (vertical slices quando possível).
- **Epic.X.Y:** alinhamento com os épicos do PRD (ajuste fino: **P05** antecipa modelo de jobs para alimentar o dashboard sem “placeholder eterno”).
- Cada história inclui **Executor** e **Quality gate** (regra AIOS: executor ≠ quality gate).
- **Não implementar código neste artefacto** — apenas preparação para `@dev`.
- **Ordem crítica:** implementar **P14** (compliance/auditoria) **antes de P07 e P10** — ver nota na tabela — para os ACs de auditoria e rodapé estarem disponíveis quando essas histórias forem concluídas.

---

## Rastreabilidade FR / NFR → histórias (MVP)

| ID   | Cobertura principal |
| ---- | ------------------- |
| FR1  | P02 (login, registo, **recuperação**), P03 |
| FR2  | P02, P04 (isolamento por conta) |
| FR3–FR5 | P04, P06 |
| FR6–FR7 | P09, P11 |
| FR8  | P10, P11 |
| FR9  | P08 |
| FR10–FR12 | P12, P11 |
| FR13 | P11 |
| FR14 (conector MVP) | P13 |
| FR15–FR17 | P05, P06, P07, P08 |
| NFR1–NFR2 | P02, P10, P11, P14 (segredos, TLS assumido no hosting) |
| NFR3  | P14 (privacidade, pedidos) |
| NFR4  | P14, P07, P10 (eventos de auditoria) |
| NFR5–NFR10 | P01, P05, P12, `docs/architecture.md` (observabilidade, retries) |

---

## Definition of Ready (DoR) — história pronta para sprint

Cada história deve cumprir **antes** de entrar em sprint:

1. **User story** com papel, ação e valor; **AC numerados** verificáveis (pass/fail), sem “opcional” sem critério de corte.
2. **Dependências** identificadas e predecessoras **Done** ou explicitamente waived pelo PO.
3. **Referências** a PRD/arquitetura/UX quando houver decisão de produto ou contrato de API.
4. **Executor** e **quality gate** preenchidos; risco ou integração externa mencionados em Dev Notes.
5. Estado **Draft** → **Approved** apenas após `*validate-story-draft` (PO).

### Ciclo de vida (estados no backlog)

| Estado | Significado |
| ------ | ----------- |
| **Draft** | Conteúdo em elaboração; **não** pronto para sprint até PO aprovar. |
| **Approved** | DoR cumprida; PO validou (`*validate-story-draft`); pode entrar em sprint. |
| **Ready for Dev** | Aprovada e priorizada para implementação imediata (opcional — equipa pode usar só Approved). |
| **In Progress** | Em desenvolvimento. |
| **Ready for Review** | Implementação entregue; aguarda QA / merge. |
| **Done** | Aceite em produção ou critério de “feito” da equipa. |

*Nota:* histórias neste ficheiro podem permanecer **Draft** no texto enquanto o código já evoluiu (ex.: P01) — o PO deve sincronizar estado quando fizer sentido.

### Modelo mínimo por história (checklist PO)

Cada secção **Pxx** deve incluir, quando aplicável:

1. **Dependências (DoR)** — predecessoras **Done** ou **waived** (registar waived em nota).
2. **Referências** — apontador curto a `docs/prd.md`, `docs/architecture.md`, `docs/front-end-spec.md` (secções ou FR).
3. **Risco / integração** — uma linha em **Dev Notes** ou bloco **Riscos (DoR)** se houver integração externa, PII ou decisão reversível.
4. **Critérios de corte** — evitar a palavra “opcional” sem alternativa binária: ou está **fora do âmbito** desta história, ou tem **AC numerado** que o valida.

### Índice de artefactos

- **Fonte única do backlog MVP:** este ficheiro (`mvp-backlog-prioritized.md`). Ficheiros por história em `docs/stories/*.md` são **opcionais**; quando existirem, regenerar índice com `*stories-index` (PO).

---

## Resumo da priorização

| P   | ID      | Título curto                          | Dependências diretas |
| --- | ------- | ------------------------------------- | ---------------------- |
| P01 | 1.1     | Monorepo, CI e health                 | —                      |
| P02 | 1.2     | Autenticação de conta                 | P01                    |
| P03 | 1.3     | Shell da app e rotas protegidas       | P02                    |
| P04 | 2.1     | Domínio e API de empresas             | P03                    |
| P05 | 4.1     | Jobs: modelo, estados e API           | P04                    |
| P06 | 2.2     | UI: lista e criar empresa             | P04, P05               |
| P14 | —       | LGPD mínimo, auditoria, rate limit   | P02, P03               |
| P07 | 2.3     | UI: detalhe, editar e desativar       | P06, **P14**           |
| P08 | 4.2     | Gatilho: job imediato ao criar empresa | P05, P06               |
| P09 | 3.1     | Agente: instalação e pasta raiz       | P01                    |
| P10 | 3.2     | Agente: pairing seguro com a conta    | P02, P09, **P14**      |
| P11 | 3.3     | Agente: comandos e gravação em disco  | P08, P10               |
| P12 | 4.3     | Agendamento mensal + retries          | P05, P11               |
| P13 | 4.4     | Conector MVP                          | P11                    |

**Notas:**

- **P14** aparece na tabela **antes de P07/P10** na ordem lógica de leitura: executar **P14 imediatamente após P06** (não esperar pelo fim do backlog).
- **P08** depende de **P06** (fluxo de criação na UI); o job imediato pode ser validado via API mesmo sem P07.
- **P09** pode iniciar em paralelo com **P04–P06** assim que **P01** existir (equipa com capacidade dupla).
- **P13** fecha o fluxo ponta a ponta com pelo menos um conector; pode ser **stub controlado** até integração real existir (FR14).

---

## P01 — Story 1.1: Monorepo, CI e health check

**Status:** Ready for Review  

**Dependências (DoR):** Nenhuma (história raiz).

**Referências (DoR):** `docs/architecture.md` — *Repository Structure*, *Tech Stack*; matriz FR/NFR neste documento (NFR5–NFR10 / pipeline).

**Riscos (DoR):** Baixo — stack standard; sem dados pessoais.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** revisão de estrutura monorepo, fronteiras de pacotes, pipeline CI

### Story

**As a** maintainer do repositório,  
**I want** um monorepo com pipeline de CI e endpoint de health,  
**so that** qualidade e deploy sejam reprodutíveis desde o primeiro dia.

### Acceptance Criteria

1. Monorepo **Turborepo** + **pnpm** workspaces com `apps/web` e `packages/shared` (mínimo) conforme `docs/architecture.md`.
2. CI (GitHub Actions) executa **lint**, **typecheck** e **build** em PR para `main`.
3. Existe rota ou handler **`/api/health`** (ou `/health`) público que devolve 200 e corpo mínimo (ex.: `{ "status": "ok" }`).
4. `README.md` na raiz descreve como instalar dependências e correr `pnpm dev`.
5. Branch default protegida com verificação obrigatória do CI *(documentada no README se ainda não aplicável por falta de remoto)*.

### Tasks / Subtasks

- [x] Inicializar workspace pnpm + `turbo.json` (AC: 1)
- [x] Configurar GitHub Actions workflow de CI (AC: 2)
- [x] Implementar health route no Next.js (AC: 3)
- [x] Documentar comandos locais (AC: 4)

### Dev Notes

- **Arquitetura:** `docs/architecture.md` — secções *Repository Structure*, *Unified Project Structure*, *Development Workflow*.
- **Stack:** Node LTS, TypeScript; sem inventar serviços além do descrito.
- **Testing:** smoke manual de **GET /api/health** (200 + JSON mínimo) obrigatório antes de marcar **Done**. Teste automatizado (Vitest/Playwright) **não** faz parte do âmbito obrigatório desta história; se for acrescentado mais tarde, deve validar explicitamente status e corpo (evitar “opcional” sem critério — DoR).

### Testing

- Correr CI localmente na raiz: `pnpm lint && pnpm typecheck && pnpm build` (equivalente ao workflow GitHub Actions).

### QA Results

**Revisor:** QA (Quinn) · **Data:** 2026-04-20  
**Âmbito:** Story **P01** (este ficheiro contém o backlog completo; apenas P01 foi implementada no código na data da revisão).

**Decisão de gate:** **PASS** (ressalvas menores abaixo).

#### Rastreio aos Acceptance Criteria (P01)

| AC | Resultado | Notas |
| -- | --------- | ----- |
| 1 | PASS | Monorepo com Turborepo (`turbo.json`), pnpm (`pnpm-workspace.yaml`, `packageManager`), `apps/web` e `packages/shared` (`@repo/shared`), alinhado a `docs/architecture.md`. |
| 2 | PASS | `.github/workflows/ci.yml` executa `pnpm lint`, `pnpm typecheck` e `pnpm build` em `pull_request` e `push` para `main`. |
| 3 | PASS | Rota `GET /api/health` em `apps/web/src/app/api/health/route.ts` devolve 200 e JSON com `status: "ok"` (campo extra `app` não viola o critério). |
| 4 | PASS | `README.md` na raiz documenta `pnpm install` e `pnpm dev`. |
| 5 | PASS | Proteção da branch default descrita no README, com nota adequada quando o remoto/GitHub ainda não aplica regra. |

#### Evidência (comandos na raiz do repositório)

- `pnpm lint` — concluído sem erros.
- `pnpm typecheck` — concluído sem erros.
- `pnpm build` — concluído com sucesso (inclui `/api/health` no output de rotas).

#### Ressalvas e risco

- **Gate de arquitetura:** O backlog indica **quality_gate: @architect**; esta revisão cobre testabilidade dos AC e pipeline, não substitui uma passagem explícita do architect sobre fronteiras de pacotes se ainda não existir.
- **Teste automatizado do health:** A story admite teste opcional; não há teste Vitest/Playwright dedicado — aceitável para P01, opcional registar como melhoria futura.
- **Restante do backlog (P02–P14):** Fora do âmbito desta revisão.

---

## P02 — Story 1.2: Autenticação de conta (registo, login, sessão)

**Status:** Draft  

**Dependências (DoR):** P01 concluída (**waived** pelo PO apenas se CI/monorepo já existir noutro ramo — documentar).

**Referências (DoR):** `docs/prd.md` (FR1, FR2); `docs/architecture.md` (*Authentication and Authorization*); `docs/front-end-spec.md` (fluxos auth e recuperação).

**Riscos (DoR):** Médio — segredos (`AUTH_SECRET`), hashing de passwords, anti-enumeração em reset; email transacional depende de provider (dev vs prod).

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** revisão de fluxo de auth, cookies HttpOnly, segredos em env

### Story

**As a** utilizador final,  
**I want** criar conta, iniciar sessão e terminar sessão com segurança,  
**so that** os meus dados de empresas fiquem isolados por conta (FR1, FR2).

### Acceptance Criteria

1. Fluxos de **registo**, **login** e **logout** funcionais com persistência de sessão segura (cookie ou mecanismo do Auth.js/Better Auth alinhado à arquitetura).
2. Palavras-passe armazenadas com algoritmo forte (argon2/bcrypt) e política mínima de complexidade documentada na UI.
3. **Recuperação de palavra-passe (FR1 — mínimo viável):** fluxo **solicitar reset** (email) + **página de definir nova senha** com token de uso único/expiração; mensagens genéricas que não confirmem se o email existe na base (anti-enumeração).
4. Rotas de autenticação não expõem detalhes internos em erros (mensagens genéricas).
5. Testes automatizados cobrem fluxo feliz, credenciais inválidas e **pelo menos um percurso de reset** (token válido vs inválido/expirado).

### Tasks / Subtasks

- [ ] Integrar Auth.js ou Better Auth + adapter DB (AC: 1–2)
- [ ] Páginas `/login`, `/register` (AC: 1)
- [ ] Fluxo forgot-password + email (provider dev/console em desenvolvimento documentado) + página reset (AC: 3)
- [ ] Middleware Next.js para sessão (preparação para P03) (AC: 1)
- [ ] Testes (AC: 5)

### Dev Notes

- **PRD:** FR1, FR2; **Arquitetura:** *Authentication and Authorization*, variáveis `AUTH_SECRET`, etc.
- **UX:** `docs/front-end-spec.md` — fluxo registo/login/recuperação; WCAG AA em formulários.

### Testing

- Vitest/Playwright conforme pirâmide em `docs/architecture.md` (*Testing Strategy*); cobrir AC 3 e 5.

---

## P03 — Story 1.3: Shell da aplicação autenticada e navegação

**Status:** Draft  

**Dependências (DoR):** P02 (sessão e rotas de auth funcionais).

**Referências (DoR):** `docs/prd.md` (Epic 1.3); `docs/front-end-spec.md` (*Site Map*, labels); `docs/architecture.md` (middleware / App Router).

**Riscos (DoR):** Baixo a médio — regressões de redirect e landmarks WCAG.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@ux-design-expert`
- **quality_gate_tools:** revisão rápida de navegação, landmarks, foco em erros (WCAG)

### Story

**As a** utilizador autenticado,  
**I want** um layout com navegação para Empresas, Agente e Conta,  
**so that** consiga usar o produto de forma orientada (PRD Epic 1.3 + IA UX).

### Acceptance Criteria

1. Layout com navegação primária: **Empresas**, **Agente**, **Conta**, **Sair** (labels conforme `docs/front-end-spec.md`).
2. Rotas sob grupo autenticado; utilizador não autenticado é redirecionado para `/login`.
3. Página placeholder de **Empresas** (vazia ou mensagem) até P06.
4. Landmarks semânticos: `header`, `main`, `nav` onde aplicável.

### Tasks / Subtasks

- [ ] `(app)` layout + sidebar/top nav com shadcn (AC: 1, 4)
- [ ] Middleware/guard de rotas (AC: 2)
- [ ] Rotas stub: `/empresas`, `/agente`, `/conta` (AC: 1, 3)

### Dev Notes

- **IA:** mapa de ecrãs em `docs/front-end-spec.md` (*Site Map*).
- **Componentes:** shadcn/ui + Tailwind (*front-end-spec*).

### Testing

- Playwright: utilizador não autenticado não acede a `/empresas`.

---

## P04 — Story 2.1: Modelo de dados e API REST de empresas

**Status:** Draft  

**Dependências (DoR):** P03 (grupo autenticado e identidade de conta disponível para `account_id`).

**Referências (DoR):** `docs/prd.md` (FR3–FR5, FR4); `docs/architecture.md` (*Data Models — Company*, *API Specification*, `ApiErrorBody`).

**Riscos (DoR):** Médio — validação CNPJ e unicidade; migrações em Neon/Postgres.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@data-engineer`
- **quality_gate_tools:** revisão de schema, unicidade `(account_id, cnpj_digits, system_code)`, índices

### Story

**As a** backend da aplicação,  
**I want** persistir empresas por conta com CNPJ validado e unicidade garantida,  
**so that** regras FR3–FR5, FR4 sejam aplicadas na origem.

### Acceptance Criteria

1. Tabela `companies` (ou equivalente) com `cnpj_digits` (14), `system_code`, `trade_name`, `active`, FK para `users`/conta.
2. Constraint **UNIQUE (account_id, cnpj_digits, system_code)**.
3. **POST /v1/companies** valida CNPJ (dígitos verificadores) e normaliza para 14 dígitos; **409** em duplicidade com mensagem clara.
4. **GET /v1/companies** lista paginada só da conta autenticada.
5. Migrações versionadas (Drizzle/Prisma — alinhar com implementação).
6. **Âmbito desta história:** **POST /v1/companies** persiste **apenas** `companies` (sem criar `jobs`). O **job imediato** e a **transação empresa + job** são **P08** — após merge de P08, o handler/serviço de criação deve ser **único** (evitar duas implementações divergentes de regra de negócio).

### Tasks / Subtasks

- [ ] Schema + migração (AC: 1–2, 5)
- [ ] Validação Zod + serviço de domínio CNPJ (AC: 3)
- [ ] Route handlers REST (AC: 3–4, 6)
- [ ] Testes de integração API (AC: 3–4)
- [ ] Comentário ou ADR curto no código a apontar P08 para extensão transacional (AC: 6)

### Dev Notes

- **PRD:** FR3, FR4, FR5; **Arquitetura:** *Data Models — Company*, *Database Schema*, *API Specification* (rotas companies).
- **Erros:** formato `ApiErrorBody` em `docs/architecture.md`.
- **P04 ↔ P08:** até P08 estar concluído, `lastJob` em listagens pode ser **null** após criação — esperado; P08 unifica criação com job.

### Testing

- Integração: criar, conflito 409, listagem vazia.

---

## P05 — Story 4.1: Jobs — modelo, estados e API de leitura

**Status:** Draft  

**Dependências (DoR):** P04 (empresas persistidas e API base).

**Referências (DoR):** `docs/prd.md` (FR15, FR16); `docs/architecture.md` (*Data Models — Job*); `docs/front-end-spec.md` (dashboard / colunas).

**Riscos (DoR):** Médio — contrato `lastJob` deve permanecer estável para P06; performance de agregação (evitar N+1).

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@data-engineer`
- **quality_gate_tools:** modelo `jobs`, enums, índices por `company_id` e `status`

### Story

**As a** operador,  
**I want** que cada coleta exista como job com estados claros e histórico consultável,  
**so that** possa ver última execução e erros (FR15, FR16).

### Acceptance Criteria

1. Tabela `jobs` com `status` (`pending`, `running`, `success`, `failed`, `cancelled`), `type`, timestamps, `attempt_count`, `next_retry_at`, `error_message_public`, `idempotency_key` único.
2. **GET /v1/companies/:id/jobs** paginado; resposta adequada se empresa não pertencer à conta (**404**).
3. **Contrato fixo para “última execução” no dashboard (sem ambiguidade):** **GET /v1/companies** devolve, para cada empresa, o objeto **`lastJob`** embutido com: `id`, `status`, `finishedAt` (nullable), `errorMessagePublic` (nullable), `updatedAt` (última transição útil). Sem `lastJob` quando não existir nenhum job — nesse caso o cliente UI trata como “sem execuções”. Documentar o JSON no README da API ou OpenAPI mínimo.
4. Estados e mensagens públicas **não** expõem segredos nem stack traces (NFR2).

### Tasks / Subtasks

- [ ] Migração `jobs` + FK `company_id` (AC: 1)
- [ ] Serviço de listagem + autorização por conta (AC: 2)
- [ ] Implementar agregação `lastJob` na listagem **GET /v1/companies** (subquery ou join lateral; uma query por página evitando N+1) (AC: 3)
- [ ] Testes integração: lista com 0 jobs; com 1 job; empresa alheia 404 em jobs (AC: 2–4)

### Dev Notes

- **PRD:** Epic 4 Story 4.1; **Arquitetura:** *Data Models — Job*, DDL exemplo.
- **UX:** colunas da tabela em `docs/front-end-spec.md` (dashboard).

### Testing

- Criar job manualmente em seed ou teste para validar listagem.

---

## P06 — Story 2.2: UI — lista e criação de empresas

**Status:** Draft  

**Dependências (DoR):** P04 e P05 (API empresas + `lastJob`).

**Referências (DoR):** `docs/prd.md` (FR16, FR3); `docs/front-end-spec.md` (*Dashboard*, *Wireframes*).

**Riscos (DoR):** Médio — polling condicional e UX de estados `pending`/`running`; alinhamento com P08 quando job imediato existir.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@ux-design-expert`
- **quality_gate_tools:** WCAG AA em tabela/form, mensagens de erro

### Story

**As a** utilizador,  
**I want** listar e criar empresas com validação de CNPJ,  
**so that** configure fontes de NF com feedback imediato (FR16, FR3).

### Acceptance Criteria

1. Dashboard **Empresas** com tabela: CNPJ mascarado, nome fantasia, código do sistema, estado ativo/inativo, **última execução** mapeada a partir de **`lastJob`** retornado por **GET /v1/companies** (P05 — badge + data/estado coerentes).
2. Formulário criar empresa com validação inline de CNPJ; erro **409** mapeado para mensagem humana.
3. **TanStack Query — critérios binários:** (a) **refetch ao focar a janela** (`refetchOnWindowFocus: true` ou equivalente); (b) **sem polling** por defeito; (c) se existir **alguma** linha com `lastJob.status` em `pending` ou `running`, ativar **polling a cada ≤ 30 s** para a query da lista até deixar de haver esses estados **ou** após **5 minutos** (timeout de segurança — documentar constante no código).
4. Empty state com CTA quando não há empresas.

### Tasks / Subtasks

- [ ] Componente tabela + badges de estado (AC: 1)
- [ ] Modal ou página `/empresas/nova` (AC: 2, 4)
- [ ] Integração API P04/P05 + lógica de polling condicional (AC: 1–3)

### Dev Notes

- **front-end-spec:** *Dashboard*, *Wireframes*, *Component Library* (DataTable, Badge).
- **PRD:** FR16, FR3, FR4.
- **P08:** após criação com job, o refetch/polling deve refletir novos estados de `lastJob`.

### Testing

- Playwright: criar empresa válida; duplicado mostra erro.

---

## P14 — Story (transversal): LGPD mínimo, auditoria append-only e rate limit

**Status:** Draft  

**Dependências (DoR):** P02, P03 concluídos. **Ordem de implementação:** executar **imediatamente após P06** (antes de P07 e P10) — ver tabela de priorização; não bloquear P04–P06.

**Referências (DoR):** `docs/prd.md` (NFR3, NFR4); `docs/architecture.md` (*Security*, Redis/Upstash, auditoria).

**Riscos (DoR):** Alto impacto legal/UX — texto `/privacidade` revisável pelo PO; headers e rate limit podem afetar integrações e testes e2e.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** modelo de auditoria, headers de segurança base, política de retenção mínima

### Story

**As a** responsável pelo produto,  
**I want** base mínima de privacidade, trilho de auditoria e proteção contra abuso em autenticação,  
**so that** NFR3 e NFR4 sejam endereçados no MVP sem bloquear histórias de negócio (P07, P10).

### Acceptance Criteria

1. **Página pública `/privacidade`** com texto de política de privacidade (MVP: Markdown estático ou TSX) referindo finalidade dos dados, base legal genérica, contacto para pedidos e retenção em linhas gerais; link acessível no **rodapé** do layout autenticado e, se aplicável, nas páginas públicas de auth.
2. Tabela **`audit_events`** (ou equivalente) com `id`, `account_id`, `actor_user_id`, `action` (enum string: `company.deactivated`, `agent.paired`, `agent.revoked`, extensível), `metadata` (jsonb), `created_at`; **INSERT apenas** (sem UPDATE) em código de aplicação.
3. Função ou serviço **`recordAudit(...)`** centralizado; testes unitários mínimos garantem que chamadas válidas persistem uma linha.
4. **Rate limiting** em **POST /login**, **POST /register** e **POST de solicitação de reset de password** (ex.: Redis/Upstash por IP + email hash): limite documentado (ex.: 10/min/IP em login) e resposta **429** com corpo de erro padrão — alinhado a `docs/architecture.md` (Redis).
5. Nenhum segredo ou token completo em `metadata` de auditoria (NFR2).
6. **Headers de segurança HTTP (baseline):** em **produção**, respostas HTML da app incluem **HSTS** (`Strict-Transport-Security` com `max-age` ≥ 1 ano, incluir `includeSubDomains` se domínio único), **`X-Content-Type-Options: nosniff`**, **`Referrer-Policy`** (ex.: `strict-origin-when-cross-origin`). **CSP:** política inicial em **report-only** (`Content-Security-Policy-Report-Only`) **ou** política restritiva mínima documentada — o ficheiro `next.config`/middleware e uma secção **“Segurança”** no README listam os headers; **@architect** valida no quality gate.

### Tasks / Subtasks

- [ ] Migração `audit_events` + índice por `account_id`, `created_at` (AC: 2)
- [ ] Página `/privacidade` + link rodapé layout P03 (AC: 1)
- [ ] Helper `recordAudit` + testes (AC: 3)
- [ ] Middleware ou wrapper rate limit rotas auth (AC: 4)
- [ ] Documentar limites no README (AC: 4)
- [ ] Configurar headers segurança + README (AC: 6)

### Dev Notes

- **PRD:** NFR3, NFR4; **Arquitetura:** *Security*, Redis, *Audit*, *Security and Performance*.
- **Consumidores:** P07 chama `recordAudit` em desativar; P10 em pairing completo e revogação.

### Testing

- Teste: inserção audit; teste: 429 após N tentativas (pode usar teste de integração com limite baixo em env de teste).
- Verificação manual ou e2e: resposta principal em `NODE_ENV=production` (ou preview) contém headers AC 6 (pode assert em teste de integração Next se disponível).

---

## P07 — Story 2.3: UI — detalhe, edição e desativação

**Status:** Draft  

**Dependências (DoR):** P06; **P14** obrigatória (auditoria `recordAudit`, rodapé com `/privacidade`, headers baseline aplicáveis).

**Referências (DoR):** `docs/prd.md` (FR17); `docs/front-end-spec.md` (detalhe, fluxo desativar).

**Riscos (DoR):** Médio — fluxo destrutivo (desativar); cópia de agendamento mensal dependente de P12 (AC 5 já prevê fallback).

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@ux-design-expert`
- **quality_gate_tools:** modal de confirmação desativar, foco e `aria-live`

### Story

**As a** utilizador,  
**I want** ver detalhe da empresa, editar campos permitidos e desativar com confirmação,  
**so that** pare agendamentos futuros sem perder histórico (FR17).

### Acceptance Criteria

1. Página detalhe com dados cadastrais e secção **histórico de execuções** (lista vinda de P05).
2. Editar nome fantasia e código do sistema quando não houver conflito; validação server-side.
3. **Desativar** abre modal de confirmação; após confirmar, `active=false` e UI mostra “Inativa”.
4. Ao concluir desativação com sucesso, **regista evento de auditoria** `company.deactivated` via `recordAudit` (P14), com `company_id` em `metadata`.
5. Copy sobre **próximo job mensal** (dia 1, 06:00, America/São_Paulo) — texto estático ou dados de P12 quando existirem; se P12 ainda não estiver fechado, mostrar aviso “agendamento mensal será ativado quando o serviço estiver disponível” **ou** apenas o texto fixo do PRD (escolha documentada no PR).

### Tasks / Subtasks

- [ ] Rota `/empresas/[id]` (AC: 1)
- [ ] PATCH integração + conflitos (AC: 2)
- [ ] Modal desativar + chamada `recordAudit` no handler (AC: 3–4)
- [ ] Copy próximo job mensal conforme AC 5 (AC: 5)

### Dev Notes

- **PRD:** FR17; **UX:** *Detalhe da empresa*, *Fluxo desativar*. **P14** obrigatório para AC 4.

### Testing

- Playwright: desativar e ver estado na lista.

---

## P08 — Story 4.2: Enfileirar job imediato ao criar empresa

**Status:** Draft  

**Dependências (DoR):** P05, P06 (fluxo de criação na UI e contrato `lastJob`); base P04 para **POST /v1/companies**.

**Referências (DoR):** `docs/prd.md` (FR9); `docs/architecture.md` (*Core Workflows — Cadastro de empresa*); alinhar com notas P04↔P08 em P04.

**Riscos (DoR):** Alto — transação empresa+job; idempotência e retries do cliente; deve substituir caminho único do handler P04.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** idempotência, transação criação empresa + job, erros visíveis

### Story

**As a** sistema,  
**I want** criar um job `immediate` em estado `pending` quando uma empresa é criada com sucesso,  
**so that** a coleta assíncrona dispare conforme FR9.

### Acceptance Criteria

1. Na criação de empresa via API, cria-se também um `job` do tipo `immediate` com `idempotency_key` **determinística** por empresa+tipo: ex. `immediate:{company_id}` **após** o `company.id` existir (evita duplicados em retries do cliente).
2. **Política transacional (decisão MVP — binária):** **uma única transação de base de dados** que faz **INSERT em `companies` + INSERT em `jobs`**. Se o INSERT do job falhar, **rollback** da empresa e API devolve **5xx/409 conforme caso** com mensagem genérica; **não** persistir empresa sem job neste fluxo.
3. Resposta **201** de **POST /v1/companies** inclui `company` **e** `lastJob` (ou `job` aninhado) coerente com o contrato P05 para o cliente atualizar a linha na lista (P06).
4. Testes de integração cobrem: sucesso com job; falha simulada no segundo INSERT provoca rollback (empresa não listada).

### Tasks / Subtasks

- [ ] Transação única empresa+job + chave idempotência (AC: 1–2)
- [ ] Ajustar payload de resposta 201 (AC: 3)
- [ ] Testes rollback e idempotência (AC: 4)

### Dev Notes

- **PRD:** FR9; **Arquitetura:** *Core Workflows — Cadastro de empresa*, *Job Orchestrator*.
- **P04:** substitui/estende o handler de **POST /v1/companies** definido em P04 (AC 6 — antes só `companies`; aqui transação + job).
- Conflito com retry do cliente: documentar comportamento se **POST** repetido com mesmo payload (idempotency header futuro — fora do MVP).

### Testing

- Integração: POST company → job `immediate` existe; simulação falha job → empresa não criada.

---

## P09 — Story 3.1: Agente desktop — distribuição e pasta raiz

**Status:** Draft  

**Dependências (DoR):** P01 (monorepo com slot para `apps/agent-desktop` ou equivalente documentado).

**Referências (DoR):** `docs/prd.md` (FR6, FR7); `docs/architecture.md` (*Unified Project Structure*, agente desktop).

**Riscos (DoR):** Médio — distribuição Windows, paths locais e permissões.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** segurança de paths locais, permissões de escrita

### Story

**As a** utilizador Windows,  
**I want** instalar o agente e escolher a pasta raiz onde as NF serão organizadas,  
**so that** cumpra FR7 e a convenção de pastas (PRD FR6).

### Acceptance Criteria

1. Pacote instalável ou executável documentado para **Windows** (Tauri/Electron conforme decisão em `docs/architecture.md`).
2. Fluxo de seleção de diretório com validação de **escrita**; persistência local segura das preferências.
3. README do pacote `apps/agent-desktop` com passos de build e instalação.

### Tasks / Subtasks

- [ ] Scaffolding app desktop (AC: 1)
- [ ] UI mínima seleção pasta + teste escrita (AC: 2)
- [ ] Documentação (AC: 3)

### Dev Notes

- **PRD:** Epic 3 Story 3.1; **Arquitetura:** *Unified Project Structure* (`apps/agent-desktop`).

### Testing

- Teste manual em Windows; teste automatizado de filesystem se viável (pasta temp).

---

## P10 — Story 3.2: Agente — pairing seguro com a conta

**Status:** Draft  

**Dependências (DoR):** P02, P09; **P14** (auditoria, rate limit em rotas sensíveis, headers onde aplicável).

**Referências (DoR):** `docs/prd.md` (FR8, NFR4); `docs/architecture.md` (*Data Models* pairing/device, *API Specification*).

**Riscos (DoR):** Alto — superfície de ataque em códigos de pairing e tokens; dependência de TLS e armazenamento de hashes.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** expiração de código, revogação, TLS para API de pairing

### Story

**As a** utilizador,  
**I want** emparelhar o agente à minha conta com um código de curta duração,  
**so that** apenas o meu dispositivo execute comandos (FR8, NFR4).

### Acceptance Criteria

1. **POST /v1/agent/pairing** gera código com TTL (ex.: 10 min); armazenar **hash** do código no servidor (nunca o código em claro após o request inicial).
2. Agente submete código e recebe **device token** renovável; servidor regista `agent_devices`.
3. UI web **Agente** mostra código, countdown e estado **conectado/desconectado** (conforme UX spec).
4. Revogação: flag `revoked_at` + rejeição no próximo comando/autenticação; **regista auditoria** `agent.revoked` (P14).
5. Após pairing bem-sucedido, **regista auditoria** `agent.paired` com `device_id` em `metadata` (sem segredos).
6. Endpoint de geração de código sujeito a **rate limit** (P14) por utilizador/IP para mitigar brute-force.

### Tasks / Subtasks

- [ ] Tabelas `pairing_sessions` / `agent_devices` + migrações (AC: 1–2, 4)
- [ ] UI página `/agente` (AC: 3)
- [ ] Fluxo no agente para inserir código (AC: 2)
- [ ] Integrar `recordAudit` nos fluxos pairing/revogação (AC: 4–5)

### Dev Notes

- **Arquitetura:** *Data Models* (PairingSession, AgentDevice), *API Specification*, rotas agent.
- **UX:** *Área Agente e downloads*.

### Testing

- Integração: código expirado falha; reuso inválido; verificar linhas em `audit_events` para paired/revoked; 429 em burst de POST pairing (se testável).

---

## P11 — Story 3.3: Agente — canal, comandos e gravação em disco

**Status:** Draft  

**Dependências (DoR):** P08 (jobs e fila coerentes), P10 (device token e auditoria base).

**Referências (DoR):** `docs/prd.md` (FR6, FR12, FR13); `docs/architecture.md` (*Agente — protocolo mínimo*, *Core Workflows*).

**Riscos (DoR):** Alto — WebSocket/canal long-lived, path traversal, logs sem segredos (NFR2).

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** contrato `AgentEnvelopeV1`, path traversal, logs sem segredos

### Story

**As a** sistema,  
**I want** o agente a receber comandos versionados e gravar ficheiros em `{raiz}/{14 dígitos}/{sanitized_system_code}/`,  
**so that** FR6 e FR13 sejam cumpridos.

### Acceptance Criteria

1. WebSocket (ou transporte definido) autenticado com device token; mensagens conforme `AgentEnvelopeV1` em `docs/architecture.md`.
2. Agente cria árvore de pastas de forma idempotente e trata erros de disco (sem espaço, permissão) reportando ao backend.
3. Worker/orquestrador associa jobs `pending` a agente online quando disponível; atualiza estado do job.
4. Caminhos validados contra **path traversal**; `system_code` sanitizado.

### Tasks / Subtasks

- [ ] Serviço WS no Next ou serviço dedicado (AC: 1)
- [ ] Lógica filesystem no agente (AC: 2, 4)
- [ ] Integração worker ↔ fila ↔ agente (AC: 3)

### Dev Notes

- **Arquitetura:** *Agente — protocolo mínimo*, diagramas *Core Workflows*.
- **PRD:** FR6, FR12, FR13.

### Testing

- Teste integração com agente mock ou ambiente controlado; unitários sanitização path.

---

## P12 — Story 4.3: Agendamento mensal (dia 1, 06:00 SP) e retries

**Status:** Draft  

**Dependências (DoR):** P05 (modelo `jobs` e retries), P11 (agente executa trabalho).

**Referências (DoR):** `docs/prd.md` (FR10–FR12); `docs/architecture.md` (*Deployment*, `CRON_SECRET`).

**Riscos (DoR):** Médio a alto — fuso `America/São_Paulo`, idempotência mensal, Vercel Cron/segredo.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** timezone, idempotência por mês, backoff NFR9

### Story

**As a** utilizador,  
**I want** jobs mensais no dia 1 às 06:00 (America/São_Paulo) com retentativas se o agente estiver offline,  
**so that** FR10, FR11, FR12 e NFR9 sejam satisfeitos.

### Acceptance Criteria

1. Scheduler cria jobs `scheduled_monthly` para cada empresa **ativa** com chave idempotente por empresa + período `YYYY-MM`.
2. Jobs ficam `pending` se não houver agente; **next_retry_at** com backoff exponencial até **7 dias** após a data agendada (configurável).
3. Após esgotar retries, `failed` com mensagem pública orientativa (PRD Epic 4.3).
4. Cron protegido por secret (`CRON_SECRET`) ou equivalente.

### Tasks / Subtasks

- [ ] Job scheduler (Vercel Cron + handler ou worker) (AC: 1, 4)
- [ ] Lógica retry + limites (AC: 2–3)
- [ ] Testes de fuso com biblioteca TZ (AC: 1)

### Dev Notes

- **PRD:** FR10–FR12; **Arquitetura:** *Deployment*, env `CRON_SECRET`.

### Testing

- Testes unitários do cálculo de `next_retry_at` e idempotência mensal.

---

## P13 — Story 4.4: Conector MVP (stub ou integração única)

**Status:** Draft  

**Dependências (DoR):** P11 (pipeline agente/job até gravação).

**Referências (DoR):** `docs/prd.md` (FR14, risco R1); `docs/architecture.md` (*Connector Service*).

**Riscos (DoR):** Médio — dependência de sistemas externos; stub deve ser explicitamente “não produção” se aplicável.

**Executor Assignment**

- **executor:** `@dev`
- **quality_gate:** `@architect`
- **quality_gate_tools:** isolamento de segredos, interface conector plugável

### Story

**As a** produto,  
**I want** pelo menos uma implementação de conector roteada por `system_code`,  
**so that** FR14 seja demonstrável ponta a ponta.

### Acceptance Criteria

1. Interface interna `Connector` com método `execute(job, context)` (nomes ajustáveis) e registo por `connectorKey`.
2. Implementação **MVP** pode ser **no-op** que grava ficheiro placeholder ou integra ambiente de homologação — documentado em `docs/` ou README do conector.
3. Campo `system_code` do utilizador determina o conector usado (mapeamento simples inicial).
4. Nenhum segredo em logs (NFR2).

### Tasks / Subtasks

- [ ] Abstração conector + implementação stub (AC: 1–2)
- [ ] Wiring no worker (AC: 3–4)
- [ ] Documentação limitações conhecidas (AC: 2)

### Dev Notes

- **PRD:** FR14, Risco R1 (dependência de fontes externas).
- **Arquitetura:** *Connector Service*, *External APIs*.

### Testing

- Job `success` com stub; teste que verifica ausência de segredos em logs.

---

## CodeRabbit / qualidade (projeto)

> Integração CodeRabbit: assumir **revisão manual** até `coderabbit_integration.enabled` estar ativo em `.aios-core/core-config.yaml`.  
> Para cada PR: executar checklist de story e pedir revisão a `@architect` em histórias com impacto transversal (P01, P08, P11, P12).

---

## Change Log

| Date       | Version | Description                                                                 | Author   |
| ---------- | ------- | ----------------------------------------------------------------------------- | -------- |
| 2026-04-20 | 0.1     | Backlog MVP priorizado inicial                                              | SM AIOS  |
| 2026-04-20 | 0.2     | Matriz FR/NFR, DoR, P14 compliance/auditoria/rate limit; AC binários P02/P05/P08; P07/P10 com auditoria; ordem P14 antes P07/P10 | SM AIOS  |
| 2026-04-20 | 0.3     | PO: P04 AC6 + Dev Notes P04↔P08; P06 AC3 polling binário; P14 AC6 headers; índice artefactos | SM AIOS  |
| 2026-04-20 | 0.4     | DoR/PO: ciclo de vida e checklist por história; Dependências/Referências/Riscos (DoR) em P01–P14; P01 critérios de teste sem “opcional” ambíguo; P01 Testing alinhado ao CI (typecheck) | Backlog |

---

— River, a facilitar o fluxo até ao MVP 🌊
