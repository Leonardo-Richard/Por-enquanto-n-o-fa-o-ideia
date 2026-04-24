# User stories — Incremento: empresas monitoradas — edição e sincronização ADN na lista (épico **EM-01**)

**Produto:** Portal NF  
**Fontes:** `docs/prd-empresas-monitoradas-editar-e-forcar-automacao.md`, `docs/architecture-empresas-monitoradas-editar-e-forcar-automacao.md`, `docs/front-end-spec-empresas-monitoradas-editar-e-forcar-automacao.md`, `docs/briefing-empresas-monitoradas-editar-e-forcar-automacao.md`  
**Pré-requisito:** rota `/empresas-monitoradas` e item de menu operacionais (`docs/stories/incremento-nav-sidebar-empresas-monitoradas.md` — **NAV-01** + **NAV-02**); componente `MonitoredCompaniesSection` partilhado entre Painel e página dedicada.  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-24  
**Versão do conjunto:** **1.1** — refino SM pós-gate PO **v1.0** **9,5/10**; re-validação PO **v1.1** **10/10** (story **EM-01A**, **AC9** **NFR29**, testes **EM-01A**).  
**Estado do conjunto:** **Ready for sprint** (conteúdo DoR satisfeito; `@dev` confirma pré-requisito **NAV-02** antes de codar).

### Refino 1.1 (critérios @po — incorporados)

| Feedback PO | Tratamento neste documento |
| ------------- | --------------------------- |
| Persona **EM-01A** pouco orientada a valor | **Story** reescrita no formato operador + *so that* alinhado a paridade ficha/lista (**NFR26**). |
| **NFR29** na UI da lista | Novo **AC9** em **EM-01B** — inconsistência `company.organizationId` vs org activa. |
| Testes **EM-01A** vs checklist manual | **DoD EM-01A** e **Tasks**: **testes unit** em `adn-sync-client` como **critério preferido**; checklist manual só se CI/`vitest` indisponível (registar no PR). |

### Avaliação PO @pax — conjunto **v1.0** (gate *validate-story-draft*)

| Critério | Comentário |
| -------- | ---------- |
| **Rastreio** | Excelente: PRD **FR53–FR57** / **NFR26–29**, épico **EM-01.1–.5**, spec UX EM e arquitectura EM estão mapeados ao índice e às fatias **EM-01A–C**. |
| **Sequência** | **EM-01A → B → C** é coerente com a arquitectura (factorizar antes da lista); alternativa «PR único A+B» está explícita — reduz risco de drift. |
| **Conflito NAV** | Secção **NAV-02** AC5 vs **EM-01** está **anticipada**; **EM-01C** fecha o ecossistema de docs — forte integridade documental. |
| **DoD** | Macro + por fatia são **testáveis**; matriz QA (admin / sem permissão / 404 / tab) alinha ao PRD. |
| **Melhorias (v1.0 → v1.1)** | **Tratadas** na **v1.1** — ver «Refino 1.1» (persona **EM-01A**, **AC9** **NFR29**, testes preferidos **EM-01A**). |

**Nota global (histórico v1.0):** **9,5 / 10** — gate inicial; micro-melhorias integradas pelo **@sm** na **v1.1**.

### Avaliação PO @pax — conjunto **v1.1** (re-validação pós-refino SM)

| Critério | Comentário |
| -------- | ---------- |
| **Valor / INVEST** | **EM-01A** com narrativa de **operador** e *so that* explícito sobre paridade ficha/lista (**NFR26**). |
| **Segurança produto** | **EM-01B** **AC9** fecha **NFR29** na UI (org activa vs `company.organizationId`) com estratégia documentável no PR. |
| **Verificabilidade** | DoD **EM-01A** com **preferência** por testes unit em CI e fallback **justificado** — critério operacional claro. |
| **Rastreio** | Tabela **FR/NFR** actualizada (**NFR29** em linha própria); **CodeRabbit** aponta **AC9**. |

**Nota global (v1.1):** **10 / 10** — **aprovado sem reservas** para `@dev`; lembrete único: **DoR** — confirmar **NAV-02** entregue antes do primeiro merge de código **EM-01**.

