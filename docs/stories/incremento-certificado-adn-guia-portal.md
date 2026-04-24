# User stories — Incremento: certificado e-CNPJ + guia ADN (runbook + portal)

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** `docs/prd-importacao-certificado-empresa-monitorada-adn.md`, `docs/front-end-spec-importacao-certificado-empresa-monitorada-adn.md`, `docs/architecture-importacao-certificado-empresa-monitorada-adn.md`, `docs/briefing-importacao-certificado-empresa-monitorada-adn.md`  
**Pré-requisito (UI):** bloco **Sincronização ADN** no detalhe da empresa monitorada (**ADN-07** em `docs/stories/incremento-integracao-nfse-dist-adn.md`) com **FR45** activo quando aplicável. Stories **CER-04** / **CER-05** assumem que a base ADN mínima existe.  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-24  
**Versão do conjunto:** **0.4** — refinamento pós-avaliação PO **9,5/10**: **Ready por story** (§abaixo), fronteira **MVP vs worker real** em **CER-05**, cabeçalho desanclado de nota histórica única.  
**Estado do conjunto:** **Draft** (default) — ver **§Promoção de estado** abaixo.

---

## Ready por story (**CER-01** … **CER-05**)

Cada bloco **CER-0x** mantém `**Status:** Draft` até cumprir **todos** os pontos aplicáveis:

1. **DoR** da story (secção **Dependências (DoR)**) cumprido ou **excepção** registada no PR com acordo explícito de `@po` (ou delegado).  
2. **Todos os AC** da story verificáveis no PR (checklist, comentário de revisão ou evidência **@qa** quando listado).  
3. **§Definition of Done — conjunto CER** — itens aplicáveis ao PR satisfeitos.  
4. **Promoção de linha:** no merge que fecha a story, actualizar neste ficheiro `**Status:** Draft` → `**Status:** Ready` no bloco respectivo **ou**, se o PR for só código, abrir PR subsequente em `docs/` só com essa alteração + referência ao PR de implementação.

**Nota:** **Ready for sprint** (nível conjunto) continua em **§Promoção de estado**; **Ready** por story pode ocorrer antes do conjunto estar **Ready for sprint** se `@po` validar stories incrementalmente.

---

## Promoção de estado (**Draft** → **Ready for sprint**)

| Estado | Critério |
| ------ | -------- |
| **Draft** | Conjunto ainda em refinamento ou aguarda `*validate-story-draft` por `@po`. |
| **Ready for sprint** | `@po` (ou delegado) executou **`*validate-story-draft`** neste ficheiro **ou** regista nesta linha: data + “AC e DoD § abaixo aceites para pull”; nenhum bloqueador aberto nas dependências **ADN-04** / **ADN-07** quando a story respectiva for incluída no sprint. |

**Instrução:** ao promover, actualizar a linha **Estado do conjunto:** no cabeçalho para **Ready for sprint** e duplicar a data na tabela opcional:

| Data | Estado | Nota |
| ---- | ------ | ---- |
| *(preencher)* | Ready for sprint | Validado `@po` |

---

## Definition of Done — conjunto **CER** (todas as stories)

Cada PR que feche **CER-0x** deve satisfazer **todos** os itens aplicáveis:

1. **AC** da story cumpridos e verificáveis (checklist no PR ou comentário de merge).  
2. **CodeRabbit** (ou equivalente) executado no PR; issues **CRITICAL** / **HIGH** resolvidas ou justificadas com acordo `@architect`.  
3. **Segurança:** sem PFX, thumbprint, senhas ou `service_role` em diff; `NEXT_PUBLIC_*` sem segredos (**CE-NFR1**).  
4. **Logs:** sem thumbprint completo + CNPJ em **INFO** onde **CE-NFR5** aplicável.  
5. **@qa:** onde consta quality gate **@qa**, evidência no PR (notas de teste, screenshot opcional, ou referência a caso e2e).  
6. **Docs:** change log do briefing canónico actualizado se a story tocar **CER-01** / **CER-02** (**CE-NFR7**).

---

## Revisão PO incorporada

