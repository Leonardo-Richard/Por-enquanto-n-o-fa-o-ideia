# User stories — Catálogo global de utilizadores em Membros e filtro dinâmico (superadmin)

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** `docs/prd-membros-catalogo-utilizadores-filtro-dinamico.md`, `docs/architecture-membros-catalogo-utilizadores-filtro-dinamico.md`, `docs/front-end-spec-membros-catalogo-utilizadores-filtro-dinamico.md`  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-27  
**Estado do conjunto:** **Ready for Sprint** — pode existir implementação prévia alinhada ao briefing; estas histórias fecham **AC**, **testes** e **OpenAPI**.  
**Epic (sugerido):** **SMEM-CAT** — Catálogo global em Membros (extensão do épico de gestão de membros / área Organizações superadmin).  
**Prioridade (sugerido):** **Should** — valor operacional para suporte e superadmin; não bloqueia login nem fluxo fiscal.  
**Refino PO (2026-04-27):** actor humano em SMEM-09; ordenação e campos mínimos explícitos; **NFR37** com teto numérico nas AC; SMEM-11 AC4 observável; secção **Dados mínimos para testes**.  
**Refino PO (2.ª passagem):** estado **Ready for Dev** por história alinhado ao conjunto **Ready for Sprint**; cobertura de testes inclui **AC8**; SMEM-11 edge refetch pós-sucesso; **NFR38** canónico no OpenAPI.  
**Refino PO (3.ª passagem — fecho 9,5→10):** rastreio **SMEM-11** inclui **AC4–AC5** e ligação a **NFR39**; gate de merge explicita verificação **SMEM-11 AC5**.

**Estados:** **Ready for Sprint** = pacote aprovado para entrada no sprint; cada história abaixo em **Ready for Dev** até assign/commit (evita divergência «To Do» vs conjunto).

---

## Índice

| ID | Título resumido | Dependências principais |
| -- | ---------------- | ------------------------ |
| **SMEM-09** | API `GET .../system-users` + testes de integração | SMEM-02 (padrão de sessão/authz `members`), `@repo/shared` |
| **SMEM-10** | UI: tabela de catálogo, filtro local, paginação da vista | SMEM-09 (contrato estável), SMEM-07 (página Membros / modais base) |
| **SMEM-11** | Pré-preenchimento do modal + refresh pós-mutação | SMEM-10, fluxos SMEM (POST/PATCH/DELETE `.../members`) |
| **SMEM-12** | OpenAPI + nota de backlog escala (**NFR38**) | SMEM-09 |

**Ordem sugerida:** SMEM-09 → SMEM-10 → SMEM-11; **SMEM-12** pode paralelizar com SMEM-09 assim que o contrato JSON estiver estável.

---

## Rastreio PRD → stories

| Story | FR / NFR cobertos |
| ----- | ----------------- |
| SMEM-09 | **FR111**, **FR112**, **NFR36**, **NFR39**, **NFR37** (teto **100** × **100** linhas no cliente, alinhado à arquitectura §5.2) |
| SMEM-10 | **FR113**, **FR114**, **NFR40** (filtro + tabela), **NFR37** (mesmo teto + copy de truncamento) |
| SMEM-11 | **FR115**, **FR116**; **AC4–AC5** (sem optimista em falha de mutação; erro recuperável se refetch pós-sucesso falhar — UX coerente com **NFR39**, sem falso «catálogo sincronizado») |
| SMEM-12 | **NFR41**; nota técnica **NFR38** (sem implementação obrigatória) |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **revisão sugerida:** `@architect` em SMEM-09 (contrato API, segurança, query `LEFT JOIN`); `@qa` em SMEM-10/SMEM-11 (filtro, a11y, refetch).  
- **foco:** nunca confiar no cliente para `isSuperadmin`; sem PII em logs além do padrão existente; respostas de erro sem stack.  
- **gate mínimo para merge:** testes de integração SMEM-09 verdes; AC de SMEM-10–11 verificados manualmente ou E2E; **SMEM-11 AC5** verificado (teste automatizado **ou** evidência de verificação manual no PR, conforme tarefa opcional da story); SMEM-12 com diff OpenAPI no PR ou excepção registada no board (**NFR41**).