### Nota de alinhamento com **NAV-02**

O **NAV-02** AC5 ainda descreve pills **«Job mensal · {cnpjMasked}»** com **`runSync`**. Após entrega **EM-01**, esse AC fica **historicamente desactualizado**: a paridade Painel ↔ página passa a ser **lista com Editar + ADN** (PRD §7, spec EM §1). Actualizar `incremento-nav-sidebar-empresas-monitoradas.md` (nota de supersessão ou **NAV-02** revisto) na mesma entrega **EM-01C** ou PR único.

### DoR para `@dev` (checklist rápida)

- [ ] Ler PRD EM-01, spec UX EM e arquitectura EM (ou resumo neste ficheiro).  
- [ ] Confirmar que **NAV-02** está entregue (rota + `MonitoredCompaniesSection`).  
- [ ] Branch sugerida: `feature/em-01-monitored-list-adn` (ou nome da equipa).  
- [ ] Ordem de merge recomendada: **EM-01A** → **EM-01B** → **EM-01C** (01A+01B podem ser **um único PR** se a equipa preferir atomicidade).

---

## Índice

| ID | Título resumido | Dependências |
| -- | ----------------- | -------------- |
| **EM-01A** | Cliente ADN partilhado (`adn-sync-client`) + hook + migração **`AdnSyncPanel`** sem mudança visual | Nenhuma (além do pré-requisito NAV) |
| **EM-01B** | **`MonitoredCompaniesSection`**: linhas, **Editar**, **Pedir sincronização ADN**, concorrência `GET`, remover **`usePortal`/`runSync`** | **EM-01A** (ou mesmo PR se entrega atómica) |
| **EM-01C** | Documentação — supersessão NAV / architecture-nav / spec NAV (evidência QA no PR **EM-01B** ou **EM-01C**) | **EM-01B** |

**Ordem sugerida:** EM-01A → EM-01B → EM-01C.

### Rastreio PRD épico EM-01 → stories

| PRD (história) | Cobertura nas stories EM |
| -------------- | -------------------------- |
| **EM-01.1** (editar na lista) | **EM-01B** — AC Editar / `Link` |
| **EM-01.2** (admin pede ADN na lista) | **EM-01B** — POST + confirmação + 202 |
| **EM-01.3** (sem permissão) | **EM-01B** — estados `forbidden` / UI sem CTA enganosa |
| **EM-01.4** (regressão listagem) | **EM-01B** DoD + **EM-01C** |
| **EM-01.5** (a11y) | **EM-01B** — `aria-label`, tab order, `aria-live` |

### Rastreio FR / NFR

| ID | Story principal |
| -- | ---------------- |
| **FR53**, **FR54**, **FR55**, **FR57** | **EM-01B** |
| **FR56** | **EM-01B** (preservar comportamento `useMonitoredCompanies`) |
| **NFR26** | **EM-01A** (factorização), **EM-01B** (consumo) |
| **NFR27**, **NFR28** | **EM-01A** + **EM-01B** |
| **NFR29** | **EM-01A** (URL só com dados da API/props) + **EM-01B** AC9 (org activa vs `company.organizationId`) |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit no PR.  
- **Foco:** duplicação de strings ADN vs ficha; fugas de `organizationId` na URL; verificação **EM-01B** AC9 (org activa vs linha); ausência de `startsWith("/empresas")` incorrecto no `nav` (não objecto deste épico, mas não regressar); **não** reintroduzir `runSync` na lista.

---

## Definition of Done (macro)

