# User stories — Incremento: navegação shell — «Empresas monitoradas» (`/empresas-monitoradas`)

**Produto:** Portal NF  
**Fontes:** `docs/prd-nav-sidebar-empresas-monitoradas.md`, `docs/front-end-spec-nav-sidebar-empresas-monitoradas.md`, `docs/architecture-nav-sidebar-empresas-monitoradas.md`, `docs/briefing-nav-sidebar-empresas-monitoradas.md`  
**Pré-requisito:** modelo dois níveis e sessão com organização activa já operacionais (`WorkspaceGate`, `useMonitoredCompanies`, layout `(dashboard)`).  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-24  
**Versão do conjunto:** **1.2** — refino pós-avaliação PO 9,5/10 (baseline estável, gate PO, âmbito Painel vs nova rota).  
**Estado do conjunto:** **Draft** — DoR de conteúdo satisfeito para `@dev` (avaliação PO); **assinatura formal** no registo abaixo continua recomendada antes de marcar *Ready for sprint*.

### Refino 1.1 (critérios @po)

| Feedback PO | Tratamento neste documento |
| ------------- | --------------------------- |
| CTA estado vazio com duas variantes | **Decisão fechada:** texto do link **«Nova empresa monitorada»** (igual ao Painel e `fiscal.new.title` no spec dois níveis). |
| «Manter semântica actual» vago para Execuções/Configurações | Secção **Baseline código actual (pré-NAV)** + AC3 explicitado. |
| Métrica qualitativa do PRD ausente do DoD | Novo item no **DoD macro** (UAT / notas de release). |
| Risco 404 se NAV-01 mergear sozinho | Índice e **NAV-01 Dev Notes** — **PR único** NAV-01+NAV-02 ou branch única até existir página. |

### Refino 1.2 (avaliação PO @pax — nota 9,5/10)

| Observação PO | Tratamento neste documento |
| --------------- | --------------------------- |
| Linhas de código (~L70) no baseline podem deslocar-se | Referência **sem números de linha**; localização por **dois** blocos `nav.map` no mesmo ficheiro (aside + header móvel). |
| Tensão Painel (`h2` + subtítulo curto) vs página nova (copy canónica) | **Explícito:** NAV-02 exige copy **spec** só em `/empresas-monitoradas` (AC2). Harmonizar o Painel com `fiscal.list.subtitle` fica em **NAV-FU-02** — não bloqueia aceite de NAV-02. |
| Registo `@po` ainda pendente | Mantém-se tabela; acrescentada linha SM **1.2**; `@po` assina quando executar gate formal. |
| Quality gate NAV-02 mencionava @po em «subtítulo vs Painel» | **NAV-02:** `@po` só se houver **proposta de alteração** ao AC2 ou conflito de produto; caso contrário **@qa** cobre verificação de copy literal dos AC. |

### DoR para `@dev` (checklist rápida)

- [ ] Ler PRD NAV + spec UX NAV + arquitectura NAV (ou resumo neste ficheiro).  
- [ ] Branch sugerida: `feature/nav-empresas-monitoradas` (ou nome da equipa).  
- [ ] Um PR com **NAV-01 + NAV-02** até `main` (sem link 404).  
- [ ] Matriz pathname + UAT macro (DoD) referenciados no PR.

---

## Índice

| ID | Título resumido | Dependências |
| -- | ----------------- | -------------- |
| **NAV-01** | `DashboardShell`: item «Empresas monitoradas», regras `isActive`, `aria-current`, paridade móvel/desktop | Nenhuma (código base actual) |
| **NAV-02** | Rota `/empresas-monitoradas`, paridade Painel, organismo partilhado (opcional mas recomendado) | **NAV-01** — **recomenda-se o mesmo PR ou branch** que entrega NAV-01 para evitar link 404 em `main` |
| **NAV-03** | (Opcional) Evidências QA / referências em `docs/qa` ao item antigo «Organização» | **NAV-01**, **NAV-02** |

**Ordem sugerida:** NAV-01 → NAV-02 → NAV-03 (NAV-01+NAV-02 idealmente **atomicamente** na mesma entrega).

### Rastreio PRD / épico → NAV