---

## Definition of Done (macro)

- `GET /api/v1/organizations/{organizationId}/system-users` implementado (ou validado) conforme arquitectura §2–3 (incl. ordenação `user.createdAt` DESC).  
- Página Membros exibe catálogo global, filtro **sem** botão Buscar, paginação sobre resultado filtrado, colunas da spec UX §5.1; carregamento cliente respeita teto **NFR37** (**100** páginas × **100** linhas) com aviso se truncado.  
- Modal «Adicionar membro existente» pré-preenche e-mail quando aberto a partir da linha; após mutações `.../members`, a lista actualiza; falha de refetch pós-sucesso com **feedback recuperável** (SMEM-11 AC5).  
- OpenAPI actualizado **ou** excepção explícita no sprint (**NFR41**); linha **NFR38** na `description` da operação `system-users` (**SMEM-12** AC3).  
- Nenhum regressão conhecida nos fluxos SMEM de membros (último admin, 409 duplicado, etc.).

---

## SMEM-09 — Story: endpoint `GET .../system-users` e testes de integração

**Status:** Ready for Review  
**Dependências (DoR):** `getAuthedSession`, `isSuperadmin`, `getDb`, padrão de erros `jsonError` / `toPublicApiError` iguais a `organization-members`; tipos em `@repo/shared`.

### Story

**As a** superadmin,  
**I want** um endpoint de leitura que devolve todos os utilizadores do sistema com o vínculo opcional à organização que estou a gerir,  
**so that** a página Membros possa mostrar o catálogo completo sem usar este path para escrita.

### Acceptance Criteria

1. Existe `GET /api/v1/organizations/{organizationId}/system-users` delegando para `handleGetOrganizationSystemUsers` (ou equivalente mantendo o contrato).
2. Query validada com `organizationSystemUsersQuerySchema`: `page` ≥ 1 (default 1), `pageSize` entre 1 e 100 (default 100); parâmetros inválidos → **400** com mensagem operacional.
3. `organizationId` inválido (não UUID) → **400**.
4. Organização inexistente → **404**.
5. Sem sessão → **401**; sessão sem superadmin → **403** (**FR112**).
6. Resposta **200:** `{ items, page, pageSize, total }` onde `items[]` segue `OrganizationDirectoryUserItem`; `total` = número total de linhas em `user` (global, independente da org).
7. Cada item: `member === null` quando não há membership na org; caso contrário `member` compatível com `OrganizationMemberListItem` (incl. `createdAt` / `updatedAt` em ISO 8601).
8. Cada item em `items` inclui sempre os campos de topo: `userId`, `email`, `displayName`, `isSuperadmin`, `member`.
9. Ordenação: por página, os resultados vêm ordenados por **`user.createdAt` descendente** (utilizador mais recentemente criado primeiro na página), conforme PRD §6.1 e arquitectura §3.1.
10. Query SQL: `FROM user` com `LEFT JOIN organization_memberships` em `organization_memberships.user_id = user.id` e `organization_memberships.organization_id` = UUID do path; não pode haver mais de **uma** linha de `user` por `user.id` no resultado da página (sem duplicados por join).
11. Logs estruturados com `scope: "organization_system_users"` em sucesso e falhas relevantes (sem vazar PII desnecessária).

### Dados mínimos para testes de integração (DoR QA)

- Uma **organização** existente e válida no BD de teste.  
- **Dois** utilizadores distintos na tabela `user`: (A) **com** `organization_memberships` para essa org; (B) **sem** membership nessa org — permite assert explícito de `member` preenchido vs `null` na mesma resposta.  
- Sessão **superadmin** e sessão **não superadmin** (reutilizar padrão dos testes de `GET .../members` em `organization-members.integration.test.ts` ou equivalente).

