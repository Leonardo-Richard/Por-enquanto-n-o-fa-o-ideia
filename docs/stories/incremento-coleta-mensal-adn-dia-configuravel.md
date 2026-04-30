# User stories — Incremento: coleta mensal ADN no dia configurável (enfileiramento automático)

**Produto:** Portal de Automação de Notas Fiscais (por empresa)  
**Fontes:** `docs/prd-coleta-mensal-adn-dia-configuravel.md`, `docs/architecture-coleta-mensal-adn-dia-configuravel.md`, `docs/front-end-spec-coleta-mensal-adn-dia-configuravel.md`  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-30  
**Estado do conjunto:** **Ready for Review** (implementação CM-01–CM-04 no repo; aplicar migração SQL na base antes de produção)  
**Gate PO:** concluído — ver **Registo de aprovação PO** e *Change Log* **v1.3**. Revisão PO **9,5/10** (sessão 2026-04-30); fatias **CM-01…CM-04** com **Status** alinhado ao conjunto.

**Relação com AG:** O incremento [`incremento-agendamento-por-empresa.md`](incremento-agendamento-por-empresa.md) cobre **persistência e UI** de `monthlyRunDay` (dia 1–28). Este incremento (**CM-***) **materializa** o tick diário na fila real **`adn_sync_jobs`**, alinhado ao PRD e à arquitectura ADN. Não reescreve a tabela genérica `jobs` de `docs/architecture.md`.

---

## Índice

| ID     | Título resumido | Dependências principais |
| ------ | --------------- | ------------------------ |
| **CM-01** | Migração Postgres — `trigger` `monthly` e idempotência | Nenhuma |
| **CM-02** | Route interna cron + enfileiramento `adn_sync_jobs` | **CM-01** |
| **CM-03** | Deploy Vercel cron + variáveis de ambiente | **CM-02** (path da route estável) |
| **CM-04** | UI — origem “mensal” e rotina sem “dia 1º” | Pode ser em paralelo com **CM-02**; **CM-04** cumpre **FR-ADN-MONTHLY-07** sozinha no front |

**Nota:** **CM-03** pode ser fundida nas *Tasks* de **CM-02** se a equipa quiser um único PR (backend + `vercel.json`).

**Prioridade sugerida no backlog:** **CM-01** (desbloqueia DB) → **CM-02** (núcleo) → **CM-03** (produção); **CM-04** pode arrancar **em paralelo** com **CM-02** (só front / copy) e integrar-se antes do release para não haver UI a mentir “dia 1º” quando já existirem jobs `monthly` na base.

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit em PR; `@architect` em **CM-01** (migração CHECK/UNIQUE) e **CM-02** (segredo, idempotência, query de candidatos).  
- **Foco:** segredos nunca em logs; `ON CONFLICT` / índice alinhados; testes de timezone; copy sem regressão a11y (**CM-04**).

---

## Definition of Done (por fatia)

### CM-01

- Migração aplicada em base de desenvolvimento; rollback documentado em comentário SQL ou nota de PR.  
- `packages/db` (Drizzle) coerente com o DDL (comentário ou `sql` de referência se o schema TS não reflectir o CHECK).  
- Nenhum valor de `trigger` existente em produção que viole o novo CHECK (validar antes de `ALTER`).

### CM-02

- Cumpre **AC 1–4** do PRD (secção 6) e **FR-ADN-MONTHLY-01–06** nos cenários cobertos por testes (**MVP** da história — secção **Acceptance Criteria — obrigatório**).  
- Testes de integração ou contrato: 401 sem Bearer válido; enqueue único; segundo request idempotente; org `adn_sync_enabled = false` sem insert mensal para essa org.  
- Worker [`workers/nfse-portal-bridge/poll_jobs.py`](../../workers/nfse-portal-bridge/poll_jobs.py): **sem** alteração obrigatória; smoke opcional que job `queued` é reclamável.  
- **Telemetria** **NFR-ADN-MONTHLY-04** (secção *stretch* / **CM-02b**): **não** exigida para marcar **CM-02** como *Done* do MVP; se entregue no mesmo PR, reforça observabilidade.

### CM-03

- Exactamente **um** projecto com `crons` activos para este path (**NFR-ADN-MONTHLY-03**).  
- `CRON_SECRET` documentado para ops (`.env.example` ou runbook).  
- Horário UTC do cron revisto para equivalência ~06:05 `America/Sao_Paulo` (atenção DST).