| NAV | FR / NFR / épico PRD |
| --- | -------------------- |
| NAV-01 | **FR49**, **FR50** (verificação), **FR52**, **NFR24** |
| NAV-02 | **FR51**, **NFR25**, paridade PRD §6, spec UX §4 |
| NAV-03 | **NFR25**, NAV-01.3 (PRD §9) |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit no PR; `@architect` opcional em **NAV-01** (regras de `pathname` / colisão de prefixos).  
- **Foco:** nenhum `startsWith("/empresas")` para estado activo do item «Empresas monitoradas»; `"/empresas-monitoradas".startsWith("/empresas") === true` — ver `docs/architecture-nav-sidebar-empresas-monitoradas.md` §5.1 nota crítica.

---

## Definition of Done (macro)

- [ ] Matriz de pathname → item `nav` activo validada manualmente ou em e2e (ver arquitectura §8).  
- [ ] `/empresas-monitoradas` exige organização activa (comportamento igual ao Painel; **não** em `ALLOW_NO_ACTIVE`).  
- [ ] `h1` + subtítulo na nova página conforme spec UX §4.1 (`fiscal.list.title` / `fiscal.list.subtitle`).  
- [ ] Checklist mínima a11y: `aria-current` no item activo; `aria-label` nos botões de disparo de job (spec UX §6).  
- [ ] Fluxo `?next=/empresas` no picker **sem** regressão (smoke manual se não houver teste automatizado).  
- [ ] **UAT / nota de release (PRD §1, ponto 4 — métrica de sucesso):** evidência curta (1 parágrafo no PR ou comentário de QA) de que o segundo item do menu **não** convida a confusão com o picker e que **«Trocar organização»** continua o caminho óbvio para mudar de tenant — critério qualitativo, sem métrica instrumentada obrigatória no MVP.

### Definition of Done (por fatia)

| ID | DoD mínimo |
| -- | ----------- |
| **NAV-01** | PR com `DashboardShell` actualizado; captura ou lista de pathnames testados no corpo do PR. |
| **NAV-02** | PR com página nova + paridade funcional; se organismo extraído, Painel importa-o (sem duplicar lógica `runSync`). |
| **NAV-03** | PR de docs apenas ou anexo ao PR de NAV-02; referências actualizadas. |

---

## Registo de aprovação PO

| Data | Versão | Decisão | Assinatura |
| ---- | ------ | -------- | ---------- |
| 2026-04-24 | 1.1 | Refino SM (checklist @po); re-validar gate | @sm |
| 2026-04-24 | 1.2 | Refino SM (feedback PO 9,5/10: baseline estável, gate, âmbito Painel) | @sm |
| _pendente_ | 1.2 | Gate `*validate-story-draft` **ou** linha «Aprovado para implementação» | @po |

---

## Baseline código actual (pré-NAV) — `DashboardShell`

Referência: `apps/web/src/components/dashboard-shell.tsx` — **dois** mapeamentos `nav.map` sobre o mesmo array `nav` (sidebar desktop e navegação horizontal no header móvel). **Não** usar números de linha fixos no PR (o ficheiro pode mudar).

| Item `nav` | `href` actual | Regra `active` actual |
| ------------ | -------------- | --------------------- |
| Painel | `/dashboard` | `pathname === "/dashboard"` |
| Organização (a substituir) | `/empresas` | `pathname.startsWith("/empresas")` — inclui `/empresas`, `/empresas/nova`, `/empresas/uuid`, e **incorrectamente** trataria `/empresas-monitoradas` como prefixo de `/empresas` se só se usasse `startsWith("/empresas")` para o novo item |
| Execuções | `/execucoes` | `pathname.startsWith("/execucoes")` |
| Configurações | `/configuracoes` | `pathname.startsWith("/configuracoes")` |

**Após NAV-01:** preservar exactamente o comportamento de **Execuções** e **Configurações** da tabela acima (prefixo nos respectivos `href`). O segundo item passa a `href="/empresas-monitoradas"` com regra **dedicada** (igualdade ou `startsWith("/empresas-monitoradas/")` apenas).

---

## NAV-01 — Story: `DashboardShell` — menu «Empresas monitoradas» e estado activo

**Status:** Draft  

**Dependências (DoR):** Nenhuma.

**Referências:** Arquitectura §5, §8; spec UX §3; PRD **FR49**, **FR52**, **NFR24**; verificação **FR50** (link «Trocar organização» inalterado).