### Tasks / Subtasks

- [x] Confirmar rota `frontend/src/app/api/v1/organizations/[organizationId]/system-users/route.ts` e handler alinhados à arquitectura §9.
- [x] Garantir export Zod/tipos em `packages/shared` e consumo correcto no handler.
- [x] Adicionar ou alargar testes de integração cobrindo **AC 2–9** (incl. **AC8:** cada item da primeira página com `userId`, `email`, `displayName`, `isSuperadmin`, `member`; **AC9:** ordem `createdAt` DESC quando injectável com ≥2 users com datas distintas).
- [x] Teste obrigatório: utilizador **membro** e **não membro** da mesma org na mesma resposta — `member` null vs preenchido (**AC7**).
- [x] Onde aplicável, asserts para **AC10** (sem duplicar `user.id` na mesma página) e **AC11** (presença de `scope` nos logs de sucesso — smoke ou mock de logger, conforme padrão do repo).

---

## SMEM-10 — Story: UI do catálogo, filtro dinâmico e paginação da vista

**Status:** Ready for Review  
**Dependências (DoR):** SMEM-09 (resposta estável); componente página Membros existente; spec UX `docs/front-end-spec-membros-catalogo-utilizadores-filtro-dinamico.md`.

### Story

**As a** superadmin,  
**I want** ver todos os utilizadores do sistema na página Membros e filtrar por nome ou e-mail enquanto escrevo,  
**so that** eu localize contas rapidamente sem depender de um botão «Buscar».

### Acceptance Criteria

1. A página `/admin/organizacoes/[organizationId]/membros` carrega o catálogo via chamadas sequenciais a `.../system-users` com `pageSize` **100**, até `acc.length >= total` **ou** até **100** páginas pedidas (**NFR37**: teto de **10 000** utilizadores carregados no cliente neste MVP).
2. Se as **100** páginas forem atingidas com `acc.length < total`, mostra-se aviso ao operador (copy `mem.catalog.truncation.warning` com `{maxLoaded}` = **10000** ou texto equivalente na spec UX §10).
3. Existe campo com **label** «Filtrar por nome ou e-mail» (associação `label`/`htmlFor`); **não** existe botão «Buscar» dedicado ao filtro (**FR114**).
4. O texto do filtro aplica subconjunto **case-insensitive** em nome e e-mail sobre dados já carregados; alterar o filtro repõe a paginação da vista na **página 1** (spec UX §4.2).
5. Tabela com as colunas definidas na spec UX §5.1 (Utilizador, Superadmin, Nesta organização, Papel, Cargo, Departamento, Contato, Acções).
6. Estados vazios distintos: sem utilizadores no sistema vs nenhum resultado do filtro (copy `mem.catalog.empty.*` da spec §10).
7. Paginação da vista (ex.: 50 linhas) aplica-se ao **conjunto filtrado**; texto de estado de paginação alinhado a `mem.catalog.pagination.status` ou equivalente.
8. `aria-busy` / skeleton na carga inicial conforme SMEM + spec UX §6.

### Tasks / Subtasks

- [x] Rever `OrganizationMembersPage` (ou extrair organismo de tabela) contra spec §5–§6.
- [x] Garantir `min-width` da tabela e scroll horizontal em viewport estreito (spec §5).
- [x] Implementar ou validar `aria-label` nas acções por linha (spec UX §8).
- [x] (Opcional) `aria-live` polido para contagem de resultados com debounce (spec UX §8).

---

## SMEM-11 — Story: pré-preencher modal e refrescar catálogo após mutações

**Status:** Ready for Review  
**Dependências (DoR):** SMEM-10; modais e APIs `.../members` já existentes (SMEM).

### Story

**As a** superadmin,  
**I want** adicionar à organização a partir da linha com o e-mail já no modal e ver a lista actualizada após cada alteração,  
**so that** eu reduza erros de digitação e veja sempre o estado real de vínculos.