- [ ] **`MonitoredCompaniesSection`** não importa **`usePortal`** nem chama **`runSync`** para linhas de empresas.  
- [ ] **`POST .../adn/sync`** na lista usa **Idempotency-Key**, `{}` no corpo, e tratamento **202 / 403 / 429** com as **mesmas mensagens** que `AdnSyncPanel` (**NFR27**).  
- [ ] **`GET .../adn/sync`** por empresa com **limite de concorrência** (pool 2–3 ou lazy por viewport — arquitectura §6); sem thundering herd ilimitado.  
- [ ] Paridade **Painel** (`/dashboard`) e **`/empresas-monitoradas`** para a secção de monitoradas (mesmo componente ou diff documentado).  
- [ ] Evidência **QA** curta no PR: admin com ADN activo; utilizador sem permissão; org/feature ADN indisponível (404); tab order (smoke).  
- [ ] Actualização de docs **EM-01C** ou nota no PR: supersessão **NAV-02** AC5, `architecture-nav` §1 (`runSync`), `front-end-spec-nav` §4.2.

### Definition of Done (por fatia)

| ID | DoD mínimo |
| -- | ----------- |
| **EM-01A** | `AdnSyncPanel` usa módulo/hook partilhado; **preferencial:** testes unit em `adn-sync-client` (mocks `Response`) a correr em CI em `apps/web`; **fallback:** checklist manual «comportamento idêntico à ficha» no PR **com justificação** se testes não forem viáveis no sprint. |
| **EM-01B** | Lista em linhas com **Editar** + **Pedir sincronização ADN**; screenshots ou vídeo curto opcional; sem regressão em empty/erro/reload. |
| **EM-01C** | PR de docs ou secção no PR EM com links aos ficheiros actualizados. |

---

## Registo de aprovação PO

| Data | Versão | Decisão | Assinatura |
| ---- | ------ | -------- | ---------- |
| 2026-04-24 | 1.0 | Rascunho SM (conjunto EM-01A–C) | @sm |
| 2026-04-24 | 1.0 | Gate `*validate-story-draft`: **nota 9,5/10** — aprovado para implementação (ver secção «Avaliação PO @pax») | @po |
| 2026-04-24 | 1.1 | Refino SM: critérios PO v1.1 (story EM-01A, AC9 **NFR29**, DoD testes **EM-01A**, índice **EM-01C**) | @sm |
| 2026-04-24 | 1.1 | Re-validação PO: **nota 10/10** — aprovado sem reservas (secção «Avaliação PO @pax — v1.1») | @po |

---

## EM-01A — Story: cliente ADN partilhado e migração do `AdnSyncPanel`

**Status:** Ready for Review  

**Dependências (DoR):** Nenhuma além do pré-requisito NAV.

**Referências:** Arquitectura EM §3.1, §4, §12 passos 1–2; PRD **NFR26**; `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`.