**Riscos:** Regressão de realce em `/empresas`, `/empresas/nova`, `/empresas/[id]`; colisão de prefixo `/empresas` vs `/empresas-monitoradas`.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` (matriz §8) + revisão rápida `@architect` se mudar lógica de pathname

### Story

**As a** operador autenticado com organização activa,  
**I want** ver no menu lateral e no header móvel o item **«Empresas monitoradas»** com destino correcto e indicador de página activa,  
**so that** acedo à lista de CNPJs sem confundir com o picker de organização.

### Acceptance Criteria

1. O segundo item do `nav` (aside e navegação móvel) exibe o rótulo **«Empresas monitoradas»** e `href="/empresas-monitoradas"` (**FR49**).  
2. O link **«Trocar organização»** mantém `href="/empresas"` e a mesma copy (**FR50**).  
3. Estado **activo** (realce visual existente):  
   - **Painel** activo sse `pathname === "/dashboard"`.  
   - **Empresas monitoradas** activo sse `pathname === "/empresas-monitoradas"` ou `pathname.startsWith("/empresas-monitoradas/")`.  
   - **Execuções** activo sse `pathname.startsWith("/execucoes")` (igual ao baseline).  
   - **Configurações** activo sse `pathname.startsWith("/configuracoes")` (igual ao baseline).  
   - Em `/empresas`, `/empresas/nova`, `/empresas/[id]`, `/empresas/.../usuarios`, o item «Empresas monitoradas» **não** está activo (**FR52**).  
4. **Proibido** usar `pathname.startsWith("/empresas")` como única condição para o item «Empresas monitoradas» — `"/empresas-monitoradas".startsWith("/empresas") === true` (nota crítica na arquitectura §5.1).  
5. No `Link` do item cujo destino coincide com a página actual, definir `aria-current="page"`; nos outros itens do `nav`, omitir o atributo (**NFR24**).  
6. Em `/empresas` (picker), **nenhum** dos quatro itens principais do `nav` está no estado activo (coerente com spec UX §3.2 / arquitectura §8.1), salvo decisão explícita futura documentada.

### Tasks / Subtasks

- [x] Refactor do array `nav`: suportar função `isActive(pathname)` por item (ou equivalente tipado).  
- [x] Actualizar labels e `href` conforme AC1–AC3.  
- [x] Aplicar `aria-current` em ambos os blocos de mapeamento (`aside` e header móvel).  
- [x] Verificar build e lint em `apps/web/src/components/dashboard-shell.tsx`.

### Dev Notes

- Ficheiro: `apps/web/src/components/dashboard-shell.tsx`.  
- **Entrega:** não publicar em `main` só NAV-01 sem a rota **NAV-02** (link quebrado). Combinação mínima aceitável: **um PR** com NAV-01 + NAV-02, ou branch de feature até ambos estarem prontos.  
- Não alterar `WorkspaceGate` nesta story salvo descoberta de bug (arquitectura §4.1: sem mudança obrigatória).

---

## NAV-02 — Story: página `/empresas-monitoradas` e paridade com o Painel

**Status:** Draft  

**Dependências (DoR):** **NAV-01** merged ou mesma branch com item de menu funcional.

**Referências:** PRD §6; spec UX §4; arquitectura §3, §6; `apps/web/src/app/(dashboard)/dashboard/page.tsx` (secção «Empresas monitoradas»).

**Riscos:** Drift de UI entre Painel e nova página; esquecer `usePortal` / `runSync`.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` (copy literal dos AC2–AC4). **`@po` apenas** se existir excepção ao AC2 (spec) ou proposta de mudança de âmbito; diferença Painel `h2`/subtítulo curto vs rota nova é **esperada** até **NAV-FU-02**.

### Story

**As a** operador autenticado,  
**I want** uma página dedicada com a lista de empresas monitoradas da organização activa e as mesmas acções essenciais que no Painel,  
**so that** trabalho a partir do menu ou de uma URL partilhável sem passar pelo picker.

### Acceptance Criteria