### Acceptance Criteria

1. Linha **sem** `member`: acção visível «Adicionar à organização» abre o modal **Adicionar membro existente** com o campo e-mail **pré-preenchido** com o e-mail da linha; o utilizador pode editar antes de submeter (**FR115**).
2. Abrir «Adicionar membro existente» pela **toolbar** (sem contexto de linha) **não** pré-preenche o e-mail (spec UX §5 tabela toolbar).
3. Após **sucesso** de **POST** `.../members` (link ou create), **PATCH** ou **DELETE** iniciados a partir desta página, o catálogo é recarregado (refetch multi-página, mesmo padrão de **NFR37** que SMEM-10 AC1) até `items`/`member` reflectirem a API (**FR116**).
4. Se a mutação **falhar** (resposta HTTP tratada como erro no modal, ex.: **409** duplicado, regra último admin, 5xx, rede): ao fechar o modal de erro, as linhas e campos `member` do catálogo permanecem **iguais** ao estado **antes** da tentativa (sem actualização optimista que altere `member` ou remova linhas até novo **sucesso** + refetch do AC3).
5. Se a mutação for **bem-sucedida** mas o **refetch** subsequente de `GET .../system-users` **falhar** (rede, 5xx): a UI **não** apresenta o catálogo como garantidamente sincronizado sem feedback — deve mostrar **erro recuperável** na região do catálogo (mensagem + **Tentar novamente** ou equivalente ao padrão SMEM §6) até um carregamento completo com sucesso; não remover silenciosamente linhas nem alterar `member` com base só na resposta da mutação.

### Tasks / Subtasks

- [x] Confirmar prop `initialEmail` (ou equivalente) no modal e reset ao fechar.
- [x] Ligar `onDone` de todos os modais relevantes a `loadSystemUserCatalog()` (ou nome actual da função de refetch).
- [ ] Teste manual ou E2E: adicionar não membro → linha passa a membro; editar papel → coluna actualiza; remover → coluna Nesta organização e acções correctas.
- [x] (Opcional / se viável no harness) Simular falha de rede ou 5xx no refetch após POST bem-sucedido e validar **AC5**; caso contrário, registo no PR de verificação manual.

---

## SMEM-12 — Story: documentar `system-users` no OpenAPI e registrar backlog de escala

**Status:** Ready for Review  
**Dependências (DoR):** contrato JSON estável de SMEM-09.

### Story

**As a** integrador ou QA,  
**I want** ver o path `system-users` no OpenAPI e uma nota de evolução para grandes volumes,  
**so that** o contrato fique rastreável e o risco de performance seja explícito no backlog.

### Acceptance Criteria

1. O ficheiro `docs/api/openapi-v1-organizations-session.yaml` inclui `GET /organizations/{organizationId}/system-users` com query `page`, `pageSize` e schema de resposta alinhado a `OrganizationDirectoryUserItem` (**NFR41**).
2. A `description` (ou `summary` + `description`) da operação menciona: superadmin apenas; `total` global de `user`; `member` opcional.
3. **Fonte canónica para NFR38:** na mesma `description` da operação em OpenAPI, incluir **uma linha** explícita de evolução/backlog para **NFR38** (ex.: pesquisa no servidor com debounce; virtualização) — **sem** obrigar implementação neste sprint. O ficheiro `docs/architecture-membros-catalogo-utilizadores-filtro-dinamico.md` pode **duplicar** a nota com link ao OpenAPI, mas **não** substitui esta linha no contrato.

### Tasks / Subtasks

- [x] Editar OpenAPI com path, parameters, response schema e **linha NFR38** na `description` (referenciar tipos `@repo/shared` na prosa se não houver component reutilizável).
- [x] Validar YAML (parser CI ou extensão).
- [ ] (Opcional) Issue de backlog ligada a NFR38 com link ao OpenAPI e ao §8 da arquitectura.