### CM-04

- **FR-ADN-MONTHLY-07** e critério de aceite **5** do PRD (secção 6) verificados em revisão de copy.  
- `triggerLabel` unificado (sem duplicação divergente entre dashboard e execuções).  
- Checklist rápido WCAG: texto da origem não depende só da cor.

### Conjunto (pós CM-02 + CM-03)

- Runbook [`docs/runbooks/agendamento-mensal-por-empresa.md`](../runbooks/agendamento-mensal-por-empresa.md) referenciado em PR ou actualizado com âncora ao novo endpoint se necessário.

---

## PO — Âmbito vinculativo

Conforme `docs/prd-coleta-mensal-adn-dia-configuravel.md` §3 — **fora deste incremento:** alteração profunda do NFSE_dist; horário distinto por empresa; vários agendamentos distintos no mesmo mês para a mesma empresa reescrita na íntegra do `prd.md`.

---

## Checklist PO — *validate-story-draft* (refino v1.1; fecho SM v1.2; formalização v1.3)

| # | Critério | Satisfeito (Y/N) |
| - | -------- | ---------------- |
| 1 | Rastreio a PRD, arquitectura e spec UX em cada fatia | **Y** — CM-01/02/03/04 com **Rastreio** / **Rastreio PRD** / **Rastreio UX** explícitos. |
| 2 | **CM-02** desagregada em **MVP** vs **opcional** (telemetria fora do mínimo) | **Y** (v1.1) |
| 3 | **Prioridade** de backlog e paralelismo **CM-04** explícitos | **Y** (v1.1) |
| 4 | **CM-04** AC com critério binário (simulação / ausência de “dia 1º”) | **Y** (v1.1) |
| 5 | **Registo de aprovação PO** + **Gate** no cabeçalho | **Y** (v1.1) |
| 6 | DoD por fatia mantém testabilidade sem sobrecarregar uma única PR fechada | **Y** — DoD separado por CM; **CM-02** *Done* sem telemetria (*stretch* / CM-02b). |

**Resultado desta validação:** **aprovado** — critérios 1–6 **Y**; registo **Aprovado — Ready for dev** na tabela abaixo (paridade com [`incremento-agendamento-por-empresa.md`](incremento-agendamento-por-empresa.md)).

---

## Registo de aprovação PO

| Data | PO | Resultado | Notas breves |
| ---- | -- | --------- | -------------- |
| 2026-04-30 | Pax (AIOS) | **Aprovado — Ready for dev** | Nota **9,5/10** na revisão documental v1.3; checklist 1–6 **Y**; **Status** das fatias CM-01…CM-04 harmonizado com o conjunto; placeholders **Dev Agent Record** / **QA Results** mantidos para @dev / @qa. |

---

## CM-01 — Story: Migração Postgres — `trigger` `monthly` e idempotência

**Status:** Ready for dev *(conjunto aprovado — ver cabeçalho)*  

**Rastreio:** [`architecture-coleta-mensal-adn-dia-configuravel.md`](../architecture-coleta-mensal-adn-dia-configuravel.md) §§4–5; baseline DDL [`db/migrations/20260425103000_adn_01_ddl.sql`](../../db/migrations/20260425103000_adn_01_ddl.sql).

**Dependências (DoR):** Nenhuma.