1. Existe `apps/web/src/app/(dashboard)/empresas-monitoradas/page.tsx` (Client Component se necessário para hooks), servindo **`/empresas-monitoradas`**.  
2. Página com **`h1`**: «Empresas monitoradas»; subtítulo: «CNPJs incluídos na automação de notas desta organização.» (spec UX §4.1 / copy deck `fiscal.list.*`).  
3. Lista alimentada por **`useMonitoredCompanies(effectiveOrganizationId)`** (ou par `useMeSummary` equivalente ao Painel) — mesma API que o Painel (**FR51**, PRD §6).  
4. Estado vazio: mensagem alinhada a **`fiscal.list.empty`** (**«Ainda não há CNPJs monitorados.»** — `docs/front-end-spec-dois-niveis-organizacao-vs-empresas-fiscais.md` §10) + link CTA para `/empresas/nova` com texto **«Nova empresa monitorada»** (paridade com `dashboard/page.tsx` e `fiscal.new.title`; **não** usar «Adicionar CNPJ» neste incremento salvo mudança explícita de PO).  
5. Com itens: botões ou equivalente que disparam **`runSync`** com rótulo visível **«Job mensal · {cnpjMasked}»** e **`aria-label`** descritivo (spec UX §6).  
6. Secção visual: cartão `rounded-xl border` coerente com a secção do Painel (spec UX §4.3).  
7. Estados loading / erro: skeleton ou `aria-busy`; erro com `role="alert"` e **Tentar novamente** se o hook expuser `reload` (paridade com padrões existentes).  
8. **Recomendado (DoD forte):** extrair organismo partilhado (ex. `MonitoredCompaniesSection`) usado por `dashboard/page.tsx` e por esta página — se não feito neste PR, abrir dívida técnica com link para **NAV-02** follow-up.

### Tasks / Subtasks

- [x] Criar rota e página sob `(dashboard)`.  
- [x] Integrar `usePortal`, `useMeSummary` / `useMonitoredCompanies` como no Painel.  
- [x] (Recomendado) Extrair componente partilhado e refactor do Painel.  
- [ ] Teste manual da matriz pathnames + lista vazia + disparo (ambiente local).

### Dev Notes

- Não criar novos Route Handlers.  
- `WorkspaceGate`: confirmar que `/empresas-monitoradas` **não** está em `ALLOW_NO_ACTIVE` e que redirecciona para `/empresas?next=...` sem org (comportamento actual).  
- Link opcional «Ir ao painel» — fora do MVP (PRD §6).  
- **Âmbito copy:** a secção «Empresas monitoradas» no **Painel** (`/dashboard`) pode manter `h2`/subtítulo actuais neste incremento; a obrigatoriedade de `fiscal.list.title` / `fiscal.list.subtitle` aplica-se à **rota** `/empresas-monitoradas` (AC2). Harmonização total → **NAV-FU-02**.

---

## NAV-03 — Story (opcional): documentação QA e referências ao menu antigo

**Status:** Draft  

**Dependências (DoR):** **NAV-01** e **NAV-02** concluídos ou em validação final.

**Referências:** PRD §9 NAV-01.3; **NFR25**.

**Executor Assignment**

- **executor:** `@dev` ou `@qa` (conforme equipa)

### Story

**As a** revisor de qualidade,  
**I want** evidências e documentação actualizadas que referenciem o novo item de menu,  
**so that** regressões futuras de navegação sejam detectáveis.

### Acceptance Criteria

1. Se existir ficheiro em `docs/qa/` que mencione «Organização» na sidebar, actualizar para **«Empresas monitoradas»** e pathname `/empresas-monitoradas`.  
2. Opcional: linha no checklist de smoke interno com path `/empresas-monitoradas` + assert de `h1`.  
3. Se não houver docs a actualizar, fechar esta story como **N/A** com comentário no tabuleiro / PR.

### Tasks / Subtasks

- [x] Grep em `docs/qa` por «Organização» / `sidebar` / `dashboard-shell`.  
- [x] PR de docs ou secção «QA evidence» no PR principal.

---

## Backlog / follow-up (fora do MVP deste incremento)

| ID | Descrição |
| -- | ----------- |
| **NAV-FU-01** | Estado activo em «Empresas monitoradas» quando `pathname` é `/empresas/nova` ou `/empresas/[id]` (pai fiscal) — apenas após decisão de produto (spec UX §3.2). |
| **NAV-FU-02** | Unificar subtítulo da secção no Painel com `fiscal.list.subtitle` para uma única fonte de copy. |

---

## QA Results

