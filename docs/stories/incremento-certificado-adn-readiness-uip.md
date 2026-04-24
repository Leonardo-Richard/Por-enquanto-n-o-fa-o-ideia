# User stories — Incremento: estado e verificação do certificado ADN (UIP Fase 1)

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** `docs/prd-instalacao-certificado-empresa-monitorada-utilizador.md`, `docs/front-end-spec-instalacao-certificado-empresa-monitorada-utilizador.md`, `docs/architecture-instalacao-certificado-empresa-monitorada-utilizador.md`  
**Pré-requisitos:** **CER-04** e **ADN-07** (`docs/stories/incremento-certificado-adn-guia-portal.md`, `docs/stories/incremento-integracao-nfse-dist-adn.md`) — secção **Sincronização ADN** activa com **FR45**; **CER-05** recomendado para mapeamento `ADN_WORKER_*` já disponível em `adn-worker-errors.ts`. **Coerência CER↔UIP:** **CER-04** Dev Notes no ficheiro CER descrevem a sucessão do `Alert` pelo card **UIP-04** (opção A).  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-24  
**Versão do conjunto:** **0.5** — nit PO pós-nota 9,8/10: *Dev Notes* **UIP-01** e **UIP-04** alinhados ao valor de contrato **`pendente_verificacao`** (nível 0).  
**Estado do conjunto:** **Draft** — ver **§Promoção de estado** abaixo.

### Nota de refinamento (@po → @sm)

| Data       | Origem     | Alteração |
| ---------- | ---------- | ---------- |
| 2026-04-24 | Feedback PO | AC único para **POST nível 0**; AC **multi-tenant** explícito em **UIP-01**; critério **`pronto`** fechado em **UIP-03**; **UIP-04** layout **opção A** (fundir CER-04 no card). |
| 2026-04-24 | Feedback PO (v0.2) | **UIP-03 AC3:** frescura **15 min** medida só com relógio do **portal**; **CER-04** referenciado em `incremento-certificado-adn-guia-portal.md` (Dev Notes evolução UIP). |
| 2026-04-24 | Feedback PO (v0.3→9,5/10) | **UIP-03 AC6** — fecho **implementado vs adiado** obrigatório na descrição do PR + **@qa**; **DoD** §3.1.1 no `front-end-spec-importacao-certificado-empresa-monitorada-adn.md` (precedência **UIP-04** / spec UIP §3.1). |
| 2026-04-24 | Feedback PO (v0.4→9,8/10) | Vocabulário: *Dev Notes* **UIP-01** / **UIP-04** — substituir `pendente` informal por **`pendente_verificacao`** (coerência com AC / Zod). |

---

## Ready por story (**UIP-01** … **UIP-04**)

Cada bloco **UIP-0x** mantém `**Status:** Draft` até cumprir **todos** os pontos aplicáveis:

1. **DoR** da story (secção **Dependências (DoR)**) cumprido ou **excepção** registada no PR com acordo `@po`.  
2. **Todos os AC** da story verificáveis no PR (checklist ou evidência **@qa** quando listado).  
3. **§Definition of Done — conjunto UIP** — itens aplicáveis satisfeitos.  
4. **Promoção de linha:** no merge que fecha a story, actualizar neste ficheiro `**Status:** Draft` → `**Status:** Ready` no bloco respectivo **ou** PR subsequente em `docs/` só com essa alteração.

---

## Promoção de estado (**Draft** → **Ready for sprint**)

| Estado | Critério |
| ------ | -------- |
| **Draft** | Conjunto em refinamento ou aguarda validação `@po`. |
| **Ready for sprint** | `@po` regista data + “AC e DoD § abaixo aceites”; se **UIP-03** estiver no sprint: critério **`pronto`** do **UIP-03 AC3** aceite **tal como escrito** (ou excepção assinada no PR); **UIP-03 AC6** — linha `Persistência readiness:` na descrição do PR conforme AC (sem ambiguidade). |

| Data | Estado | Nota |
| ---- | ------ | ---- |
| *(preencher)* | Ready for sprint | Validado `@po` |

---

## Definition of Done — conjunto **UIP** (todas as stories)