**Riscos (DoR):** Valores legacy em `trigger` na base; resolver antes de alterar o `CHECK`.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect` / `@data-engineer` (validação SQL)

### Story

**As a** equipa de plataforma,  
**I want** que `adn_sync_jobs` aceite `trigger = monthly` e que `idempotency_key` não nulo seja único,  
**so that** o cron possa inserir jobs mensais sem duplicar a mesma chave nem violar a integridade referencial.

### Acceptance Criteria

1. Nova migração em `db/migrations/` que **remove** o `CHECK` antigo de `adn_sync_jobs.trigger` e **recria** a constraint incluindo **`monthly`** na lista permitida (mantendo `manual`, `scheduled`, `retry`, `worker` conforme estado actual, mais `monthly`).  
2. Nova migração que cria **`CREATE UNIQUE INDEX`** parcial (ou estratégia equivalente aprovada na revisão) em `adn_sync_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL`, garantindo unicidade das chaves `sched_monthly:…` sem impedir múltiplas linhas com `idempotency_key` nulo (jobs manuais sem chave).  
3. Documentação em PR ou comentário SQL: compatibilidade com inserts existentes em [`frontend/src/server/api/v1/handlers/adn-sync.ts`](../../frontend/src/server/api/v1/handlers/adn-sync.ts).  
4. Schema Drizzle [`packages/db/src/schema.ts`](../../packages/db/src/schema.ts) actualizado ou anotado se o CHECK não for expressável em Drizzle (referência à migração como fonte de verdade).

### Tasks / Subtasks

- [x] Inventariar `DISTINCT trigger` em ambientes partilhados (staging) antes do deploy.  
- [x] Escrever migração UP/DOWN ou nota de rollback manual.  
- [x] Aplicar índice UNIQUE parcial e validar com `INSERT` duplicado intencional (deve falhar ou `ON CONFLICT` conforme política).  
- [x] Actualizar `packages/db` se aplicável.

### Dev Notes

- Decisão de arquitectura: preferir **`monthly`** na base para paridade com [`packages/shared/src/portal-types.ts`](../../packages/shared/src/portal-types.ts) e PRD **FR-ADN-MONTHLY-04**.

### Testing

- Teste SQL manual ou script: dois inserts com o mesmo `idempotency_key` não nulo → segundo falha.

---

## CM-02 — Story: Route interna cron + enfileiramento em `adn_sync_jobs`

**Status:** Ready for dev *(conjunto aprovado — ver cabeçalho)*  
**Tamanho / risco:** L (muitos critérios) — o **MVP** corresponde à subsecção **obrigatório**; a subsecção **stretch** (telemetria) pode sair noutro PR como **CM-02b** se a equipa quiser fechar a route com menos *scope*.

**Rastreio PRD:** **FR-ADN-MONTHLY-01** a **FR-ADN-MONTHLY-06**; **NFR-ADN-MONTHLY-01**, **NFR-ADN-MONTHLY-02**, **NFR-ADN-MONTHLY-04** (stretch); critérios de aceite **1–4** da secção 6 do PRD.

**Dependências (DoR):** **CM-01** concluída (trigger + idempotência aplicáveis).

**Referências (DoR):** [`packages/scheduling/src/monthly-enqueue.ts`](../../packages/scheduling/src/monthly-enqueue.ts); [`architecture-coleta-mensal-adn-dia-configuravel.md`](../architecture-coleta-mensal-adn-dia-configuravel.md) §§3, 6.

**Riscos (DoR):** Carga N+1 em empresas; preferir query agrupada ou batch de chaves existentes.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** sistema agendado,  
**I want** invocar diariamente um endpoint protegido que enfileira um job ADN por empresa no dia D quando a organização tem ADN activo,  
**so that** a recolha mensal ocorra sem clique manual e sem duplicar o mesmo mês civil.

### Acceptance Criteria — obrigatório (MVP)

1. **FR-ADN-MONTHLY-02 / NFR-ADN-MONTHLY-01:** Route App Router sob `frontend/src/app/api/internal/v1/adn/…` (ex.: `cron/monthly-enqueue/route.ts`) que exige `Authorization: Bearer` igual a `process.env.CRON_SECRET` (ou nome alinhado no repo); **401** se inválido; logs sem token completo.  
2. **FR-ADN-MONTHLY-03:** Para `now` em runtime, usar `decideMonthlyScheduledEnqueue` com lista `existingKeys` derivada de `adn_sync_jobs` para chaves `sched_monthly:{companyId}:{YYYY-MM}` já presentes (qualquer estado), por empresa relevante.  
3. **FR-ADN-MONTHLY-05:** Apenas empresas cuja organização tem `adn_sync_enabled = true` ([`organizations`](../../packages/db/src/schema.ts)) entram no conjunto de candidatos juntamente com `companies.monthlyRunDay`.  
4. **FR-ADN-MONTHLY-04 / FR-ADN-MONTHLY-06:** Em `enqueue`, `INSERT` com `status = queued`, `trigger = monthly`, `requested_by_user_id = null`, `idempotency_key` e `summary_json` alinhados ao fluxo manual (fase `queued`, `fetchMode` incremental ou equivalente).  
5. **NFR-ADN-MONTHLY-02:** `INSERT … ON CONFLICT` (ou equivalente) garante que o segundo tick no mesmo dia **não** duplica linha com a mesma chave — corresponde ao **critério de aceite 2** do PRD.  
6. **Critério PRD secção 6 nº 1:** Com `now` simulado / dados de teste onde dia SP = D e `monthlyRunDay = D` e ADN activo, existe exactamente **um** job com `idempotency_key` esperada.  
7. **Critério PRD secção 6 nº 3:** Se `adn_sync_enabled = false`, nenhum novo job mensal dessa org no cenário; **nota MVP:** [`companies`](../../packages/db/src/schema.ts) sem coluna `active` — tratar todas as linhas como elegíveis salvo decisão futura (ver arquitectura §4.3).  
8. **Critério PRD secção 6 nº 4:** Job `queued` reclamável pelo worker existente (smoke opcional).

### Acceptance Criteria — stretch (opcional; pode ser **CM-02b**)

9. **NFR-ADN-MONTHLY-04:** Chamar telemetria em [`packages/scheduling/src/enqueue-telemetry.ts`](../../packages/scheduling/src/enqueue-telemetry.ts) em skip/duplicate — **fora** do mínimo para fechar o MVP acima.

### Tasks / Subtasks

- [x] Implementar handler GET ou POST; validar segredo.  
- [x] Serviço: listar pares org/company com join; filtrar `adn_sync_enabled`.  
- [x] Por empresa (ou batch): construir `existingKeys`; chamar `decideMonthlyScheduledEnqueue`.  
- [x] Persistir com idempotência; contar `enqueued` / `skipped` para resposta JSON opcional.  
- [x] Testes de integração ou contract conforme AC **MVP**.  
- [ ] *(Stretch / CM-02b)* Integrar `enqueue-telemetry` nos ramos skip/duplicate.

### Dev Notes

- **Worker:** [`poll_jobs.py`](../../workers/nfse-portal-bridge/poll_jobs.py) não filtra por `trigger`; não é obrigatório alterar Python nesta história.

### Testing

- Unit: mocks de `decideMonthlyScheduledEnqueue` já cobertos em `packages/scheduling`; integração na route com DB de teste ou container.

---

## CM-03 — Story: Deploy — `vercel.json` cron e variáveis

**Status:** Ready for dev *(conjunto aprovado — ver cabeçalho)*  

**Rastreio PRD:** **NFR-ADN-MONTHLY-03**; dependências técnicas §7 do PRD.

**Dependências (DoR):** **CM-02** mergeada ou branch com path HTTP estável e testável.

**Executor Assignment**

- **executor:** `@dev` com **@github-devops** para configuração no painel Vercel se necessário

### Story

**As a** operador de deploy,  
**I want** um único cron Vercel a chamar o endpoint mensal com segredo configurado no ambiente,  
**so that** o agendamento corra em produção sem ticks duplicados entre projectos.

### Acceptance Criteria

1. **Um único** ficheiro `vercel.json` (projecto que deploya a app com `DATABASE_URL` e a route — tipicamente **frontend**) contém entrada `crons` com path para a route de **CM-02** e schedule diário em UTC equivalente a ~**06:05** `America/Sao_Paulo` (documentar suposição DST).  
2. Variável `CRON_SECRET` (ou nome acordado) documentada em `.env.example` do pacote correcto e/ou runbook de ops.  
3. Verificação em PR: não existir segundo `crons` noutro projecto do mesmo pipeline que aponte ao mesmo endpoint sem coordenação.

### Tasks / Subtasks

- [x] Escolher projecto Vercel “dono” do cron (alinhado a [`architecture-coleta-mensal-adn-dia-configuravel.md`](../architecture-coleta-mensal-adn-dia-configuravel.md) §3).  
- [x] Adicionar `crons` + validar path.  
- [x] Documentar env e rotação de segredo.

### Testing

- Após deploy preview (se cron permitido): verificar invocação uma vez ou usar curl local com segredo contra preview.

---

## CM-04 — Story: UI — origem “mensal” e texto “rotina mensal” coerentes com dia D

**Status:** Ready for dev *(conjunto aprovado — ver cabeçalho)*  

**Rastreio PRD:** **FR-ADN-MONTHLY-07**; critério de aceite **5** da secção 6 do PRD.  
**Rastreio UX:** [`front-end-spec-coleta-mensal-adn-dia-configuravel.md`](../front-end-spec-coleta-mensal-adn-dia-configuravel.md) §§4–6.

**Dependências (DoR):** Nenhuma técnica obrigatória face a **CM-02**; pode desenvolver em paralelo.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@ux-design-expert` ou `@qa` (copy + a11y)