**Riscos:** Regressão sutil de mensagens ou de polling após refactor.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` — smoke na ficha empresa (ADN activo / feature off / forbidden)

### Story

**As a** operador que consulta a **ficha da empresa** e a **lista de empresas monitoradas**,  
**I want** que a lógica cliente de **GET/POST** ADN exista **uma só vez** (módulo puro + hook),  
**so that** mensagens de erro/sucesso, estados (`feature_off`, `forbidden`, …) e o fluxo de confirmação **não diverjam** entre a ficha e a lista quando **EM-01B** for implementada (**NFR26**).

### Acceptance Criteria

1. Existe **`apps/web/src/lib/adn-sync-client.ts`** (ou nome equivalente acordado) com funções puras: construir URL `.../organizations/{organizationId}/monitored-companies/{companyId}/adn/sync`, executar **GET** e **POST** com `credentials: "include"`, cabeçalhos exigidos no **POST** (`Content-Type`, `Idempotency-Key`), e tipos/resultados que permitam mapear **404 → feature_off**, **403 → forbidden**, **200 → active**, erros → `error`.  
2. Existe hook **`useAdnSyncForCompany`** (ou nome equivalente) que expõe pelo menos: `access`, `lastJob` (se aplicável), `busy`, `actionMsg`, `refresh()`, `requestSync()` (inclui confirmação com o texto **«Pedir sincronização ADN agora? (fila no portal)»** salvo substituição acessível aprovada por **@qa**).  
3. **`AdnSyncPanel`** delega **toda** a lógica de `fetch` e tratamento de status HTTP no módulo/hook; **comportamento observável** da ficha permanece equivalente (mensagens, botões, polling quando `running`).  
4. **NFR29:** URLs usam `company.organizationId` e `company.id` provenientes da API / props — não aceitar `organizationId` arbitrário de fonte não confiável.

### Tasks / Subtasks

- [x] Criar `adn-sync-client.ts` com **testes unit** (mocks `Response`) cobrindo pelo menos: **200** → estado activo, **404** → `feature_off`, **403** → `forbidden`, **POST 202**, **POST 403**, **POST 429** com `Retry-After` (nomes de funções/casos conforme implementação).  
- [x] Criar `use-adn-sync-for-company.ts`.  
- [x] Refactor `AdnSyncPanel` para consumir o hook.  
- [x] `pnpm` / lint / `tsc` em `apps/web` sem erros; confirmar que os novos testes passam no script de teste do pacote (ex.: `pnpm test` / `vitest` conforme repo).

### Dev Notes

- Não alterar handlers servidor `adn-sync.ts` nesta story salvo bug bloqueante.  
- Nomes de ficheiros exactos podem ajustar-se no PR desde que **NFR26** seja cumprido (uma fonte de verdade para fetch + mensagens).  
- **Testes:** localizar o padrão de testes em `apps/web` (ex.: `*.test.ts` junto ao código ou pasta `__tests__`); se não existir runner configurado, **@dev** regista no PR o impedimento e anexa **checklist manual** assinado por **@qa** (excepção rara).

---

## EM-01B — Story: lista de empresas monitoradas — layout, Editar e ADN (sem `runSync`)

**Status:** Ready for Review  

**Dependências (DoR):** **EM-01A** concluído **ou** incluído no mesmo PR de forma revista.

**Referências:** PRD **FR53–FR57**; spec UX EM §3–§7; arquitectura EM §3.2, §5, §6; `apps/web/src/components/monitored-companies-section.tsx`.

**Riscos:** Performance com muitas empresas; regressão de empty state; drift de copy vs ficha.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` — matriz perfis + ADN on/off (**EM-01.2**, **EM-01.3**, **EM-01.5**)

### Story

**As a** operador com organização activa,  
**I want** ver cada empresa monitorada numa linha clara com **Editar** e **Pedir sincronização ADN**,  
**so that** altero dados na ficha ou enfileiro sync real **sem** confundir com simulação local.

### Acceptance Criteria

1. **FR53:** Cada linha inclui **`Link`** (recomendado) com rótulo **«Editar»** para **`/empresas/{id}`**; `aria-label` conforme spec UX (`monitored.row.edit.aria`).  
2. **FR54:** Quando o hook indicar `access === "active"`, cada linha mostra botão **«Pedir sincronização ADN»** (rótulo igual à ficha); ao clicar, confirmação e **POST** com o mesmo contrato que **EM-01A**; sucesso **202** mostra **«Pedido aceite. O job foi enfileirado.»**; **403** e **429** com mensagens alinhadas à ficha (**NFR27**, **NFR28**).  
3. **FR55:** Em `feature_off` (GET 404), **não** renderizar o botão de **POST**; em `forbidden` / `error`, seguir spec UX EM §4.3 (ocultar ou mensagem secção — sem CTA que sugira sucesso falso).  
4. **FR56:** Estados da **listagem** (`useMonitoredCompanies`): loading, erro com retry, vazio com **«Nova empresa monitorada»** → `/empresas/nova` — **inalterados** em copy e fluxo.  
5. **FR57:** Não usar um único `<button>` em volta da linha inteira; ordem de tab: **Editar** → **Pedir sincronização ADN**; região de feedback com **`aria-live="polite"`** quando aplicável.  
6. **Layout:** identificação com `tradeName`, `systemCode`, `cnpjMasked` (spec EM §3.1); acções responsivas (spec EM §8).  
7. **Concorrência:** implementar **pool limitado** (ex.: 2–3 paralelos) e/ou **lazy** por viewport conforme arquitectura §6 — documentar no PR o mecanismo escolhido.  
8. **Remover** `usePortal` / **`runSync`** desta secção; o Painel continua a poder usar `PortalProvider` para **outras** áreas (ex.: execuções locais) sem alimentar a lista a partir de `runSync`.  
9. **NFR29 (defesa em profundidade na UI):** se `company.organizationId` **≠** `effectiveOrganizationId` da página (valor do mesmo hook/contexto usado em `useMonitoredCompanies`), **não** renderizar acções ADN para essa linha (e **não** construir URL ADN); opcional: não renderizar a linha inteira e log em consola **só em dev** — escolher **uma** estratégia e documentar no PR. *Nota:* com a API actual de listagem por org, o caso deve ser **improvável**; o AC existe para fechar risco de dados cruzados.