1. **AC** verificáveis; **CodeRabbit** (ou equivalente) no PR.  
2. **Segurança:** sem PFX, thumbprint, senhas ou paths sensíveis em JSON público ou `NEXT_PUBLIC_*` (**CE-NFR1**, **UIP-FR4**, **CE-NFR5**).  
3. **Multi-tenant:** testes ou notas **@qa** para `organizationId` / `companyId` cruzados (**UIP-NFR1**).  
4. **Regressão:** requisitos **CER-04** (duas frases + link + modal) permanecem satisfeitos **via** **UIP-04 AC8 (opção A)** — bloco único; ordem vertical conforme [spec UIP §3.1](front-end-spec-instalacao-certificado-empresa-monitorada-utilizador.md).  
5. **Docs CER / UIP:** `docs/front-end-spec-importacao-certificado-empresa-monitorada-adn.md` contém **§3.1.1** (*precedência UIP* após **UIP-04**), mergeado **no mesmo ciclo de release** que **UIP-04** (mesmo PR de código, PR `docs/` imediato, ou referência cruzada explícita no PR que fecha **UIP-04**).  
6. **Docs:** `.env.example` actualizado para novas variáveis (`ADN_CERT_VERIFY_RATE_LIMIT_PER_MIN`, URLs internas do *probe*, feature flag, se aplicável).

---

## Índice

| ID | Título resumido | Tamanho | Dependências principais |
| -- | ----------------- | ------- | ------------------------ |
| **UIP-01** | API **GET** `…/adn/certificate-readiness` (Zod, `resolveAdnPublicAccess`, nível 0) | **M** | CER-04 / ADN-07 |
| **UIP-02** | API **POST** `…/certificate-readiness/verify` (admin, rate limit, corpo = GET) | **M** | **UIP-01** |
| **UIP-03** | Integração **probe** worker (nível 1, NFR20) + semântica `pronto`/`erro` | **L** | **UIP-02**; worker ou mock contratual |
| **UIP-04** | UI: `AdnCertificateReadinessCard`, hook, ordem no `AdnSyncPanel`, a11y | **M** | **UIP-01**, **UIP-02**; [spec UIP](front-end-spec-instalacao-certificado-empresa-monitorada-utilizador.md) |

**Ordem sugerida de implementação:** **UIP-01** → **UIP-02** → **UIP-04** (UI contra API estável) → **UIP-03** (endurecer estado sem rebentar UI se contrato mantido).

---

## Rastreio PRD / arquitectura / UX → UIP

| Story | UIP-FR / UIP-NFR / outros |
| ----- | -------------------------- |
| UIP-01 | UIP-FR1 (leitura), UIP-NFR1 |
| UIP-02 | UIP-FR2, UIP-NFR3, UIP-NFR4 (logs) |
| UIP-03 | UIP-FR1 (semântica), UIP-FR4 (códigos), CE-NFR5 |
| UIP-04 | UIP-FR1 (superfície), UIP-FR3, UIP-FR5, UIP-NFR2, CE-FR9 |

---

## CodeRabbit / quality gate

- **executor:** `@dev`  
- **Revisão:** `@architect` em **UIP-01–UIP-03** (contrato API, leaks, rate limit); `@ux-design-expert` em **UIP-04** (spec §5–7).  
- **@qa:** **UIP-01** (multi-tenant path), **UIP-02** (429, 403 não-admin), **UIP-03** (corpo JSON sem `certificates/`, `.pfx`, `thumbprint=`; **AC6** — linha `Persistência readiness:` na descrição do PR), **UIP-04** (foco, `aria-live`, regressão CER-04 / opção A).  
- **Foco:** nenhum upload PFX na Fase 1.

---

## UIP-01 — Story: API GET — estado de preparação do certificado

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** Organização com `adn_sync_enabled` e padrão de rotas ADN existente; leitura da arquitectura UIP §3.2.

**Referências:** `docs/architecture-instalacao-certificado-empresa-monitorada-utilizador.md` §3.1–3.2, §4.3, §5; PRD **UIP-FR1**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** utilizador autenticado com acesso ao bloco ADN da empresa,  
**I want** obter via API o estado de preparação do certificado para essa empresa monitorada,  
**so that** a UI possa mostrar o badge inicial sem expor segredos (**UIP-FR1**, **UIP-NFR1**).