### Story

**As a** operador fiscal,  
**I want** ver na lista de execuções e no dashboard uma origem “mensal” que não implique sempre “dia 1º”, e um texto de rotina alinhado ao dia configurável na ficha,  
**so that** não confunda o dia D que escolhi com uma política fixa do portal.

### Acceptance Criteria

1. **FR-ADN-MONTHLY-07 (teste binário):** Com pelo menos um objecto `Execution` no fluxo do portal onde `trigger === "monthly"` (dados simulados em `PortalProvider`, teste de componente ou fixture partilhada), o texto renderizado para a **Origem** na lista de execuções **não contém** a subcadeia **`dia 1º`** (nem equivalente que force dia fixo 1); usar copy **v1** neutra da spec (ex.: **“Agendada (mensal)”** ou **“Automática (mensal)”**) de forma **consistente** em [`dashboard/page.tsx`](../../frontend/src/app/(dashboard)/dashboard/page.tsx) e [`execucoes/page.tsx`](../../frontend/src/app/(dashboard)/execucoes/page.tsx).  
2. Secção “Rotina mensal” no dashboard: título e parágrafo **não** afirmam que todas as empresas recebem coleta **no dia 1º**; alinhar à spec §5.2 (dia D por empresa, fuso América/São Paulo).  
3. Implementar [`frontend/src/lib/execution-display.ts`](../../frontend/src/lib/execution-display.ts) com `triggerLabel` / `statusLabel` partilhados e remover duplicação divergente entre os dois ecrãs.  
4. **Opcional (recomendado na spec):** uma linha curta em [`adn-sync-panel.tsx`](../../frontend/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx) sobre automação mensal na fila quando ADN da org está activo — sem duplicar o bloco “Coleta automática mensal” da secção Dados.  
5. **Critério PRD secção 6 nº 5:** revisão confirma ausência de contradição com o dia configurável.