### Tasks / Subtasks

- [x] Refactor UI: tabela ou `<ul>` semântico conforme spec.  
- [x] Integrar `useAdnSyncForCompany` por `company.id` + `company.organizationId`.  
- [x] Remover dependência `usePortal` em `monitored-companies-section.tsx`.  
- [x] (Opcional) Extrair `monitored-company-row.tsx`.  
- [x] Verificar `/dashboard` e `/empresas-monitoradas`.

### Dev Notes

- `Company` em `@repo/shared` inclui **`organizationId`** — usar na construção da URL ADN.  
- Se **EM-01A** estiver no mesmo PR, entregar em commits ordenados para facilitar revisão.

---

## EM-01C — Story: documentação — supersessão NAV / arquitectura / spec UX

**Status:** Ready for Review  

**Dependências (DoR):** **EM-01B** concluído ou em validação final com UI estável.

**Referências:** Arquitectura EM «Supersessão»; spec EM §11; `docs/architecture-nav-sidebar-empresas-monitoradas.md` §1; `docs/front-end-spec-nav-sidebar-empresas-monitoradas.md` §4.2; `incremento-nav-sidebar-empresas-monitoradas.md` NAV-02 AC5.

**Executor Assignment**

- **executor:** `@dev` ou **@sm** / **@qa** (conforme equipa — pode ser PR só de docs)

### Story

**As a** membro da equipa,  
**I want** documentação alinhada ao comportamento **ADN** na lista,  
**so that** futuros incrementos não regressam para **`runSync`** na paridade NAV.

### Acceptance Criteria

1. `docs/architecture-nav-sidebar-empresas-monitoradas.md`: tabela resumo §1 actualizada — lista de monitoradas **não** cita **`runSync`** como paridade; referência cruzada ao doc **architecture-empresas-monitoradas-editar-e-forcar-automacao.md**.  
2. `docs/front-end-spec-nav-sidebar-empresas-monitoradas.md` §4.2: paridade lista actualizada (linhas + Editar + ADN) **ou** nota «ver spec EM» + link.  
3. `docs/stories/incremento-nav-sidebar-empresas-monitoradas.md`: nota em **NAV-02** AC5 ou change log indicando supersessão por **EM-01**.  
4. Se não houver alterações necessárias (grep sem achados), registar **N/A** no PR com justificação.

### Tasks / Subtasks

- [x] Grep por «Job mensal», `runSync`, paridade Painel na doc NAV/spec NAV.  
- [x] PR de docs ou commit no PR EM-01B.

---

## Dev Agent Record

**Agent Model Used:** (Cursor / implementação local)

### Completion Notes

