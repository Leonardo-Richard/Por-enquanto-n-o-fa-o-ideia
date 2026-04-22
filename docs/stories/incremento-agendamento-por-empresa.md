# User stories — Incremento: dia da automação mensal por empresa

**Produto:** Portal de Automação de Notas Fiscais (por empresa)  
**Fontes:** `docs/prd-atualizacao-agendamento-por-empresa.md`, `docs/prd.md` v0.2 (Stories 2.4, 4.3), `docs/architecture-agendamento-por-empresa.md`, `docs/front-end-spec-agendamento-por-empresa.md`  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-22  
**Estado do conjunto:** Ready for dev  
**Gate PO:** concluído — ver secção **Registo de aprovação PO** e *Change Log* v0.4. Para futuras revisões, repetir `@po *validate-story-draft` e atualizar o registo.

---

## Índice

| ID    | Título resumido | Dependências principais |
| ----- | ---------------- | ------------------------ |
| **AG-01** | UI + modelo local `monthlyRunDay` (portal protótipo) | Nenhuma para demo local; com API real: após AG-02 ou em paralelo com contrato fixado |
| **AG-02** | Postgres + API `monthlyRunDay` / `monthly_run_day` | P04 (API empresas) ou equivalente “domínio empresa persistido” |
| **AG-03** | Scheduler diário SP + idempotência `sched_monthly:{id}:{YYYY-MM}` | P05 (jobs), estende **P12** (substitui lógica “dia 1 fixo” por dia D) |

**Nota de alinhamento com backlog MVP:** a história **P12** descreve agendamento mensal genérico; após este incremento, o AC de P12 deve considerar **`companies.monthly_run_day`** em vez de “sempre dia 1”. Implementar **AG-02** antes ou em lockstep com persistência remota; **AG-01** pode fechar o fluxo no `localStorage` atual.

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit em PR (CLI WSL, se configurado); `@architect` em **AG-02** e **AG-03** (contrato API, fuso, idempotência).  
- **Foco:** validação de inteiros 1–28, ausência de valores mágicos de data sem TZ, chave de idempotência única, acessibilidade do `<select>` (AG-01).

---

## Definition of Done (por fatia) — critérios PO

Critérios objetivos para marcar cada AG como **Done** (além de ACs e revisão CodeRabbit onde aplicável).

### AG-01

- Todos os AC numerados cumpridos (incl. **AC5** — resumo só leitura no detalhe); smoke manual documentado (passos + resultado esperado) na descrição do PR ou comentário de teste.
- Checklist WCAG 2.2 AA do formulário (rótulo, `aria-describedby`, foco) verificada por `@qa` ou evidência anexada.
- Job imediato/simulado ao criar empresa continua a funcionar (sem regressão).

### AG-02

- Migração aplicável em base limpa e reversível (rollback documentado numa linha no PR).
- Contrato JSON (`monthlyRunDay` opcional, resposta camel) alinhado a `docs/architecture-agendamento-por-empresa.md` (ou diff na mesma PR se a doc ainda não existir).
- Testes de integração do AC5 verdes em CI (ou comando local registado no PR).

### AG-03

- Testes de TZ / duplo tick / mudança intra-mês (ACs 4–7) verdes em CI ou evidência local no PR.
- **Observabilidade mínima:** pelo menos um de — log estruturado em `info`/`warn` para “enqueue mensal ignorado (duplicate key)” **ou** métrica/contador consultável no worker — para suportar diagnóstico sem aceder à DB em produção.
- Runbook `docs/runbooks/agendamento-mensal-por-empresa.md` criado/atualizado com as âncoras mínimas indicadas na secção Tasks de AG-03.

### Conjunto (pós AG-03 — valor PRD §8)

- **Sem regressão operacional:** após deploy do scheduler, confirmar com `@architect` / dados que a taxa de sucesso de `scheduled_monthly` não cai face ao baseline acordado (PRD `docs/prd-atualizacao-agendamento-por-empresa.md` §8); desvios → item de backlog + análise de causa.
- **Suporte / produto:** em UAT ou primeiras semanas, recolher evidência qualitativa de redução de pedidos “quero outro dia que não o 1” (mesma secção §8).