### Acceptance Criteria

1. Existe rota **`GET /api/v1/organizations/:organizationId/monitored-companies/:companyId/adn/certificate-readiness`** (App Router + handler dedicado) que chama **`resolveAdnPublicAccess`** com a mesma semântica de erros que `handleGetAdnSync` (401/403/404 coerentes).  
2. Resposta **200** com JSON validado por **Zod** (`lib/adn-certificate-readiness-schema.ts` ou equivalente) contendo no mínimo: `certificateReadiness` ∈ `pendente_verificacao` | `pronto` | `erro`, `lastCheckedAt` (ISO8601 ou `null`), `userMessage`, `errorCode`, `retryAfterSeconds` conforme contrato arquitectura §3.2.  
3. **Nível 0 (bootstrap):** sem *probe* worker activo, `certificateReadiness` é **`pendente_verificacao`** e, se o contracto incluir, `probeAvailable: false` — sem erro 500.  
4. Header **`Cache-Control: no-store`**.  
5. Testes de integração: utilizador sem sessão → 401; org/empresa inválida ou ADN off → 404 alinhado ao padrão ADN existente.  
6. **Não** devolver paths de ficheiros, thumbprints, senhas nem PFX no JSON (**CE-NFR1**, **UIP-FR4**).  
7. **Multi-tenant (UIP-NFR1):** teste de integração em que o `companyId` no path pertence a **outra** `organizationId` (empresa válida noutra org) enquanto o path ainda usa a org da sessão activa — resposta **404** ou **403** **coerente** com `handleGetAdnSync` / `resolveAdnPublicAccess` (sem corpo de readiness e sem fuga de existência da empresa).  
8. **@qa:** evidência do caso **AC7** no PR (notas ou teste automatizado).

### Tasks / Subtasks

- [x] Handler em `apps/web/src/server/api/v1/handlers/adn-certificate-readiness.ts` (ou nome equivalente) + `route.ts` espelhando padrão `adn/sync`.  
- [x] Testes em `adn-api.integration.test.ts` (ou ficheiro dedicado) para GET **incluindo AC7**.

### Dev Notes

- Semântica `pronto`/`erro` completa pode ficar mínima no **UIP-01** (nível 0: sempre **`pendente_verificacao`**); **UIP-03** endurece.

---

## UIP-02 — Story: API POST — verificar preparação (rate limit + admin)

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **UIP-01** merged ou incluído no mesmo PR com GET estável.