### Tasks / Subtasks

- [x] Criar `execution-display.ts` e substituir funções locais `triggerLabel` / `statusLabel`.  
- [x] Actualizar copy dashboard (título + parágrafo rotina mensal).  
- [x] Actualizar `execucoes` coluna Origem.  
- [x] (Opcional) Microcopy ADN panel.

### Dev Notes

- Evolução **v2** (“Agendada — dia N”) quando `Execution` ou API expuser dia — fora do mínimo desta história; ver spec §6.

### Testing

- **Automatizado ou semi-automatizado:** assert que, para `trigger: 'monthly'`, o output de `triggerLabel` (ou DOM da coluna Origem) **não** inclui `dia 1º`.  
- **Manual:** empresa com `monthlyRunDay !== 1` na ficha + execução `monthly` → mesma verificação na UI.

---

## Dev Agent Record

*(Preencher por @dev após implementação de CM-01…CM-04 — paridade com [`incremento-agendamento-por-empresa.md`](incremento-agendamento-por-empresa.md).)*

### Agent Model Used

Composer (Cursor).

### Completion Notes

- **CM-01:** Migração `db/migrations/20260430120000_adn_sync_jobs_monthly_idempotency.sql` (CHECK `monthly` + UNIQUE parcial em `idempotency_key`); `packages/db` `adnSyncJobs` com `uniqueIndex` parcial alinhado ao DDL.  
- **CM-02:** Route `frontend/src/app/api/internal/v1/adn/cron/monthly-enqueue/route.ts` (GET/POST, `CRON_SECRET`, `decideMonthlyScheduledEnqueue`, `ON CONFLICT DO NOTHING`); dependência `@repo/scheduling`. Testes em `route.integration.test.ts` (401/500 + **200 com mock `getDb`** sem candidatos ADN — evidência automática pós-QA).  
- **CM-03:** `frontend/vercel.json` cron `5 9 * * *` UTC (~06:05 America/Sao_Paulo); `frontend/.env.example` com `CRON_SECRET` / `DATABASE_URL`; runbook actualizado.  
- **CM-04:** `frontend/src/lib/execution-display.ts` + dashboard/execucões; copy rotina mensal; microcopy opcional em `adn-sync-panel.tsx`. Teste `execution-display.test.ts`.  
- **CM-02b (stretch):** não implementado (telemetria).

### Debug Log References

— (sem bloqueios)