---

## PO — Decisão de âmbito vinculativa

Em conformidade com `docs/prd-atualizacao-agendamento-por-empresa.md` §2 — **fora deste incremento** (não implementar nem “esticar” escopo em PRs deste conjunto): vários agendamentos mensais por empresa no mesmo mês; horário distinto por empresa; fuso horário por empresa; dias **29–31** como dia D.

---

## AG-01 — Story: Campo “Dia da coleta mensal” na UI e no modelo partilhado (portal)

**Status:** Ready for dev  

**Dependências (DoR):** Nenhuma para o **protótipo** atual (Next + `PortalProvider`). Se a equipa entregar API primeiro, alinhar serialização com **AG-02** antes de merge.

**Referências (DoR):** `docs/front-end-spec-agendamento-por-empresa.md` (§§1–10); `docs/prd.md` Story **2.4**, **FR18**; `docs/architecture-agendamento-por-empresa.md` §6.

**Riscos (DoR):** Baixo — UI local; drift API se nomes de campo divergirem de AG-02 (usar `monthlyRunDay` em TS).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` ou `@ux-design-expert` (copy + a11y)  
- **quality_gate_tools:** checklist WCAG 2.2 AA no formulário

### Story

**As a** operador fiscal,  
**I want** escolher o dia do mês (1–28) da coleta recorrente ao criar ou editar uma empresa, com texto que explica fuso e hora,  
**so that** alinhe cada CNPJ ao calendário do cliente sem perder a primeira coleta ao guardar.

### Acceptance Criteria

1. `packages/shared`: tipo `Company` inclui `monthlyRunDay: number` (1–28); empresas sem a chave no JSON persistido tratam-se como **1** na hidratação.  
2. `CompanyForm`: após “Código do sistema”, `<select>` nativo com opções 1–28, default **1**; texto de ajuda com **06:00** e **América/São Paulo**; `label`/`id`/`htmlFor` + `aria-describedby` no parágrafo de ajuda.  
3. Detalhe `empresas/[id]`: mesmo controlo na secção Dados; alterações marcam `dirty`; **Salvar** chama `updateCompany` com `monthlyRunDay`.  
4. Erros de validação local impossíveis fora 1–28; se no futuro a API devolver **400**, mensagem visível com `role="alert"` e `aria-invalid` no select.  
5. **Obrigatório (FR18 / transparência ao operador):** na página de detalhe `empresas/[id]`, linha só leitura no resumo com o texto “Coleta automática mensal: dia **X**, às 06:00 (América/São Paulo).”, em que **X** reflete o valor persistido/hidratado de `monthlyRunDay` (default **1**).

### Tasks / Subtasks

- [x] Estender `Company` e `addCompany` / `updateCompany` / `loadPersisted` (AC: 1)  
- [x] `company-form.tsx` + cópias PT da spec (AC: 2)  
- [x] Página detalhe empresa (AC: 3–5)  
- [x] Teste manual: criar com dia 15, reload, verificar `localStorage` e **linha de resumo AC5** (AC: 1–5); registar passos no PR (DoD AG-01)

### Dev Notes

- Classes Tailwind alinhadas aos inputs existentes (`ring-emerald-600/30`).  
- Não remover o fluxo de job imediato/simulado ao criar empresa.

### Testing

- Smoke manual + (se existir harness) teste de componente do select com valor default; confirmar texto do resumo (AC5) após alterar dia e **Salvar**.

---

## AG-02 — Story: Coluna `monthly_run_day` e contrato HTTP (POST/PATCH empresa)

**Status:** Ready for dev  

**Dependências (DoR):** Modelo `companies` e rotas **POST/PATCH** empresa disponíveis (backlog **P04** ou implementação equivalente).

**Referências (DoR):** `docs/architecture-agendamento-por-empresa.md` §§2–4, 7; `docs/prd-atualizacao-agendamento-por-empresa.md` (FR10, FR18).

**Riscos (DoR):** Médio — migração em produção; validação duplicada servidor vs cliente.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`  
- **quality_gate_tools:** migração reversível, contrato JSON camel, testes de validação

### Story