- **EM-01A:** `adn-sync-client.ts` com `buildAdnSyncSyncUrl`, `interpretAdnSyncGetResponse`, `interpretAdnSyncPostResponse`, `fetchAdnSyncStatus` (pool **3** GETs concurrentes), `postAdnSyncRequest`; testes em `adn-sync-client.test.ts`; hook `use-adn-sync-for-company.ts`; `AdnSyncPanel` delega ao hook.
- **EM-01B:** `MonitoredCompanyRow` + `MonitoredCompaniesSection` com `<ul>`/`<li>`, `effectiveOrganizationId` (NFR29 **AC9** — sem ADN se `company.organizationId` ≠ org activa; `console.warn` só em dev); removidos `usePortal`/`runSync` da lista; Painel e `/empresas-monitoradas` passam `effectiveOrganizationId`.
- **EM-01C:** Actualizados `docs/architecture-nav-sidebar-empresas-monitoradas.md`, `docs/front-end-spec-nav-sidebar-empresas-monitoradas.md`, `docs/stories/incremento-nav-sidebar-empresas-monitoradas.md` (NAV-02 AC5, DoD NAV-02, QA table, riscos).
- **Validação:** `npm run test`, `npm run typecheck`, `npm run lint` em `apps/web` — OK.
- **Pós-QA (CONCERNS):** `useAdnSyncForCompany` expõe `actionTone` (`success` | `error` | `none`) — mensagens pós-POST usam estilo **emerald** vs **âmbar** e `role="status"` vs `role="alert"`. Regra **AC9** extraída para `monitored-company-adn-guard.ts` + testes `monitored-company-adn-guard.test.ts`. **DoD macro + CodeRabbit:** cumprir no PR (smoke manual + scan); não automatizado neste ambiente.

### File List

- `apps/web/src/lib/adn-sync-client.ts` (novo)
- `apps/web/src/lib/adn-sync-client.test.ts` (novo)
- `apps/web/src/lib/monitored-company-adn-guard.ts` (novo)
- `apps/web/src/lib/monitored-company-adn-guard.test.ts` (novo)
- `apps/web/src/hooks/use-adn-sync-for-company.ts` (novo)
- `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`
- `apps/web/src/components/monitored-company-row.tsx` (novo)
- `apps/web/src/components/monitored-companies-section.tsx`
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- `apps/web/src/app/(dashboard)/empresas-monitoradas/page.tsx`
- `docs/architecture-nav-sidebar-empresas-monitoradas.md`
- `docs/front-end-spec-nav-sidebar-empresas-monitoradas.md`
- `docs/stories/incremento-nav-sidebar-empresas-monitoradas.md`

### Change Log

| Data | Autor | Descrição |
| ---- | ----- | ----------- |
| 2026-04-24 | @dev | Entrega EM-01A–C (cliente ADN, lista, docs NAV). |
| 2026-04-24 | @dev | Pós-QA: `actionTone` no hook ADN; guard NFR29 + testes; alívio UX mensagens erro vs sucesso. |

### Debug Log References

- Nenhum.

---

## QA Results

**Revisor:** Quinn (@qa)  
**Data:** 2026-04-24  
**Âmbito:** revisão estática do código + rastreio aos AC **EM-01A–C** + `npm run test` em `adn-sync-client.test.ts` (sem browser / e2e nesta passagem).

### Decisão de gate

**PASS com observações (CONCERNS)** — a implementação cobre os critérios de aceite principais e o DoD por fatia; permanecem itens do **DoD macro** (evidência manual no PR, CodeRabbit) e pequenos pontos de UX/a11y abaixo.

### Rastreio EM-01A → código

| AC | Verificação | Resultado |
| -- | ----------- | --------- |
| AC1 | `adn-sync-client.ts`: `buildAdnSyncSyncUrl`, `fetchAdnSyncStatus` (`credentials: "include"`), `postAdnSyncRequest` com `Content-Type`, `Idempotency-Key`, `{}`; interpretações 404 / 403 / OK → `feature_off` / `forbidden` / `active` / `error`. | OK |
| AC2 | `use-adn-sync-for-company.ts`: expõe `access`, `lastJob`, `busy`, `actionMsg`, `refresh`, `requestSync`; texto de confirmação literal **«Pedir sincronização ADN agora? (fila no portal)»**. | OK |
| AC3 | `AdnSyncPanel` só compõe UI; fetch e HTTP via hook + cliente. | OK |
| AC4 (NFR29) | Hook recebe `companyId` + `organizationId`; URL só a partir destes argumentos (callers passam dados da API). | OK |
| DoD testes | `adn-sync-client.test.ts` (vitest): GET 200/404/403/5xx; POST 202/403/429/400. **10** testes a verde localmente. | OK |

### Rastreio EM-01B → código