**Referências:** Arquitectura §3.3, §7; PRD **UIP-FR2**, **UIP-NFR3**; [spec UX §6.2](front-end-spec-instalacao-certificado-empresa-monitorada-utilizador.md).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`  
- **@qa:** matriz 403 / 429 / 200

### Story

**As a** admin da organização,  
**I want** solicitar uma nova verificação da preparação do certificado para a empresa monitorada,  
**so that** o estado na UI actualize após a equipa técnica alterar o worker (**UIP-FR2**).

### Acceptance Criteria

1. Existe rota **`POST …/adn/certificate-readiness/verify`** que: (a) `resolveAdnPublicAccess`; (b) **`assertAdnOrgAdmin`** — utilizador não-admin → **403** com mensagem alinhada ao sync ADN; (c) **rate limit** com `adnCertVerifyRateKey` + `consumeAdnRateLimit` e env **`ADN_CERT_VERIFY_RATE_LIMIT_PER_MIN`** documentada (arquitectura §7).  
2. Resposta **429** inclui `error_code: "ADN_RATE_LIMIT"` (ou código existente equivalente), `message` e **`retryAfterSeconds`** / header `Retry-After` conforme padrão `handlePostAdnSync`.  
3. Resposta **200** com **mesmo shape Zod** que o GET (idempotência de leitura para a UI).  
4. **Semântica única — nível 0 / antes do *probe* (UIP-03):** em cada **POST** `verify` bem sucedido (200), o servidor **(a)** reexecuta a **mesma** função interna de cálculo de readiness que alimenta o GET (sem ramos divergentes); **(b)** define `lastCheckedAt` para o **instante actual do servidor** (ISO8601); **(c)** mantém `certificateReadiness` como resultado desse cálculo (no nível 0: **`pendente_verificacao`**, salvo **UIP-03** já merged e *probe* activo). O GET subsequente **deve** reflectir o mesmo `lastCheckedAt` e readiness que o POST acabou de devolver.  
5. **@qa:** evidência de teste 403 (user org não-admin) e 429 (exceder limite em teste com bucket clear se existir helper); teste **AC4** — dois POST seguidos avançam `lastCheckedAt` e mantêm coerência GET↔POST.  
6. Logs **INFO** sem thumbprint+CNPJ conjunto (**CE-NFR5**).

### Tasks / Subtasks

- [x] Função `adnCertVerifyRateKey` em `lib/adn-rate-limit.ts`.  
- [x] Testes de integração POST.

---

## UIP-03 — Story: Integração probe worker (nível 1) e semântica de estado

**Status:** Draft  
**Tamanho:** L  

**Dependências (DoR):** **UIP-02**; variáveis de ambiente / contrato NFR20 acordados com dono do worker ou **mock HTTP** estável em testes até worker existir; **critério `pronto` (AC3 abaixo) aceite por `@po`** antes de marcar a story *in progress* em sprint com *probe* real.

**Referências:** Arquitectura §4.1–4.4, §8 logging; PRD métricas “sem falsos positivos”.

**Executor Assignment**

- **executor:** `@dev` (+ dono worker se aplicável)  
- **quality_gate:** `@architect`  
- **@qa:** **AC5** obrigatório

### Story

**As a** plataforma,  
**I want** consultar o worker (ou *fallback* documentado) para determinar se o certificado está materialmente preparado para o CNPJ da empresa,  
**so that** `certificateReadiness` reflita `pronto` ou `erro` com códigos **`ADN_WORKER_*`** fiéis (**UIP-FR1**, **UIP-FR4**).

### Acceptance Criteria

1. Com **feature flag** (nome indicativo `ADN_CERT_PROBE_ENABLED` ou env `ADN_WORKER_INTERNAL_BASE_URL` definido), o **POST verify** (e opcionalmente o GET se especificado no PR) invoca o *probe* interno ao worker conforme **NFR20** (HMAC/mTLS — o que estiver adoptado no projecto).  
2. Mapeamento de falha do worker para `certificateReadiness: "erro"` + `errorCode` ∈ lista **`ADN_WORKER_*`** e `userMessage` via **`userMessageForAdnWorkerCode`** (`adn-worker-errors.ts`).  
3. **`certificateReadiness: "pronto"` (critério fechado @po):** unicamente quando o *probe* HTTP ao worker devolver **sucesso explícito** (`ok: true` no contrato JSON do *probe*) **e** a última resposta de *probe* bem sucedida tiver ocorrido há **≤ 15 minutos**, medida **exclusivamente** pelo **relógio do servidor do portal** no instante em que o *probe* conclui (persistir um instante `lastSuccessfulProbeAt` ou reutilizar `lastCheckedAt` **só** quando o *probe* devolve `ok: true` — **uma** linha temporal, mesma regra em GET e POST). **Não** usar timestamp devolvido pelo **worker** para frescura neste MVP (excepção: **ADR** + **@po** + actualização deste AC). **Proibido** nesta story usar **apenas** heurística de `adn_sync_jobs` / último job para definir `pronto` (fica para backlog / ADR se `@po` quiser alargar).  
4. Timeout / 5xx do worker → **`pendente_verificacao`** (ou política documentada em §4.3 arquitectura), **sem** vazar stack trace ao cliente.  
5. **@qa:** teste de integração com fixture/mock de resposta worker contendo string sensível no *backend interno* → corpo JSON **público** **não** contém substrings `certificates/`, `.pfx`, `thumbprint=` (padrão **CER-05** / `adn-api.integration.test.ts`).  
6. **Persistência (arquitectura §6) — fecho binário na descrição do PR:** incluir **exactamente uma** linha no corpo do PR, copiável e literal:  
   - **`Persistência readiness: implementada`** — seguida de referência a migração / tabelas / campos e ao código que persiste `lastSuccessfulProbeAt` (ou equivalente) **ou**  
   - **`Persistência readiness: adiada`** — seguida de **URL de issue** de follow-up (título sugerido: `UIP-03: persistência readiness`) e nota de que **não** há estado de frescura entre *cold starts* / *deploys* (recalculado por pedido até persistência existir).  
   **Proibido** merge sem uma destas duas linhas. **@qa:** evidência (screenshot ou *copy-paste* da secção “Persistência readiness” do PR) no checklist de review.

### Tasks / Subtasks

- [x] Cliente HTTP servidor-para-servidor (fetch com timeout) isolado em módulo testável.  
- [x] No PR: referenciar **UIP-03 AC3** como critério `pronto` (alterações ao critério exigem **@po** + actualização deste ficheiro). **ADR** curto só se afectar contratos fora do ADN.  
- [x] No PR: cumprir **UIP-03 AC6** (linha `Persistência readiness:` conforme acima).

### Dev Notes

- Se o worker real ainda não existir: **mock** no teste + contract test; feature flag **off** em produção até worker suportar *probe*.

---

## UIP-04 — Story: UI — card “Certificado para o ADN” e verificação

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **UIP-01** + **UIP-02** disponíveis em ambiente de desenvolvimento; [spec UIP](front-end-spec-instalacao-certificado-empresa-monitorada-utilizador.md) §3.1–7.

**Referências:** `docs/front-end-spec-instalacao-certificado-empresa-monitorada-utilizador.md`; PRD **UIP-FR3**, **UIP-FR5**; **CER-04** (reuso `getAdnCertRunbookUrl`).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@ux-design-expert`  
- **@qa:** smoke a11y + regressão CER-04