| Versão | Feedback PO | Resposta no documento |
| ------ | ----------- | ---------------------- |
| v0.2 | Ambiguidade “briefing **ou** novo runbook” | **Documento canónico único** (§CER-01); proibido segundo runbook paralelo sem ADR. |
| v0.2 | `.gitignore` vs exemplos | **CER-03** AC5: padrões não podem ignorar `*.example.json` / `*.example.*` / `docs/examples/**`. |
| v0.2 | Colisão com mapa **ADN-04** | **CER-05** AC0: extensão **aditiva** `ADN_WORKER_*`; não alterar códigos existentes. |
| v0.2 | Estimativa / gates | Coluna **Tamanho** (S/M/L); **@qa** em **CER-04**. |
| **v0.3** | DoD global + estado Ready + **@qa** em **CER-05** | §Promoção de estado, §Definition of Done, quality gate e tasks **CER-05**. |
| **v0.4** | Ready **por story**; MVP **CER-05** vs worker real; cabeçalho | §Ready por story; **CER-05** AC6 + backlog activação worker; versão **0.4** no cabeçalho. |

---

## Índice

| ID | Título resumido | Tamanho | Dependências principais |
| -- | ----------------- | ------- | ------------------------ |
| **CER-01** | Runbook único (canónico): modalidades A/B, precedência thumbprint vs PFX, CE-FR1–8, CE-FR12 | **S** | Nenhuma (só `docs/`) |
| **CER-02** | Matriz CE-FR10 (≥5), smoke CE-FR7, rotação CE-FR11 | **S** | **CER-01** (mesmo PR ou PR subsequente que toca só no canónico) |
| **CER-03** | Política segredos: `.gitignore`, exemplo só placeholders, CE-NFR3/4 | **S** | Monorepo (raiz); alinhado ao texto canónico **CER-01** |
| **CER-04** | UI: `Alert`, `getAdnCertRunbookUrl`, modal bullet, `.env.example` | **M** | **ADN-07**; spec UX §5.1–5.3 |
| **CER-05** | API: extensão mapa `error_code` worker → CE-FR10 | **M** | **ADN-04**; `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` §5.2 |

**Ordem sugerida:** **CER-01** → **CER-02** → **CER-03** (documentação e higiene podem sobrepor-se ligeiramente) → **CER-04** (após **ADN-07**) → **CER-05** (após **ADN-04**, pode ser mesmo sprint que **CER-04** se a equipa quiser um único PR “guia + erros”).

---

## Rastreio PRD / arquitectura → CER