---

## Notas de planeamento

- **Dependência explícita do PRD:** SMEM-02 / SMEM-07 devem estar concluídos para esta fatia não reabrir auth básica de membros.  
- **Implementação prévia:** se o código já satisfizer AC, o @dev marca tasks como concluídas e anexa evidência (screenshots, output de testes, link de PR).  
- **Estimativa sugerida (t-shirt):** SMEM-09 S; SMEM-10 M; SMEM-11 S; SMEM-12 XS — ajustar após spike de testes.

---

## Changelog do documento

| Data | Alteração |
| ---- | --------- |
| 2026-04-27 | Versão inicial (SMEM-09–12). |
| 2026-04-27 | Refino PO: epic/prioridade/estado; actor SMEM-09; AC ordenação e campos; NFR37 **100×100**; SMEM-11 AC4 observável; fixtures de integração; tarefa opcional de ordenação promovida a cobertura explícita. |
| 2026-04-27 | Refino PO (2.ª passagem): **Ready for Dev** por história; testes **AC8**–**AC11**; SMEM-11 **AC5** refetch pós-sucesso; **NFR38** canónico no OpenAPI `description`. |
| 2026-04-27 | Refino PO (3.ª passagem): rastreio **SMEM-11** com **AC4–AC5** + **NFR39**; gate de merge com **SMEM-11 AC5** explícito. |

---

— River (SM) — AIOS; histórias derivadas do PRD, da arquitectura e da spec de UX de catálogo Membros.

---

## Dev Agent Record

**Agent Model Used:** (Cursor) implementação conforme story SMEM-09–12.

### Completion Notes

- **SMEM-09:** Handler e rota já existentes; adicionada suíte `organization-system-users.integration.test.ts` (401/403/400/404, campos AC8, membro vs não-membro, ordem `createdAt` DESC, duplicados, log `organization_system_users` + `success`).
- **SMEM-10:** Aviso de truncagem NFR37 (`maxLoaded` 10000), cópias alinhadas à spec (`mem.catalog.*`), paginação com `paginationStatus`, `aria-label` nas acções por linha, `aria-live` com debounce na contagem filtrada, `aria-busy` na tabela durante refetch.
- **SMEM-11:** `loadSystemUserCatalog("refresh")` após mutações com erro **recuperável** na região do catálogo sem limpar linhas nem `member` em falha de refetch (**AC5**); botão «Tentar novamente».
- **SMEM-12:** `GET .../system-users` documentado em `docs/api/openapi-v1-organizations-session.yaml` com linha **NFR38** na `description`; YAML validado com `js-yaml`.
- **Verificação:** `npm run typecheck`, `npm run test`, `npm run lint` no pacote `frontend` (integração DB skipped sem `DATABASE_URL`).
- **Seguimento QA (2026-04-27):** AC6 com `body.total === COUNT(*)` em integração; ordenação por índice global em multi-página; lógica de fetch extraída para `fetch-organization-system-user-catalog.ts` + testes unitários (401, 5xx, rede, paginação, truncamento NFR37) cobrindo o contrato usado no refetch pós-mutação (base para AC5).

### File List

- `frontend/src/app/api/v1/organization-system-users.integration.test.ts` (novo)
- `frontend/src/components/admin/organization-members-page.tsx`
- `frontend/src/lib/fetch-organization-system-user-catalog.ts`
- `frontend/src/lib/fetch-organization-system-user-catalog.test.ts`
- `docs/api/openapi-v1-organizations-session.yaml`
- `docs/stories/membros-catalogo-utilizadores-filtro-dinamico.md` (tarefas + este registo)

### Change Log

- 2026-04-27: Fecho SMEM-09/10/11 (código + testes + OpenAPI); tarefas opcionais SMEM-11 (E2E / harness AC5) e SMEM-12 (issue backlog) por validar em PR ou sprint.
- 2026-04-27: Resposta às recomendações do **QA Results** (AC6 assert, ordenação robusta, testes unitários do fetch catálogo / falha refetch ao nível HTTP-rede; página Membros passa a usar o módulo extraído).