### Story

**As a** admin da organização,  
**I want** ver o estado do certificado, verificar de novo quando necessário e abrir o guia técnico na secção ADN,  
**so that** saiba se posso sincronizar e o que falta no servidor (**UIP-FR1**, **UIP-FR3**, **CE-FR9**).

### Acceptance Criteria

1. Novo organismo (ex.: **`AdnCertificateReadinessCard`**) integrado em **`adn-sync-panel.tsx`** **acima** do bloco “último job + CTAs” conforme [spec UIP §3.1](front-end-spec-instalacao-certificado-empresa-monitorada-utilizador.md).  
2. Mostra **badge** / texto para `pendente_verificacao`, `pronto`, `erro` com copy alinhada ao spec §5.2 (pt-BR); em `erro`, **Alert** `destructive` subordinado com `userMessage` + link **“Ver guia técnico”** (`getAdnCertRunbookUrl`).  
3. Botão **“Verificar de novo”** visível apenas para **admin org** (mesma regra que POST sync); utilizador não-admin: estado legível sem botão **ou** botão desactivado com texto explicativo (spec §7.2).  
4. Estados de carregamento e **`aria-live="polite"`** para mudança de estado após verificação bem sucedida (spec §7.1); **sem** spam em cada poll de job ADN.  
5. **“Verificar de novo”** chama POST verify; trata **429** com copy do spec UX §6.2 usando `retryAfterSeconds` se presente.  
6. Linha de **segurança** (*certificado não é instalado nesta página*) conforme spec §5.1 item 6; **nenhum** input de ficheiro (**CE-NFR1**).  
7. **Modal “Como funciona?”** inclui bullet adicional do spec UIP §8.  
8. **Layout CER-04 + UIP — opção A (obrigatório):** existe **um único** bloco informativo de certificado na secção ADN: o **`AdnCertificateReadinessCard`** incorpora as **duas frases** obrigatórias e o **link** “Como configurar o certificado no servidor de recolha” (**CER-04** / spec CER §5.1) **no mesmo** card que o estado / badge / “Verificar de novo”; **não** permanece um segundo **`Alert`** “Certificado digital” *separado* (o bloco shadcn actual do CER-04 deve ser **removido ou refactorizado** para não duplicar conteúdo). **Excepção:** só com **ADR** + assinatura `@po` (opção B — dois blocos) e copy aprovada.  
9. **@qa:** ordem de tab (spec §7); org ADN off → card **não** aparece (mesmo critério FR45 que painel); evidência de **um** bloco certificado (screenshot ou checklist) + regressão a11y.