| Story | CE-FR / CE-NFR / ADN |
| ----- | -------------------- |
| CER-01 | CE-FR1–CE-FR8, CE-FR12 |
| CER-02 | CE-FR7, CE-FR10, CE-FR11 |
| CER-03 | CE-NFR2, CE-NFR3, CE-NFR4, CE-FR12 |
| CER-04 | CE-FR9, CE-NFR1, CE-FR8 (opcional copy), UX spec §4–5 |
| CER-05 | CE-FR10, arquitectura §5.2, CE-NFR5 (sem dados sensíveis nas mensagens) |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev` (CER-03 a CER-05); CER-01/CER-02 podem ser `@dev` ou **autor técnico** com PR só em `docs/`.  
- **Revisão sugerida:** CodeRabbit em PR; `@architect` em **CER-04** (env público, CSP, fronteira segredo) e **CER-05** (contrato `error_code`).  
- **CER-04:** `@qa` valida smoke manual/e2e leve (flag on/off, link, **sem** regressão a11y foco/contraste).  
- **CER-05:** `@qa` valida **AC0** (lista de códigos pré-PR + ausência de colisão) e **AC5** (fixture/mock → `message` + ausência de leaks); `@architect` no contrato.  
- **Foco:** nenhum segredo em `NEXT_PUBLIC_*`; nenhum upload PFX; logs sem thumbprint+CNPJ em INFO (**CE-NFR5**).

---

## CER-01 — Story: runbook único (modalidades e precedência)

**Status:** Draft  
**Tamanho:** S  

**Dependências (DoR):** Nenhuma.

**Documento canónico (vinculativo):** **`docs/briefing-importacao-certificado-empresa-monitorada-adn.md`** — toda a matéria CER-01/02 **edita in-place** neste ficheiro (ou PR único que só o expande). **Proibido** criar segundo runbook paralelo (`docs/runbook-*.md`) sem **ADR** aprovado por `@pm` (evita duas fontes de verdade).

**Referências:** `docs/briefing-importacao-certificado-empresa-monitorada-adn.md`, `docs/prd-integracao-nfse-dist-adn.md` (NFR19, FR48), PRD certificado §10 Story 1.1.

**Executor Assignment**

- **executor:** `@dev` ou redactor técnico com PR em `docs/`  
- **quality_gate:** `@architect` (revisão leve de exactidão técnica NFSE_dist)

### Story

**As a** operador de infra,  
**I want** um documento único com ordem de passos, modalidades A (loja Windows + thumbprint) e B (PFX), e a regra “thumbprint activa curl em detrimento do PFX”,  
**so that** execute a configuração sem fontes contraditórias.

### Acceptance Criteria

1. O ficheiro **canónico** `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` contém **tabela ou fluxograma textual** “se `thumbprint` definido → ramo `curl`/Schannel; senão → `requests_pkcs12` + PFX” (**CE-FR1**).  
2. Referências correctas a `prd-integracao-nfse-dist-adn.md` (**NFR19**, **FR48**) e [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) (**CE-FR6**); PRD certificado e arquitectura certificado citados no topo ou “Ver também”.  
3. Conteúdo cobre **CE-FR2** (CNPJ 14 dígitos), **CE-FR3** (CurrentUser vs LocalMachine + contexto de processo), **CE-FR4** (limite detecção por *Subject*).  
4. Secção explicita diferença entre export **FR48** (sem segredos) e `clients.local.json` (**CE-FR8**).  
5. Change log do documento canónico actualizado (**CE-NFR7**).

### Tasks / Subtasks

- [x] Confirmar que nenhum outro `docs/*certificado*` duplica o runbook (só links para o canónico).  
- [x] Revisão ortográfica pt-BR.

---

## CER-02 — Story: matriz de erros, smoke e rotação

**Status:** Draft  
**Tamanho:** S  

**Dependências (DoR):** **CER-01** (conteúdo canónico em `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` actualizado na mesma PR ou merged antes desta).

**Referências:** PRD §10 Story 1.2; UX spec §6; `docs/front-end-spec-importacao-certificado-empresa-monitorada-adn.md`.

**Executor Assignment**

- **executor:** `@dev` / docs  
- **quality_gate:** `@po` (copy **CE-FR10** e tom de voz); opcional `@pm` se copy estratégica

### Story

**As a** suporte interno,  
**I want** tabela causa → sintoma → acção (mínimo cinco linhas) e passos de smoke e rotação de certificado,  
**so that** reduza tempo de diagnóstico sem expor segredos.

### Acceptance Criteria

1. Matriz com **≥ 5** linhas alinhadas a **CE-FR10** (certificado não encontrado; PFX/senha; thumbprint; `curl`/ambiente; loja inacessível); colunas **Categoria interna** | **Copy utilizador** | **Acção** (espelhar UX spec §6).  
2. **CE-FR7:** passos numerados para validar `logs/execucao.log` e pasta `data/<CNPJ>/` no worker de referência.  
3. **CE-FR11:** rotação em bullets (substituir PFX/thumbprint, validar `NotAfter`, reexecutar smoke).  
4. Nota explícita: códigos **429/503** ADN tratam-se pelo glossário ADN geral, não nesta matriz.

### Tasks / Subtasks

- [x] Link cruzado para `docs/qa/adn-staging-setup.md` se útil ao smoke portal.

---

## CER-03 — Story: política de segredos no repositório

**Status:** Draft  
**Tamanho:** S  

**Dependências (DoR):** Identificação de pastas onde o worker ou exemplos possam viver (monorepo actual pode ser só portal — `.gitignore` na raiz + nota README).

**Referências:** PRD §10 Story 1.3; arquitectura §8 checklist.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** responsável de segurança,  
**I want** `.gitignore` e exemplos versionados só com placeholders,  
**so that** não haja commit acidental de PFX ou `clients.local.json` real.

### Acceptance Criteria

1. `.gitignore` na raiz (ou pasta `workers/` se criada) inclui padrões: `clients.local.json`, `**/*.pfx`, `certificates/*.pfx` conforme arquitectura §8 (**CE-NFR2**).  
2. Ficheiro exemplo (ex.: `docs/examples/clients.local.example.json` ou `clients.local.example.json` na raiz do template worker) com **apenas** placeholders `THUMBPRINT_EXEMPLO`, senha fictícia (**CE-FR12**).  
3. Parágrafos curtos no runbook canónico sobre **CE-NFR3** (mínimo privilégio no disco) e **CE-NFR4** (backups cifrados).  
4. `README.md` ou `docs/` com linha “Contributing / segredos” que aponta para esta política.  
5. **Exemplos versionáveis:** os padrões em `.gitignore` **não** podem excluir ficheiros com sufixo **`.example.json`**, **`.example.md`**, nem o path `docs/examples/**` (salvo excepção documentada). O exemplo **CE-FR12** deve permanecer **trackeável** pelo Git após o PR.

### Tasks / Subtasks

- [ ] Grep em CI opcional futuro — fora do MVP desta story (nota no Dev Notes).

### Dev Notes

- Não criar pacote worker no monorepo se ainda não existir: limitar-se a `.gitignore` + `docs/examples/` + README.

---

## CER-04 — Story: UI — alerta de certificado e link do guia

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **ADN-07** (secção Sincronização ADN montada); `docs/front-end-spec-importacao-certificado-empresa-monitorada-adn.md`.

**Referências:** Arquitectura §3.1–3.3; UX spec §5.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@ux-design-expert` (a11y, copy duas frases); **`@qa`** (smoke flag on/off, link, CSP se URL externo)

### Story

**As a** admin (ou utilizador com acesso de leitura ao bloco ADN),  
**I want** ver um aviso claro e um link para o guia técnico de certificado na secção ADN,  
**so that** saiba que o certificado é instalado no servidor de recolha e não nesta página (**CE-FR9**, **CE-NFR1**).

### Acceptance Criteria

1. **Alert** (shadcn) dentro do bloco **Sincronização ADN**, ordem vertical após estado/CTAs principais e antes de “Ver notas” / export, com **título** “Certificado digital” e **duas frases** conforme UX spec §5.1 (significado **CE-NFR1** sem jargão “mTLS” obrigatório).  
2. Helper **`getAdnCertRunbookUrl()`** lê `process.env.NEXT_PUBLIC_ADN_CERT_RUNBOOK_URL`; **mesmo** `href` reutilizado no **terceiro bullet** do modal “Como funciona?” (UX §5.3).  
3. Se env **ausente**: texto “Ligação ao guia técnico ainda não configurada neste ambiente.” + **sem** `href` inválido (UX §5.2).  
4. Links externos: `target="_blank"`, `rel="noopener noreferrer"`.  
5. **Não** existe input de upload PFX, thumbprint, nem senha (**CE-NFR1**).  
6. **FR45:** se a secção ADN **não** é montada (flag off), o alerta **também** não aparece.  
7. `.env.example` documenta `NEXT_PUBLIC_ADN_CERT_RUNBOOK_URL` com exemplo **HTTPS placeholder** (sem segredos).  
8. Contraste e foco conforme UX §7 (WCAG 2.2 AA mínimo).

### Tasks / Subtasks

- [ ] **@qa:** checklist smoke — org com `adn_sync_enabled=true` + URL definida → link abre destino correcto; flag `false` → **sem** `Alert` nem link partido.  
- [ ] **@qa:** teclado — link do guia recebe foco e é activável por Enter; ordem de tab conforme UX spec §7.  
- [ ] Teste e2e leve (opcional Playwright) ou manual documentado no PR.  
- [ ] Validar CSP em staging se o URL for domínio externo (arquitectura §8 item 5).

### Dev Notes

- Rota opcional interna `/ajuda/adn-certificado` fica **backlog** se não for necessária no MVP (arquitectura §6).  
- **Evolução UIP (opção A):** quando o incremento [`incremento-certificado-adn-readiness-uip.md`](incremento-certificado-adn-readiness-uip.md) (**UIP-04**) for implementado, o **`Alert`** isolado desta story (**AC1**, ordem “após CTAs”) é **substituído** pelo organismo **`AdnCertificateReadinessCard`**, que **incorpora** as mesmas **duas frases** + **link** do guia + estado de readiness; **não** manter dois blocos informativos duplicados. A **ordem vertical** da secção ADN passa a seguir [spec UIP §3.1](front-end-spec-instalacao-certificado-empresa-monitorada-utilizador.md) (card de certificado **antes** dos CTAs de sync). Até ao merge **UIP-04**, **CER-04** permanece o contrato de UI vigente.

---

## CER-05 — Story: API — códigos de erro certificado / infra (mapeamento servidor)

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **ADN-04** (respostas JSON com `error_code` + mensagem sanitizada no portal); para **MVP** basta **fixture/mock** que exercite os novos códigos (**AC6**). Worker real a emitir `ADN_WORKER_*` é **follow-up** (§Backlog), não bloqueador DoR desta story.

**Compatibilidade (vinculativo):** Os códigos `ADN_WORKER_*` são **extensão aditiva** do mapa já definido em **`docs/stories/incremento-integracao-nfse-dist-adn.md`** (política HTTP, glossário, **ADN-04**). **Proibido** redefinir ou alterar a semântica de `error_code` existentes (ex.: `ADN_RATE_LIMIT`, `ADN_INVALID_JSON`) sem épico próprio; apenas **novas chaves** + mensagens **CE-FR10**.

**Referências:** Arquitectura §5.2; PRD **CE-FR10**; `adn_ingestion_failures.error_code` (schema ADN); `incremento-integracao-nfse-dist-adn.md` (ADN-04, glossário).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect` (contrato `error_code`, segurança resposta); **`@qa`** (AC0 lista de códigos + AC5 fixture integração / mock)

### Story

**As a** utilizador do portal com bloco ADN,  
**I want** que falhas relacionadas a certificado ou ambiente do worker apareçam com mensagem segura e código estável,  
**so that** eu e o suporte saibamos o próximo passo sem ver dados sensíveis (**CE-FR10**, **CE-NFR5**).

### Acceptance Criteria

0. **Extensão sem colisão:** lista de `error_code` existentes no código ADN **antes** do PR está documentada no PR (diff ou comentário); os quatro códigos novos são **únicos** e prefixados `ADN_WORKER_` (**compatibilidade** com feedback PO).  
1. Módulo servidor (ex.: `lib/adn-worker-errors.ts` ou extensão do mapa existente ADN) define pelo menos: `ADN_WORKER_CERT_NOT_FOUND`, `ADN_WORKER_CERT_CONFIG_INVALID`, `ADN_WORKER_TLS_ENV_NOT_READY`, `ADN_WORKER_CERT_STORE_INACCESSIBLE` com **mensagem pt-BR** igual à matriz UX §6 / PRD (**CE-FR10**).  
2. Rotas **v1** `.../adn/*` que devolvem erros de domínio utilizam **apenas** mensagens mapeadas + `error_code`; **não** propagar `error_detail` de Postgres/worker ao JSON público.  
3. **CE-NFR5:** teste ou revisão estática garante que logs **INFO** de handlers ADN não combinam thumbprint completo + CNPJ.  
4. Documentação em `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` §5.2 referenciada no código (comentário de um linha ou ADR link).  
5. Teste de integração (mínimo): resposta simulada ou fixture com `error_code` novo → corpo contém `message` esperada e **não** contém substring de paths `certificates/` ou PFX.  
6. **MVP vs activação worker (PO 9,5→10):** o **fecho** desta story exige **mapa servidor + AC0–5** com **fixture ou mock**; **não** é obrigatório que o worker real (produção ou staging) já emita os quatro `ADN_WORKER_*`. Se após o merge o worker ainda **não** enviar esses códigos, o PR deve (i) declarar na descrição **“activação worker `ADN_WORKER_*` pendente”** e (ii) garantir linha explícita em **§Backlog / follow-ups** (primeiro bullet abaixo) **ou** issue/épico filho ligado — **sem** reabrir esta story.

### Tasks / Subtasks

- [ ] **@qa:** verificar **AC0** — anexar ao PR lista de `error_code` ADN existentes antes da alteração + confirmar que os quatro `ADN_WORKER_*` não duplicam nenhum nome pré-existente.  
- [ ] **@qa:** executar ou rever teste de **AC5** (fixture / integração com mock) e confirmar ausência de substrings `certificates/`, `.pfx`, paths sensíveis no JSON público.  
- [ ] Alinhar com worker: contrato JSON no `PATCH` job / `commit` falho (**NFR20**) — documentar payload exemplo em `docs/qa/` se ainda não existir.

### Dev Notes

- **AC6** formaliza o que antes estava só aqui: entrega mínima = mapa + testes; worker real é **follow-up** documentado, não bloqueador de merge desta story.

---

## Backlog / follow-ups (não numerados)

- **Worker / pipeline:** quando o recolhedor estiver pronto, emitir no JSON de erro os códigos `ADN_WORKER_*` conforme contrato **NFR20** e **§5.2** da arquitectura certificado (activação pós-**CER-05**).  
- Rota servidor para guia **não** público (arquitectura §6 — ADR).  
- Cofre (Key Vault) para materializar `clients.local.json`.  
- CI `git-secrets` ou equivalente (PRD riscos §12).

---

## Dev Agent Record (Dex)

### File List

- `apps/web/src/components/ui/alert.tsx` (novo — padrão shadcn-style)  
- `apps/web/src/lib/adn-cert-runbook-url.ts` (novo)  
- `apps/web/src/lib/adn-worker-errors.ts` (novo)  
- `apps/web/src/lib/adn-worker-errors.test.ts` (novo)  
- `apps/web/src/lib/adn-zod-response.ts`  
- `apps/web/src/server/api/v1/handlers/adn-failures.ts`  
- `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`  
- `apps/web/src/app/api/v1/adn-api.integration.test.ts`  
- `.gitignore`  
- `.env.example`  
- `README.md`  
- `docs/examples/clients.local.example.json` (novo)  
- `docs/briefing-importacao-certificado-empresa-monitorada-adn.md`  
- `docs/stories/incremento-certificado-adn-guia-portal.md` (tarefas CER-01/02 + registo)

### Completion Notes

- **CER-01–CER-03** e **CER-04** (UI + env) e **CER-05** (mapa + teste integração com `DATABASE_URL`) entregues no código e briefing canónico.  
- **Activação worker `ADN_WORKER_*` pendente** no recolhedor real (conforme AC6 e §Backlog).  
- Checklist **@qa** / CSP / e2e opcional em **CER-04** e **CER-05** permanecem abertos para validação manual no PR.  
- **Pós-QA (Dex):** `Alert`/`AlertTitle`/`AlertDescription` em `@/components/ui/alert`; ordem de tab: estado → CTAs → `Alert` certificado → **Como funciona?**; `GET …/failures` inclui `message` duplicando `userMessage`; `adnJsonFromZodError` deixa de expor `details` Zod em JSON ADN.

### Change Log (agente)

| Data       | Nota breve |
| ---------- | ----------- |
| 2026-04-24 | Implementação inicial CER-01…CER-05 (Dex). |
| 2026-04-24 | Correcções após **QA Results** (Alert shadcn-style, tab order, `message` + sanitização Zod ADN). |

---

## QA Results (Quinn)

**Data da revisão:** 2026-04-24  
**Escopo:** revisão estática do diff alinhada aos AC **CER-01** … **CER-05** e ao DoD conjunto **CER** (evidência em código + docs; **sem** execução de browser nem CodeRabbit nesta sessão).

### Decisão de gate

**PASS com CONCERNs** — os objectivos funcionais e de segurança do incremento estão cobertos; os pontos abaixo devem ser tratados no PR (comentário ou follow-up explícito) antes de considerar **CER-04** / DoD **100%** fechados ao pé da letra.

### Rastreio por story

| Story | Verificação resumida | Resultado |
| ----- | --------------------- | ---------- |
| **CER-01** | Briefing canónico: §4.0 CE-FR1 (tabela thumbprint vs PFX); Ver também com NFR19/FR48 e NFSE_dist; CE-FR2–4; §4.3 CE-FR8; change log §9 (**CE-NFR7**). | **PASS** |
| **CER-02** | §7.1 CE-FR7 numerado; §7.2 matriz ≥5 linhas (colunas interno / copy / acção); §7.3 CE-FR11; nota 429/503; link `docs/qa/adn-staging-setup.md`. | **PASS** |
| **CER-03** | `.gitignore` com `clients.local.json`, `**/*.pfx`, `certificates/*.pfx`; `docs/examples/clients.local.example.json` só placeholders; §4.4 CE-NFR3/4; README “Contributing / segredos”. Padrões **não** ignoram `docs/examples/**` nem `*.example.json`. | **PASS** |
| **CER-04** | `getAdnCertRunbookUrl()` + reutilização no modal; texto sem URL inválida; `target`/`rel` para externos; aviso só com `access === "active"` (**FR45**); sem inputs de segredo; `.env.example` com HTTPS placeholder. | **PASS c/ CONCERNs** (ver abaixo) |
| **CER-05** | `adn-worker-errors.ts` com quatro `ADN_WORKER_*` + comentário de códigos pré-existentes (**AC0** para o PR); integração insere `error_detail` sensível e valida corpo sem `certificates/`, `.pfx`, `thumbprint=`; `GET` falhas não expõe `errorDetail`. Testes unitários em `adn-worker-errors.test.ts`. | **PASS c/ CONCERNs** (ver abaixo) |

### CONCERNs (acção recomendada)

1. **CER-04 AC1 (componente):** o AC pede **`Alert` (shadcn)**; a UI usa um bloco semântico equivalente (`role="status"`, título e corpo) **sem** componente shadcn. **Recomendação:** ou instalar/usar `@/components/ui/alert` alinhado ao design system, ou registar **waive** no PR com acordo **@ux-design-expert** / **@architect** (“equivalente a11y”).
2. **CER-04 UX §7 (ordem de tab):** o botão **“Como funciona?”** está no cabeçalho **antes** do estado do job e dos CTAs na árvore DOM, logo recebe foco **antes** do fluxo “estado → CTAs → link do guia”. **Recomendação:** mover o trigger do modal para **depois** dos CTAs (ou ajustar `tabIndex` com cuidado) para coincidir com o spec.
3. **CER-05 AC5 (nomenclatura):** o AC fala em `message` no JSON; a API de falhas expõe **`userMessage`** por item (coerente com o contrato actual). **Recomendação:** aceitar como contrato documentado ou alinhar copy do AC no PR.
4. **CER-05 AC2 (âmbito global):** outras rotas `.../adn/*` continuam a usar `adnJsonFromZodError`, que em **não produção** anexa `details` Zod (**risco de ruído**, não necessariamente segredo). **Fora do delta CER-05** se já existia; **@architect** pode confirmar se exige endurecimento.
5. **DoD CER:** CodeRabbit, smoke manual **flag on/off + URL**, **CSP** staging e linhas **@qa** nas tarefas **CER-04** / **CER-05** permanecem **evidência pendente** no PR (previsível).

### Evidência **AC0** (lista de `error_code` ADN no código antes da extensão — para colar no PR)

Pré-existentes referenciados em `adn-worker-errors.ts`: `ADN_INVALID_JSON`, `ADN_INVALID_SYNC_BODY`, `ADN_RATE_LIMIT`, `ADN_INVALID_QUERY`, `ADN_INVALID_BULK_RETRY`, `ADN_INVALID_FAILURE_ID`, `ADN_INVALID_PAYLOAD`, `ADN_DRAFT_NOT_FOUND`, `ADN_DRAFT_EXPIRED`, `STORAGE_COMMIT_FAILED`. **Novos (únicos, prefixo `ADN_WORKER_`):** `ADN_WORKER_CERT_NOT_FOUND`, `ADN_WORKER_CERT_CONFIG_INVALID`, `ADN_WORKER_TLS_ENV_NOT_READY`, `ADN_WORKER_CERT_STORE_INACCESSIBLE` — sem colisão de nomes com a lista acima.

### Testes automáticos (agente)

- `apps/web`: `npx vitest run` — suíte unitária incl. `adn-worker-errors.test.ts` **passou** nesta revisão; testes de integração `adn-api.integration.test.ts` **skipped** sem `DATABASE_URL` local (o caso **CER-05 AC5** requer CI com Postgres para evidência verde).

### Próximos passos sugeridos

1. Executar smoke manual **CER-04** (org `adn_sync_enabled=true` + `NEXT_PUBLIC_ADN_CERT_RUNBOOK_URL`; depois flag `false` → sem aviso de certificado).  
2. **@architect:** CSP com URL externa do runbook em staging.  
3. Colar no PR a secção **AC0** acima + link para este bloco **QA Results**.

---

— **River (SM / AIOS)** — stories **v0.4**; refinamento pós-avaliação PO **9,5/10** (Ready por story, **CER-05** AC6 MVP/worker, backlog activação).