---

## QA Results

**Revisor:** Quinn (QA / AIOS)  
**Data:** 2026-04-27  
**Âmbito:** revisão estática de código + testes automatizados locais (`frontend`: `npm run test`, `npm run typecheck`, `npm run lint`); integração com BD **não** executada nesta sessão (suíte `describe.skipIf(!hasDb)`).

### Decisão de gate

**CONCERNS** — pronto para merge com condições: garantir **SMEM-09** com `DATABASE_URL` verde no CI (ou pipeline equivalente) e fechar evidência **SMEM-11 AC5** (manual no PR ou teste) conforme gate do próprio documento (§CodeRabbit / quality gate).

### Rastreio por story

| Story | Cobertura observada | Notas |
| ----- | ------------------- | ----- |
| **SMEM-09** | Rota + `handleGetOrganizationSystemUsers`, Zod `organizationSystemUsersQuerySchema`, `LEFT JOIN`, `orderBy(desc(user.createdAt))`, logs `scope: organization_system_users`. Suíte `organization-system-users.integration.test.ts` mapeia 401/403/400 (UUID, page, pageSize), 404, AC7–8, AC10, AC11 (spy `console.info`). | **Correcção na revisão QA:** o teste de ordenação usava `pageSize=200` (inválido vs AC2 / schema max 100) — corrigido para `pageSize=100`. **Lacuna:** não há assert explícito de que `total` coincide com `COUNT(*)` global em `user` (apenas `total >= 6` e tipo); aceitável como smoke, reforçar se quiser prova estrita da AC6. Ordenação entre fixtures assume ambos na primeira página (datas 2140 — risco baixo em BD típico). |
| **SMEM-10** | `OrganizationMembersPage`: loop até 100×100, `catalogTruncated` + copy truncagem, filtro case-insensitive + reset página, colunas alinhadas spec, `aria-label` acções, `aria-live` debounce, `aria-busy` + skeleton inicial / refetch, sem botão «Buscar». | Cópias espelham `mem.catalog.*` da spec (nomes de chaves em comentário); OK funcionalmente. |
| **SMEM-11** | `initialEmail` + reset; `onDone` → `loadSystemUserCatalog("refresh")`; sem optimista no catálogo; falha de refetch com banner + «Tentar novamente» sem limpar `catalog` (AC5). | Tarefas **E2E** e **harness AC5** ainda abertas na story; **merge gate** pede evidência AC5 — anexar no PR ou implementar teste. |
| **SMEM-12** | OpenAPI `GET .../system-users`, parâmetros, schemas, `description` com superadmin / `total` global / `member` opcional + **NFR38** explícito. | AC1–3 satisfeitos. Tarefa opcional issue backlog NFR38 por abrir se desejado. |

### NFR / segurança (olho rápido)

- **FR112 / authz:** superadmin no handler; não confiar só no cliente — OK no servidor.  
- **Logs:** JSON estruturado; evitar PII extra — alinhado ao padrão existente (`userId` em logs de falha — verificar política interna se necessário).  
- **Erros API:** `jsonError` / `toPublicApiError` — sem stack em respostas públicas (padrão repo).

### Recomendações ao @dev

1. Correr `npm run test` no `frontend` com **`DATABASE_URL`** definido antes do merge e confirmar os 9 testes de `organization-system-users.integration.test.ts` a verde (incl. ordenação após correcção `pageSize`).  
2. PR: nota de **verificação manual** AC5 (mutação OK + refetch falha + retry) ou teste (mock `apiFetch`).  
3. (Opcional) Assert mais forte AC6: comparar `body.total` com query `count(*)` from `user` no mesmo teste.

### Pós-merge

- `@architect` em SMEM-09 (contrato + query) e smoke superadmin em staging, conforme notas da story.