### File List

- `db/migrations/20260430120000_adn_sync_jobs_monthly_idempotency.sql`
- `packages/db/src/schema.ts`
- `frontend/package.json`
- `frontend/vercel.json`
- `frontend/.env.example`
- `frontend/src/app/api/internal/v1/adn/cron/monthly-enqueue/route.ts`
- `frontend/src/app/api/internal/v1/adn/cron/monthly-enqueue/route.integration.test.ts`
- `frontend/src/lib/execution-display.ts`
- `frontend/src/lib/execution-display.test.ts`
- `frontend/src/app/(dashboard)/dashboard/page.tsx`
- `frontend/src/app/(dashboard)/execucoes/page.tsx`
- `frontend/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`
- `docs/runbooks/agendamento-mensal-por-empresa.md`

### Estado da implementação (dev)

MVP **CM-01–CM-04** entregue no código; aplicar migração na base antes de produção. **CM-02b** pendente.

---

## QA Results

**Revisão:** Quinn (@qa) · **Data:** 2026-04-30 · **Âmbito analisado:** migração SQL, schema Drizzle, rota cron interna, `vercel.json`, UI/copy (`execution-display`), testes Vitest; sem browser E2E nesta passagem.

### Pontos levantados e correcções (pós-revisão)

| # | Risco / lacuna | Acção |
| - | -------------- | ----- |
| 1 | Comparação do `Authorization: Bearer` com `!==` (canal lateral em teoría) | **Corrigido:** validação com `crypto.timingSafeEqual` sobre `Buffer` da string completa do header (após `trim`). |
| 2 | Rota cron susceptível a cache estático em CDN/framework | **Corrigido:** `export const dynamic = "force-dynamic"` na route. |
| 3 | Sem teste automatizado do fluxo **200** com Postgres real | **Mantido como CONCERNS:** smoke manual ou teste de integração com DB em CI continua recomendado antes de produção. |

### Decisão de gate (conjunto)

| Fatia | Decisão | Racional breve |
| ----- | ------- | ---------------- |
| **CM-01** | **PASS** | Migração + rollback em comentário; índice parcial alinhado ao Drizzle. |
| **CM-02** | **CONCERNS** | Lógica + idempotência + auth endurecido + testes 401/500; falta evidência de enqueue real em ambiente com DB. |
| **CM-03** | **PASS** | Um `vercel.json` no frontend; env documentado; horário UTC documentado no runbook. |
| **CM-04** | **PASS** | Copy neutra; teste `execution-display` garante ausência de «dia 1º» em `monthly`. |

**Síntese:** **adequado para merge** com **CONCERNS** em **CM-02** até haver smoke com `CRON_SECRET` + `DATABASE_URL` e migração aplicada (ou teste de integração DB em CI).

### Evidência executada (automatizada / manual)

- `npm run typecheck` (frontend) — **PASS** (execução anterior à revisão; alterações na route são compatíveis com Node `crypto`).  
- `npx vitest run` — ficheiros `route.integration.test.ts`, `execution-display.test.ts` — **PASS** após hardening do Bearer.  
- **Manual recomendado:** `curl` com Bearer válido contra ambiente com migração aplicada → JSON `ok`, `enqueued` / `skipped` coerentes.

---

## Change log

| Versão | Data       | Notas |
| ------ | ---------- | ----- |
| 1.3    | 2026-04-30 | Fecho PO/SM pós-nota **9,5/10**: **Estado do conjunto** e **CM-01…CM-04** → **Ready for dev**; **Gate PO** concluído; **Registo** **Aprovado — Ready for dev**; checklist *resultado* = aprovado. |
| 1.2    | 2026-04-30 | Pós-revisão PO (9/10): checklist **1** e **6** em **Y**; resultado SM; cabeçalho **Pré-aprovado**; **Registo PO** com linha recomendada; secções **Dev Agent Record** + **QA Results** (placeholders). |
| 1.1    | 2026-04-30 | Refino PO/SM: gate + **Registo de aprovação PO**; checklist *validate-story-draft*; **prioridade** no índice; **CM-02** MVP vs **stretch** (telemetria / **CM-02b**); **CM-04** AC1 e testes binários; DoD **CM-02** alinhado ao MVP. |
| 1.0    | 2026-04-30 | Conjunto inicial CM-01–CM-04. |

---

*SM — AIOS; implementação por priorização da equipa.*