| AC | Verificação | Resultado |
| -- | ----------- | --------- |
| FR53 | `Link` «Editar» → `/empresas/{id}`; `aria-label` descritivo (`Editar empresa {tradeName} ({cnpjMasked})`). | OK |
| FR54 | Com `access === "active"`, botão **«Pedir sincronização ADN»**; `requestSync` → confirmação + `postAdnSyncRequest`; mensagem **202** idêntica à ficha; **403** / **429** via mesmo cliente/hook que o painel. | OK |
| FR55 | Sem botão POST em `feature_off`; `forbidden` / `error` sem CTA de POST (só **Actualizar** em erro = novo GET, aceitável). | OK |
| FR56 | Loading / erro + retry / vazio + «Nova empresa monitorada» → `/empresas/nova` inalterados no fluxo de `useMonitoredCompanies`. *Nota:* o **subtítulo** opcional do `h2` da secção (quando `showSectionHeading`) foi alinhado ao ADN — não afecta os três estados do hook. | OK (nota) |
| FR57 | Sem `<button>` envolvendo a linha; ordem DOM: **Editar** (link) antes do botão ADN; `aria-live="polite"` no estado ADN e em `actionMsg`. | OK |
| Layout §6 | `tradeName`, `systemCode`, `cnpjMasked` visíveis; layout responsivo (`flex-col` / `sm:flex-row`). | OK |
| Concorrência | Pool global **3** GETs paralelos em `fetchAdnSyncStatus` — cumpre arquitectura §6 (2–3). **Lazy por viewport:** não implementado; aceitável como «ou» se o PR documentar o pool (Dev Record já menciona). | OK |
| Remover `runSync` | `monitored-companies-section.tsx` sem `usePortal` / `runSync` (grep). | OK |
| AC9 NFR29 | Se `company.organizationId !== effectiveOrganizationId`, renderiza linha **sem** hook ADN (sem URL ADN); `console.warn` só em `development`. | OK |

### Rastreio EM-01C → documentação

| AC | Verificação | Resultado |
| -- | ----------- | --------- |
| AC1 | `architecture-nav-sidebar-empresas-monitoradas.md` §1: sem `runSync` como paridade; referência a `docs/architecture-empresas-monitoradas-editar-e-forcar-automacao.md`. | OK |
| AC2 | `front-end-spec-nav-sidebar-empresas-monitoradas.md` §4.2 actualizado + link ao spec EM. | OK |
| AC3 | `incremento-nav-sidebar-empresas-monitoradas.md`: NAV-02 AC5 / QA / riscos com supersessão **EM-01**. | OK |

### Observações (CONCERNS)

1. **DoD macro (story):** checkboxes no topo do documento continuam por marcar; recomenda-se anexar no **PR** o parágrafo de smoke (admin / sem permissão / 404 ADN / tab order) e marcar o DoD na revisão de merge.  
2. **CodeRabbit:** não executado nesta revisão; alinhar ao quality gate da story antes do merge.  
3. **Mensagens de erro no `actionMsg`:** na ficha e na lista, `actionMsg` usa o mesmo estilo **emerald** para sucesso e para erros (403/429/outros) — paridade com o código anterior da ficha, mas **dívida UX** (contraste semântico sugerido em **EM-FU-02** junto com substituir `window.confirm`).  
4. **Testes:** cobertura unit no **cliente**; não há teste de componente para `MonitoredCompanyRow` / integração ADN na lista — risco residual **baixo** se a matriz manual do PR for cumprida.

### Evidência de comando (local)

```text
npm run test -- --run src/lib/adn-sync-client.test.ts  →  10 passed
```

---

## Backlog / follow-up (fora do MVP deste incremento)

| ID | Descrição |
| -- | ----------- |
| **EM-FU-01** | Coluna «Último job ADN» por linha (spec EM §5.3) se métricas de performance o permitirem. |
| **EM-FU-02** | Substituir `window.confirm` por `<dialog>` acessível (coordenação **@qa**). |
| **EM-FU-03** | Endpoint agregado «estado ADN por org» para evitar N× `GET` (requer PRD/API novo). |

---

*User stories elaboradas no âmbito AIOS (SM — River); versão do conjunto **1.1**.*