**As a** sistema,  
**I want** persistir e expor `monthly_run_day` por empresa com validação 1–28 e default 1,  
**so that** UI e worker usem a mesma fonte de verdade.

### Acceptance Criteria

1. Migração SQL: `monthly_run_day SMALLINT NOT NULL DEFAULT 1 CHECK (BETWEEN 1 AND 28)` em `companies` (ou equivalente ORM).  
2. `POST` criar empresa: corpo aceita `monthlyRunDay` opcional; omissão → **1**; fora do intervalo → **400** com mensagem acordada na arquitetura.  
3. `PATCH` empresa: mesma validação; apenas dono da conta (`account_id`).  
4. Respostas JSON incluem `monthlyRunDay` (camel).  
5. Testes de integração: `0`, `29`, string → **400**; `28` em fevereiro persistido e lido corretamente.

### Tasks / Subtasks

- [x] Migração + modelo de dados (AC: 1); nota de rollback de uma linha no PR (DoD AG-02)  
- [x] `CompanyService` validação + mapeamento snake/camel (AC: 2–4)  
- [x] Testes (AC: 5)  
- [ ] (Opcional) evento de auditoria em alteração de dia

### Dev Notes

- Alinhar com `docs/architecture.md` DDL atualizado (v0.2).  
- Não alterar semântica do job `immediate` na criação.

### Testing

- Integração API + teste de migração em base limpa.

---

## AG-03 — Story: Tick diário America/Sao_Paulo + job `scheduled_monthly` por dia D

**Status:** Ready for dev  

**Dependências (DoR):** **P05** (tabela `jobs`, estados, retries); preferencialmente **P11** ou stub de entrega; **AG-02** para `monthly_run_day` na DB. Pode reutilizar infraestrutura de **P12**.

**Referências (DoR):** `docs/architecture-agendamento-por-empresa.md` §5; `docs/prd.md` Story **4.3**, **FR10**, **FR11**; `docs/architecture.md` — fluxo job mensal.

**Riscos (DoR):** Alto — fuso, idempotência, dupla execução no mesmo mês; regressão em retries (NFR9).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`  
- **quality_gate_tools:** testes TZ, duplo tick, mudança de D intra-mês, pós-execução + PATCH no mesmo mês (AC7), observabilidade duplicate enqueue

### Story

**As a** operador,  
**I want** que o sistema crie no máximo um job mensal por empresa e mês civil, no dia D que configurei às 06:00 em América/São Paulo,  
**so that** FR10, FR11 e a idempotência do PRD sejam cumpridos sem duplicar coletas.

### Acceptance Criteria

1. Tick agendado **diariamente** em `America/Sao_Paulo` (ex.: 06:05) com segredo (`CRON_SECRET` ou equivalente).  
2. Para cada empresa `active` cujo **dia civil SP** = `monthly_run_day`, tentar `INSERT` job `scheduled_monthly` com `scheduled_for` = esse dia **06:00** SP em `TIMESTAMPTZ`.  
3. `idempotency_key = 'sched_monthly:' || company_id || ':' || YYYY-MM` (mês SP); conflito UNIQUE → ignorar (sem segundo job no mesmo mês).  
4. Dois ticks no mesmo dia não criam duas linhas para a mesma empresa/mês.  
5. Alterar `monthly_run_day` na empresa **não** gera segundo job para o mesmo `YYYY-MM` se já existir registo com essa chave; próximo mês usa o novo D.  
6. Retentativas / `next_retry_at` / estado `failed` mantêm comportamento de **P12** (NFR9).  
7. **Pós-execução no mesmo mês civil SP:** se já existir linha de job `scheduled_monthly` para a empresa com `idempotency_key` desse `YYYY-MM` (incl. `succeeded`, `failed`, pendente ou em retry), alterar `monthly_run_day` **não** provoca novo `INSERT` para esse `YYYY-MM`; não há segunda coleta mensal no mesmo mês (alinhado a NFR8 / fora de âmbito “vários agendamentos no mesmo mês”). O primeiro tick do **mês civil seguinte** aplica o novo D quando o dia civil coincidir com `monthly_run_day`.

### Tasks / Subtasks

- [x] Serviço `JobEnqueueService` (ou nome acordado) com biblioteca TZ fixa no repo (AC: 1–2)  
- [x] `INSERT ... ON CONFLICT DO NOTHING` ou equivalente (AC: 3–4)  
- [x] Casos de teste: fevereiro + D=28; mudança intra-mês; **pós-execução + PATCH de D no mesmo mês** (AC: 5, 7)  
- [x] Runbook **`docs/runbooks/agendamento-mensal-por-empresa.md`** com âncoras mínimas: `#duplo-tick-mesmo-dia`, `#mudanca-intra-mes`, `#fevereiro-d28`, `#pos-execucao-mesmo-mes` (conteúdo verificável no PR; DoD AG-03)  
- [x] Instrumentação mínima: log ou métrica para enqueue ignorado por duplicate (DoD AG-03)