### Tasks / Subtasks

- [x] `lib/adn-certificate-readiness-client.ts` + `hooks/use-adn-certificate-readiness.ts`.  
- [x] Opcional: revalidar readiness após sync bem sucedido (spec UX §9).  
- [x] **DoD conjunto §5:** garantir merge de `docs/front-end-spec-importacao-certificado-empresa-monitorada-adn.md` **§3.1.1** no mesmo ciclo de release que este PR (ou PR `docs/` referenciado aqui).

### Dev Notes

- Se **UIP-03** não estiver mergeado: UI funciona com nível 0 (`pendente_verificacao` + verify idempotente).

---

## Backlog (Fase 2+ — não sprintar sem ADR)

| ID | Título | PRD |
| -- | ------ | --- |
| **UIP-B-01** | Upload PFX para cofre (**Trilho B**) | UIP-FR6–8, UIP-NFR5–8 |
| **UIP-D-01** | Solicitar instalação gerida (**Trilho D**) | UIP-FR9 |

---

## Change log (documento de stories)

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 0.1    | UIP-01 a UIP-04 (Fase 1); backlog B/D; DoD e índice. |
| 2026-04-24 | 0.2    | Refinamento PO: AC7 multi-tenant; AC4 POST nível 0 único; UIP-03 AC3 `pronto` fechado; UIP-04 layout opção A (AC8); gates **@qa** UIP-01; critério Ready for sprint UIP-03. |
| 2026-04-24 | 0.3    | PO nits pós-nota 9/10: **UIP-03 AC3** — frescura só relógio portal; nota cruzada **CER-04** em `incremento-certificado-adn-guia-portal.md`. |
| 2026-04-24 | 0.4    | PO nits 9,5/10: **UIP-03 AC6** binário + **@qa**; **DoD** item spec CER **§3.1.1**; **Ready for sprint** referencia AC6; `front-end-spec-importacao-certificado-empresa-monitorada-adn.md` v1.1. |
| 2026-04-24 | 0.5    | PO nit 9,8/10: *Dev Notes* **UIP-01** / **UIP-04** — **`pendente_verificacao`** em vez de `pendente` (alinhamento ao enum dos AC). |
| 2026-04-24 | 0.6    | Implementação **@dev**: UIP-01–04 (API GET/POST verify, *probe* opt-in, card + testes; **Persistência readiness: adiada**). |
| 2026-04-24 | 0.7    | **@dev** pós-QA: testes AC3 (frescura), GET readiness ADN off, loading + *Alert* destructive, doc *probe* URL+HMAC, modelo PR **UIP-03 AC6**. |

---

## Dev Agent Record

### File List

- `apps/web/src/lib/adn-certificate-readiness-schema.ts`
- `apps/web/src/lib/adn-certificate-readiness-memory.ts`
- `apps/web/src/lib/adn-certificate-readiness-logic.ts`
- `apps/web/src/lib/adn-cert-probe.ts`
- `apps/web/src/lib/adn-certificate-readiness-client.ts`
- `apps/web/src/lib/adn-runbook-anchor.ts`
- `apps/web/src/lib/adn-hmac.ts`
- `apps/web/src/lib/adn-rate-limit.ts`
- `apps/web/src/hooks/use-adn-certificate-readiness.ts`
- `apps/web/src/hooks/use-adn-sync-for-company.ts`
- `apps/web/src/server/api/v1/handlers/adn-certificate-readiness.ts`
- `apps/web/src/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/certificate-readiness/route.ts`
- `apps/web/src/app/api/v1/organizations/[organizationId]/monitored-companies/[companyId]/adn/certificate-readiness/verify/route.ts`
- `apps/web/src/app/(dashboard)/empresas/[id]/adn-certificate-readiness-card.tsx`
- `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`
- `apps/web/src/app/api/v1/adn-api.integration.test.ts`
- `apps/web/src/lib/adn-certificate-readiness-logic.test.ts`
- `apps/web/src/components/ui/alert.tsx`
- `.env.example`
- `docs/architecture-instalacao-certificado-empresa-monitorada-utilizador.md`