**Revisor:** Quinn (@qa)  
**Data:** 2026-04-24  
**Âmbito:** revisão estática do código + `tsc --noEmit` em `apps/web` (sem browser/e2e nesta passagem).

### Decisão de gate

**PASS com observações (CONCERNS)** — critérios funcionais e de copy de NAV-01 / NAV-02 / NAV-03 reflectem-se no código; permanecem itens do **DoD macro** e smoke manual por fechar antes de merge sem reservas.

### Rastreio NAV-01 → código (`dashboard-shell.tsx`)

| AC | Verificação | Resultado |
| -- | ----------- | --------- |
| AC1 | Segundo item `Empresas monitoradas`, `href="/empresas-monitoradas"` em `navItems`; aside + header móvel iteram o mesmo array. | OK |
| AC2 | «Trocar organização» → `href="/empresas"`, copy inalterada. | OK |
| AC3 | Regras `isActive` por item: Painel `=== /dashboard`; empresas `===` ou `startsWith("/empresas-monitoradas/")`; Execuções/Config com `startsWith` dos prefixos correctos. | OK |
| AC3 (sub) | `/empresas`, `/empresas/nova`, prefixos fiscais: item empresas não activo (não usa `/empresas` para activar esse item). | OK |
| AC4 | Não há `startsWith("/empresas")` como condição do segundo item; regra dedicada para `/empresas-monitoradas`. | OK |
| AC5 | `aria-current="page"` só quando `active`; caso contrário `undefined` (omitido). | OK |
| AC6 | Em `/empresas` nenhum dos quatro `isActive` devolve true. | OK |

### Rastreio NAV-02 → código

| AC | Verificação | Resultado |
| -- | ----------- | --------- |
| AC1 | `empresas-monitoradas/page.tsx` sob `(dashboard)`, `"use client"`. | OK |
| AC2 | `h1` «Empresas monitoradas»; subtítulo literal «CNPJs incluídos na automação de notas desta organização.» (ponto final incluído). | OK |
| AC3 | `MonitoredCompaniesSection` usa `useMeSummary` + `useMonitoredCompanies(effectiveOrganizationId)` como o Painel. | OK |
| AC4 | Empty: «Ainda não há CNPJs monitorados.» + link «Nova empresa monitorada» → `/empresas/nova`. | OK |
| AC5 | Botões `Job mensal · {cnpjMasked}` + `runSync`; `aria-label` descritivo presente. | OK |
| AC6 | Secção `rounded-xl border … p-6` alinhada ao padrão do Painel. | OK |
| AC7 | Loading: `aria-busy` na `<section>`; erro `role="alert"` + «Tentar novamente» → `reload`. | OK |
| AC8 | Organismo `MonitoredCompaniesSection` partilhado; `dashboard/page.tsx` importa-o. | OK |

**WorkspaceGate:** `ALLOW_NO_ACTIVE` não inclui `/empresas-monitoradas`; rota exige contexto de workspace como esperado.

### Rastreio NAV-03

| AC | Verificação | Resultado |
| -- | ----------- | --------- |
| AC1 | `docs/qa/org-08-wcag-evidence.md` actualizado (menu + paths). | OK |
| AC2 (opcional) | Linha de smoke interno com assert de `h1` para `/empresas-monitoradas` — **não** encontrada; opcional. | N/A / melhoria |

### Observações (CONCERNS)

1. **Painel — dupla chamada à API:** `dashboard/page.tsx` mantém `useMonitoredCompanies` para o contador do cartão KPI **e** `MonitoredCompaniesSection` volta a invocar o mesmo hook → **dois** fetch ao mesmo `organizationId` na mesma vista. Sugestão de dívida técnica: passar `companies`/`length` do pai ou usar cache de dados (ex. React Query) para uma única fonte.
2. **DoD macro (documento):** checkboxes globais ainda por assinar — matriz pathname + smoke `?next=…`, parágrafo UAT qualitativo (PRD). Recomenda-se completar na validação de PR / release.
3. **Processo:** «Estado do conjunto: Draft» e registo `@po` pendente; isto não invalida a revisão técnica mas o fluxo AIOS pode exigir `*validate-story-draft` antes de *Ready for sprint*.

### Evidência de build

- `npm run typecheck` em `apps/web`: **OK** (execução 2026-04-24).

---

*Stories preparadas pelo SM (AIOS); implementação exclusivamente pelo `@dev`.*