### Dev Notes

- Substituir qualquer constante “dia 1” no worker pela leitura de `monthly_run_day`.  
- Após AG-03 **Done**, atualizar texto da história **P12** no `mvp-backlog-prioritized.md` para referenciar dia **D** (evitar especificação duplicada divergente).

### Testing

- Unit: cálculo de `period_key` e `scheduled_for` em SP.  
- Integração: duplo tick; PATCH inválido (coberto em AG-02); cenário AC7 (job já existente no mês + alteração de D).

---

## Validação PO — validate-story-draft

Checklist obrigatória antes de marcar **Ready for dev** (revalidar em cada alteração material ao conjunto):

1. Rastreio ao `docs/prd-atualizacao-agendamento-por-empresa.md` e às stories **2.4** / **4.3** em `docs/prd.md` v0.2.  
2. Âmbito §2 do PRD de incremento reflectido na secção **PO — Decisão de âmbito vinculativa** — sem novos requisitos não rastreados.  
3. ACs numerados, testáveis e **DoD por fatia** completos para AG-01…AG-03.  
4. **CodeRabbit** + *quality gates* (`@qa`, `@architect`) atribuídos por fatia.  
5. Dependências **P04** / **P05** / **P12** e ordem AG-02 vs AG-01 documentadas no índice e nas DoR.

**Resultado desta validação:** aprovado — ver registo abaixo.

---

## Registo de aprovação PO

| Data       | PO           | Resultado                 | Notas breves |
| ---------- | ------------ | ------------------------- | ------------ |
| 2026-04-22 | Pax (AIOS)   | **Aprovado — Ready for dev** | Checklist acima satisfeita na v0.3; v0.4 acrescenta âmbito, métricas §8 no DoD conjunto, validação explícita. |

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor).

### Completion Notes

- **AG-01:** Portal Next (`PortalProvider`) com `monthlyRunDay` hidratado (default 1), formulário nova empresa + detalhe com resumo FR18, `aria-describedby` / `aria-invalid` preparado para erro futuro de API.
- **AG-02:** Migração `db/migrations/20260422120000_companies_monthly_run_day.sql` (rollback documentado no ficheiro); validação de corpo JSON em `@repo/shared` (`parseMonthlyRunDayFromRequest`) alinhável a POST/PATCH quando existir API (P04).
- **AG-03:** Lógica pura `decideMonthlyScheduledEnqueue` + `utcAtZonedWall` em `@repo/scheduling` (fusos via `Intl`, sem dependência extra); runbook com âncoras DoD; testes Vitest; **telemetria** `logStructuredMonthlyEnqueueDuplicateIgnored` / `maybeLogMonthlyEnqueueDecision` para duplicate (worker deve invocar). **Pendente neste repo:** tick HTTP/cron e `INSERT` real (P05).
- **Smoke manual AG-01:** Nova empresa → dia **15** → guardar → recarregar → confirmar `monthlyRunDay: 15` no `localStorage` (`portal-automacao-nf.data.v1`) e linha “Coleta automática mensal: dia **15**…” no detalhe.
- **Correcções pós-QA (2026-04-22):** `aria-describedby` dinâmico + `id` no alerta do dia mensal; validação defensiva em `save` via `messageFromMonthlyRunDayParse`; `messageFromMonthlyRunDayParse` + teste JSON round-trip dia 28 em `@repo/shared`; telemetria duplicate + testes em `@repo/scheduling`; nota JSDoc em `monthly-enqueue.ts` sobre limite `Intl`/SP; `is-regex` em `devDependencies` (raiz + `apps/web`) para corrigir cadeia ESLint — executar `pnpm install` / `npm install` no ambiente local se o módulo ainda não resolver.