### Completion Notes

- **Persistência readiness: adiada** — `lastCheckedAt` / *probe* ok em `adn-certificate-readiness-memory.ts` (Map em memória; sem migração).  
- **UIP-03 AC6 — texto sugerido para a descrição do PR** (substituir `<URL_ISSUE>` após criar o *ticket*):  
  `Persistência readiness: adiada — issue: <URL_ISSUE> — sem estado de frescura entre cold starts/deploys até migração; código: adn-certificate-readiness-memory.ts.`  
- **UIP-03 AC3** — `pronto` só com *probe* `ok: true` e frescura ≤ 15 min no relógio do portal (`lastSuccessfulProbeAtIso`); cobertura em `adn-certificate-readiness-logic.test.ts`.  
- **Resposta a QA (@dev):** GET `certificate-readiness` com org ADN off → 404 (integração); loading inicial do card (`role="status"`); *Alert* `variant="destructive"`; `.env.example` + arquitectura §4.4 sobre URL+HMAC para activar *probe*.

---

## QA Results

**Data:** 2026-04-24  
**Revisor:** Quinn (QA / AIOS)  
**Escopo:** revisão estática do código e dos testes referidos na story; execução local dos testes unitários Vitest (ficheiros de integração ADN permanecem `skip` sem `DATABASE_URL`).

#### Decisão de gate: **CONCERNS**

A implementação cobre a maior parte dos AC **UIP-01**, **UIP-02**, **UIP-03** e **UIP-04** com boa aderência a segurança (sem PFX/paths no JSON público) e rastreio em testes. Recomendo **merge** após fechar os itens **obrigatórios** listados em “Bloqueadores / PR” e, idealmente, os “Melhorias”.

#### Rastreio aos AC (resumo)

| Story | AC / tema | Resultado | Notas |
| ----- | ---------- | ----------- | ----- |
| **UIP-01** | Rota GET + `resolveAdnPublicAccess` | **OK** | Handler dedicado + `route.ts`; erros alinhados ao *gate* ADN. |
| **UIP-01** | Zod + campos mínimos + `no-store` | **OK** | `adn-certificate-readiness-schema.ts` + `jsonReadiness`; header `Cache-Control: no-store`. |
| **UIP-01** | Nível 0 + `probeAvailable` | **OK** | `pendente_verificacao` quando o *probe* não está em execução; `probeAvailable` coerente com `isAdnCertProbeExecutionEnabled()`. |
| **UIP-01** | Testes 401 / 404 / AC7 | **OK** | `adn-api.integration.test.ts`: sem sessão → 401; `companyId` de outra org no path → 404 sem corpo de readiness. |
| **UIP-02** | POST verify + admin + rate limit | **OK** | `assertAdnOrgAdmin`; `adnCertVerifyRateKey` + `ADN_CERT_VERIFY_RATE_LIMIT_PER_MIN`; 429 com `error_code`, `retryAfterSeconds`, `Retry-After`. |
| **UIP-02** | AC4 GET ↔ POST | **OK** | Teste “dois POSTs” + GET com mesmo `lastCheckedAt`. |
| **UIP-02** | Logs INFO sem CNPJ+thumbprint | **OK** | `console.info` só com `organization_id`, `company_id`, `readiness`. |
| **UIP-03** | *Probe* HMAC + `ok` / `error_code` | **OK** | `adn-cert-probe.ts` + mapeamento para `erro` / `userMessageForAdnWorkerCode`. |
| **UIP-03** | AC3 frescura 15 min (portal) | **OK** (lógica) | `FRESH_MS` + `lastSuccessfulProbeAtIso`; sem timestamp do worker. |
| **UIP-03** | AC3 cobertura de teste `pronto` / expiração | **CONCERNS** | Não há teste automatizado explícito para `ok: true` → `pronto` nem para expiração após 15 min. |
| **UIP-03** | AC5 corpo público sem *leaks* | **OK** | Teste com mock `fetch` + campo `leak` no JSON do worker; corpo 200 sem `certificates/`, `.pfx`, `thumbprint=`. |
| **UIP-03** | AC6 linha PR `Persistência readiness:` | **CONCERNS** | Story exige, se **adiada**, linha literal **e** URL de *issue* de follow-up; o *Dev Agent Record* cita “adiada” e ficheiro, mas **não** substitui o link de *issue* no PR — validar no merge. |
| **UIP-03** | AC1 texto “URL **ou** flag” vs código | **CONCERNS** | Código exige URL **e** `ADN_WORKER_HMAC_SECRET` (e flag ≠ false); é mais seguro que “só URL”; alinhar doc/PR se necessário. |
| **UIP-04** | Card acima do job + opção A | **OK** | `AdnCertificateReadinessCard` antes do estado do job; `Alert` CER duplicado removido; duas frases + link no card. |
| **UIP-04** | `aria-live` pós-verify | **OK** | Região `sr-only` com `aria-live="polite"` só quando há `liveMsg` após POST OK; *poll* de job no painel separado. |
| **UIP-04** | 429 + `retryAfterSeconds` | **OK** | `postCertificateReadinessVerify` + copy com segundos. |
| **UIP-04** | Modal §8 | **OK** | *Bullet* “Pronto para o ADN…” em `adn-sync-panel.tsx`. |
| **UIP-04** | *Alert* `destructive` shadcn | **CONCERNS** | Erro usa `div` estilizado `role="alert"` (o UI kit só expõe *Alert* informativo); aceitável funcionalmente, difere do texto do AC. |
| **UIP-04** | Loading inicial do bloco | **CONCERNS** | Em `access === "loading"` o card devolve `null` (sem *skeleton* / “A carregar…” do spec §6.1); UX menor vs spec. |
| **DoD** | `.env.example` | **OK** | Variáveis de verify e *probe* documentadas. |
| **DoD** | §3.1.1 spec CER | **OK** (doc) | Ficheiro `docs/front-end-spec-importacao-certificado-empresa-monitorada-adn.md` já contém §3.1.1 (v1.1). |
| **DoD** | CodeRabbit no PR | **N/A (código)** | Confirmar no pipeline / PR antes do merge (**DoD** conjunto §1). |

#### Evidência @qa (testes automatizados)

- **UIP-01 AC7 / multi-tenant:** `it("GET certificate-readiness com companyId de outra organização no path → 404 (UIP-01 AC7)")` em `apps/web/src/app/api/v1/adn-api.integration.test.ts`.  
- **UIP-02:** 403 *non-admin*, 429 + `retryAfterSeconds`, AC4 dois POSTs + GET.  
- **UIP-03 AC5:** teste “UIP-03: resposta pública do verify não contém substrings sensíveis…” (mock `fetch`).

*Executar `npm run test` com `DATABASE_URL` definido para validar os 19 testes de integração ADN no CI ou máquina de desenvolvimento.*

#### Bloqueadores / PR (antes do merge)

1. **UIP-03 AC6:** na descrição do PR, incluir **exactamente uma** linha entre:  
   - `Persistência readiness: implementada` (+ referência BD/código), **ou**  
   - `Persistência readiness: adiada` + **URL de *issue*** de follow-up (título sugerido na story) + nota sobre *cold start* — conforme AC; anexar *copy-paste* no checklist de review **@qa**.  
2. **DoD §1:** evidência de CodeRabbit (ou equivalente) no PR.

#### Melhorias recomendadas (não bloqueantes)

1. Teste de integração: GET `certificate-readiness` com org **ADN off** → 404 (espelhar teste já existente para `sync`).  
2. Testes com *clock* / tempo fixo para **UIP-03 AC3** (`pronto` e expiração 15 min).  
3. Loading do card: linha `role="status"` ou *skeleton* durante o primeiro GET de readiness (spec §6.1).  
4. Documentar em arquitectura/PR que o *probe* exige **URL + `ADN_WORKER_HMAC_SECRET`** (não só URL).

---

— **River (SM / AIOS)** — v0.5; vocabulário contrato ↔ AC; pronta para `*validate-story-draft`.