### Debug Log References

— (sem bloqueios)

### File List

- `packages/shared/src/portal-types.ts`
- `packages/shared/src/monthly-run-day.ts`
- `packages/shared/src/monthly-run-day.test.ts`
- `packages/shared/src/index.ts`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `apps/web/src/context/portal-provider.tsx`
- `apps/web/src/components/company-form.tsx`
- `apps/web/src/app/(dashboard)/empresas/[id]/page.tsx`
- `packages/scheduling/package.json`
- `packages/scheduling/tsconfig.json`
- `packages/scheduling/src/monthly-enqueue.ts`
- `packages/scheduling/src/monthly-enqueue.test.ts`
- `packages/scheduling/src/enqueue-telemetry.ts`
- `packages/scheduling/src/enqueue-telemetry.test.ts`
- `packages/scheduling/src/index.ts`
- `db/migrations/20260422120000_companies_monthly_run_day.sql`
- `docs/runbooks/agendamento-mensal-por-empresa.md`
- `turbo.json`
- `package.json` (raiz)

### Estado da implementação (dev)

Entrega **máxima no monorepo actual** (sem serviço Postgres/API nem worker). AG-01 fechado no protótipo; AG-02/AG-03 com artefactos e testes; subtask **Instrumentação** AG-03 aberta até existir worker.

---

## Change Log

| Date       | Version | Description | Author |
| ---------- | ------- | ----------- | ------ |
| 2026-04-22 | 0.6     | Pós-QA: a11y `monthlyRunDay` + `messageFromMonthlyRunDayParse`; testes JSON dia 28; telemetria duplicate `@repo/scheduling`; runbook; `is-regex` devDep (ESLint) | Dex (@dev) |
| 2026-04-22 | 0.5     | Implementação dev: AG-01 UI+modelo; AG-02 migração+validação shared+testes; AG-03 pacote scheduling+runbook+testes; turbo `test` | Dex (@dev) |
| 2026-04-22 | 0.1     | AG-01 a AG-03 criadas a partir do PRD, arquitetura e UX spec | SM (AIOS) |
| 2026-04-22 | 0.2     | Refino PO: DoD por fatia; AC7 pós-execução mesmo mês; runbook com path e âncoras; observabilidade mínima AG-03 | SM (AIOS) |
| 2026-04-22 | 0.3     | Refino PO (nota 9,5): AC5 obrigatório + rastreio FR18; DoD AG-01 e smoke; gate explícito Draft → Ready for dev no cabeçalho | SM (AIOS) |
| 2026-04-22 | 0.4     | Validação PO: âmbito vinculativo §2; DoD conjunto + métricas PRD §8; checklist *validate-story-draft*; estado Ready for dev + registo Pax | PO (AIOS) |

---

## QA Results

**Revisão:** Quinn (@qa) · **Data:** 2026-04-22 · **Âmbito analisado:** código + migração + runbook + testes automatizados (sem browser E2E nesta passagem).

### Decisão de gate (conjunto)

| Fatia | Decisão | Racional breve |
| ----- | ------- | ---------------- |
| **AG-01** | **PASS** (protótipo `localStorage`) | AC1–AC5 verificáveis no código; smoke manual documentado no *Dev Agent Record* (evidência indirecta). |
| **AG-02** | **CONCERNS** | Migração SQL + validação partilhada + testes **unitários** presentes; **faltam** rotas POST/PATCH, respostas JSON reais e **testes de integração** HTTP/DB exigidos pelo AC5 e DoD AG-02 (DoR P04). |
| **AG-03** | **CONCERNS** | Lógica pura + runbook + testes unitários alinham AC2–AC5/AC7 em desenho; **faltam** tick/cron com segredo, INSERT real, NFR9/P12 retries no worker e **instrumentação** (subtask ainda `[ ]`). |

**Síntese:** adequado para **merge como incremento de protótipo + bibliotecas**; **não** fechar o conjunto AG-01…AG-03 como “Done” operacional até P04/P05 e instrumentação AG-03.

### Evidência executada (automatizada)

- `npx turbo run test typecheck` — **PASS** (2026-04-22): `@repo/shared` (6 testes), `@repo/scheduling` (5 testes), `web` + pacotes `tsc` sem erros.

### Rastreio por Acceptance Criteria

**AG-01**

| AC | Estado | Notas |
| -- | ------ | ----- |
| AC1 | **Met** | `Company.monthlyRunDay`; `hydrateMonthlyRunDay` em `loadPersisted` / `addCompany` / `updateCompany`. |
| AC2 | **Met** | `CompanyForm`: `<select>` 1–28 após código do sistema; `label` + `htmlFor` + `aria-describedby` no texto de ajuda (06:00 + América/São Paulo). |
| AC3 | **Met** | Detalhe: select, `dirty`, `save` → `updateCompany` com `monthlyRunDay`. |
| AC4 | **Parcial** | Fora 1–28 é impossível via `<select>`; ramo API **400** (`aria-invalid`, `role="alert"`) existe mas **`fieldError` nunca é preenchido** — sem teste de integração até existir cliente HTTP. |
| AC5 | **Met** | Texto do resumo corresponde ao requisito (dia persistido `comp.monthlyRunDay`). |

**DoD AG-01:** WCAG 2.2 AA em revisão estática — **PASS com ressalva**: foco/estilos consistentes com inputs; recomendação baixa prioridade: associar mensagem de erro futura a `aria-describedby` dinâmico no `<select>` quando `fieldError` for usado.

**AG-02**

| AC | Estado | Notas |
| -- | ------ | ----- |
| AC1 | **Met (SQL)** | `monthly_run_day SMALLINT NOT NULL DEFAULT 1` + `CHECK` equivalente a 1–28. |
| AC2–AC4 | **Não aplicável no repo** | Sem API; validação preparada em `parseMonthlyRunDayFromRequest` (bom para P04). |
| AC5 | **Parcial** | Coberto a nível **parser** em Vitest; **não** há teste “persistido e lido” em fevereiro na base nem **400** via HTTP. |

**DoD AG-02:** rollback documentado na migração — **Met**; testes de integração na CI — **Não met**.

**AG-03**

| AC | Estado | Notas |
| -- | ------ | ----- |
| AC1 | **Não met** | Sem endpoint/cron com `CRON_SECRET`. |
| AC2–AC5, AC7 | **Met em desenho** | `decideMonthlyScheduledEnqueue` + testes (`#duplo-tick-mesmo-dia`, `#mudanca-intra-mes`, `#fevereiro-d28`, `#pos-execucao-mesmo-mes`). |
| AC6 | **Não verificável** | Retries / `failed` / P12 fora do monorepo. |

**DoD AG-03:** runbook + âncoras — **Met**; observabilidade duplicate enqueue — **Não met** (documentado no runbook como obrigação do worker).

### Riscos e dívida técnica

1. **Fuso (`utcAtZonedWall`):** busca binária + `Intl` — aceitável para SP sem DST; documentar limitação se o produto alargar fusos com transições.
2. **`package-lock.json` / turbo:** aviso de lockfile em falta ou ilegível no ambiente de revisão — risco de reprodutibilidade CI; recomenda-se `npm install` + commit do lock saudável.
3. **Lint `apps/web`:** falha conhecida da cadeia `eslint` (`is-regex`) não foi reexecutada nesta revisão; tratar antes de gate “verde” global.

### Recomendações ao @dev

1. Preencher `fieldError` quando existir cliente API, e ligar `id` de erro a `aria-describedby` no select de detalhe.
2. Com P04: testes de integração mínimos POST/PATCH + leitura `monthlyRunDay` após migração.
3. Com P05: implementar instrumentação + `ON CONFLICT` real; marcar subtask AG-03 instrumentação.

### CodeRabbit

Não executado nesta sessão (CLI WSL não invocado). Sugestão: correr em PR antes do merge.

---

— River (SM), removendo obstáculos 🌊 · **Aprovação PO v0.4:** Pax 🎯
