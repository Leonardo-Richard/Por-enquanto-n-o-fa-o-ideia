# User stories — Incremento: forçar busca de notas na ficha da empresa (épico **BNF-01**)

**Produto:** Portal NF  
**Fontes:** `docs/prd-forcar-busca-notas-ficha-empresa.md`, `docs/architecture-forcar-busca-notas-ficha-empresa.md`, `docs/front-end-spec-forcar-busca-notas-ficha-empresa.md`, `docs/briefing-forcar-busca-notas-ficha-empresa.md`  
**Pré-requisito técnico:** `apps/web/src/lib/adn-sync-client.ts` e `apps/web/src/hooks/use-adn-sync-for-company.ts` operacionais (épico **EM-01A** / listagem ADN); **`POST`** ADN não deve ser duplicado (**NFR35**).  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-24  
**Versão do conjunto:** **1.2** — fecho SM do lembrete PO (**AC10** / `feature_off`): decisão binária **omitir** callout **FR65/FR66** + texto **FR67** quando sync ADN indisponível; **AC9** reservado a **`forbidden`** + callout; **AC11–AC12** defesa multi-tenant e regressão.  
**Estado do conjunto:** **Ready for sprint** (re-gate PO **v1.2** — **10/10**).

---

## DoR para `@dev` (checklist rápida)

- [ ] Ler PRD BNF-01 (FR64–FR68, NFR35–NFR38), arquitectura BNF e spec UX BNF.  
- [ ] Confirmar que `useAdnSyncForCompany` / `postAdnSyncRequest` já existem e que a ficha `/empresas/[id]` monta `AdnSyncPanel` com `company` completo (incl. `organizationId`).  
- [ ] Branch sugerida: `feature/bnf-01-ficha-notas-raiz-local`.  
- [ ] Ordem recomendada: **BNF-01A** → **BNF-01B** (um único PR é aceitável se a equipa preferir entrega atómica).

---

## Índice

| ID | Título resumido | Dependências |
| -- | ----------------- | -------------- |
| **BNF-01A** | Hook `useOrganizationAdnSyncSettings` + leitura segura de `localDownloadRoot` / `canManage` + **UI loading** no `AdnSyncPanel` | Pré-requisito EM (cliente ADN) |
| **BNF-01B** | `AdnSyncPanel`: callout raiz, copy FR67, CTA «Buscar notas agora», confirmação/sucesso, dialog, **FR68** | **BNF-01A** (ou mesmo PR) |
| **BNF-01C** | (Opcional) Painel — migrar `useEffect` de `adn-sync-settings` para o hook partilhado | **BNF-01A** |

**Ordem sugerida:** BNF-01A → BNF-01B; **BNF-01C** em sprint seguinte ou no mesmo PR se custo marginal for baixo.

### Rastreio PRD épico BNF-01.1–.5 → stories

| PRD (história resumo) | Cobertura |
| --------------------- | ---------- |
| **BNF-01.1** (admin — buscar notas) | **BNF-01B** — CTA + mesmo `POST` |
| **BNF-01.2** (operador — ver raiz) | **BNF-01A** (dados) + **BNF-01B** (callout **FR65/FR66**) |
| **BNF-01.3** (browser vs disco) | **BNF-01B** — texto **FR67** + bullets no dialog |
| **BNF-01.4** (a11y) | **BNF-01B** — `aria-busy`, rótulos, `role` dos callouts |
| **BNF-01.5** (regressão) | DoD macro + smoke ficha + `PATCH` empresa |

### Rastreio FR / NFR

| ID | Story principal |
| -- | ---------------- |
| **FR64** | **BNF-01B** |
| **FR65**, **FR66** | **BNF-01A** (dados) + **BNF-01B** (UI) |
| **FR67** | **BNF-01B** |
| **FR68** | **BNF-01B** |
| **NFR35** | **BNF-01B** (sem segundo `POST`); **BNF-01A** não toca em `adn-sync-client` POST |
| **NFR36**, **NFR37** | **BNF-01B** (copy + paridade 429) |
| **NFR38** | **BNF-01A** + **BNF-01B** (`organizationId` só de `company.organizationId`) |
| **Defesa UI multi-tenant** (paridade **EM-01B AC9**) | **BNF-01B** — **AC11** |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit no PR.  
- **Foco:** ausência de segundo cliente `POST` para `adn/sync`; `organizationId` na URL de settings == `company.organizationId`; **AC9** (`forbidden` + callout); **AC10** (`feature_off` — sem callout raiz / **FR67**); **AC11** (org activa vs `company.organizationId`); **AC12** (regressão / «Actualizar»); sem vazamento de path em logs; contraste dos callouts (spec UX §8).

---

## Definition of Done (macro)

- [ ] Na ficha `/empresas/[id]`, secção ADN/notas cumpre **FR64–FR68** com evidência no PR (screenshots opcionais + notas QA).  
- [ ] `GET .../adn-sync-settings` usado com `credentials: "include"` e cancelamento ao desmontar (**arquitectura §7**).  
- [ ] Mensagem de sucesso após **202** menciona fila e, quando aplicável, espelho local (**PRD §3**).  
- [ ] Regressão zero: `PATCH /api/v1/companies/{id}`, certificado/readiness, botão «Actualizar» do painel ADN.  
- [ ] Smoke manual ou e2e: raiz vazia, raiz definida, 403 sync, 429 sync, **`feature_off`** (confirmar **ausência** de callout **FR65/FR66** e de bloco **FR67**), **`access === "forbidden"`** com settings **200** (callout visível, sem CTA de `POST`).

### Definition of Done (por fatia)

| ID | DoD mínimo |
| -- | ----------- |
| **BNF-01A** | Hook exportado **e** integrado no **`AdnSyncPanel`** com **estado de carregamento visível** (ex.: linha ou texto «A carregar definições…» / skeleton mínimo) enquanto `loading === true`; **proibido** fechar **BNF-01A** só com hook órfão sem qualquer UI — excepto se o PR **único** incluir **BNF-01B** na mesma entrega (referenciar no PR). Sem warnings TS; cancelamento ao unmount verificado (nota no PR). |
| **BNF-01B** | UI conforme spec UX §5.1; **AC1–AC12** verificados; **um** botão primário de disparo (**spec §5** variante V1-recomendada); dialog «Como funciona?» actualizado se o copy o exigir. |
| **BNF-01C** | `dashboard/page.tsx` deixa de duplicar lógica de parse do `fetch` settings; comportamento do Painel equivalente. |

---

## Avaliação PO @pax — gate `*validate-story-draft` (conjunto **v1.0** — histórico)

**Nota global (v1.0):** **8,5 / 10** — válida para o rascunho **antes** do refino SM **v1.1**; as lacunas listadas foram **subsequentesmente tratadas** (ver conjunto **v1.1** abaixo).

| Critério | Comentário (contexto v1.0) |
| -------- | --------------------------- |
| **Rastreio** | Excelente: PRD, arquitectura, spec e índice alinhados. |
| **INVEST / valor** | **BNF-01B** forte; **BNF-01A** precisava alinhar persona e DoD. |
| **Sequência** | **BNF-01A → BNF-01B** clara. |
| **Verificabilidade** | ACs testáveis; faltavam smoke `forbidden` e defesa org activa explícita. |
| **Lacunas (resolvidas em v1.1)** | Ver «Refino sugerido» original — itens 1–4 incorporados pelo **@sm**. |

---

## Avaliação PO @pax — re-gate `*validate-story-draft` (conjunto **v1.1**)

**Nota global (v1.1):** **9,5 / 10** — **aprovado sem reservas** para `@dev`; lembrete **AC9** / `feature_off` **fechado pelo SM em v1.2** (ver **BNF-01B AC10**).

| Critério | Comentário |
| -------- | ---------- |
| **Rastreio** | Mantém-se excelente; tabela **Defesa UI multi-tenant** + **CodeRabbit** actualizados. |
| **INVEST / valor** | **BNF-01A** com título **Enabler**, persona **operador/admin** e *so that* alinhado a **BNF-01.2**; **BNF-01B** cobre admin **e** operador. |
| **Sequência / DoR** | DoD **BNF-01A** sem ambiguidade de «hook órfão»; excepção PR único explícita. |
| **Verificabilidade** | **AC9–AC12** fecham **forbidden**, **`feature_off`**, **EM-01B AC9**, regressão; smoke macro alinhado (**v1.2**). |
| **NFR36** | **Dev Note** com âncora **spec UX §5.2** — critério de copy objectivável no PR. |

### Refino sugerido (opcional **v1.1** — não obrigatório para arrancar)

1. Reescrever story **BNF-01A** com persona **operador / equipa** ou marcar no título **«Enabler técnico»**.  
2. Acrescentar em **BNF-01B** um AC sobre **callout + `forbidden`** / `feature_off` (visibilidade da raiz vs CTA).  
3. Acrescentar **AC** ou **Dev Note** único: validação `company.organizationId` alinhada à org activa da sessão (paridade **EM-01B AC9**).  
4. Remover ambiguidade do DoD **BNF-01A** («só hook» vs UI mínima).

**Estado:** itens 1–4 **incorporados na versão 1.1** deste documento (secções **BNF-01A/B** e **DoD**).

---

## Registo de aprovação PO

| Data | Versão | Decisão | Assinatura |
| ---- | ------ | -------- | ---------- |
| 2026-04-24 | 1.0 | Rascunho SM (conjunto BNF-01A–C) | @sm |
| 2026-04-24 | 1.0 | Gate `*validate-story-draft`: **nota 8,5/10** — aprovado com refinos opcionais (secção «Avaliação PO @pax») | @po |
| 2026-04-24 | 1.1 | Refino SM: critérios PO integrados (persona **BNF-01A**, **AC9–AC10**, DoD **BNF-01A**, smoke `forbidden`, **NFR36** ↔ spec §5.2) | @sm |
| 2026-04-24 | 1.1 | Re-gate `*validate-story-draft`: **nota 9,5/10** — aprovado sem reservas (lembrete opcional **AC9** / `feature_off`) | @po |
| 2026-04-24 | 1.2 | Refino SM: **AC10** explícito para `feature_off` (omitir callout **FR65/FR66** + **FR67**); renumerar **AC11–AC12**; smoke e **CodeRabbit** actualizados | @sm |
| 2026-04-24 | 1.2 | Re-gate `*validate-story-draft`: **nota 10/10** — aprovado sem reservas; lembrete **v1.1** encerrado (**AC10** `feature_off`) | @po |

---

## Avaliação PO @pax — re-gate `*validate-story-draft` (conjunto **v1.2**)

**Nota global (v1.2):** **10 / 10** — conjunto **pronto para implementação** sem lacunas documentais; **AC9** / **AC10** / **AC11** / **AC12** são mutuamente claros; **DoD** e **CodeRabbit** reflectem smoke **`feature_off`** e **`forbidden`**.

| Critério | Comentário |
| -------- | ---------- |
| **Rastreio** | PRD, arquitectura, spec, índice e tabelas **FR/NFR** coerentes com **AC1–AC12**. |
| **INVEST / valor** | Histórias **BNF-01A** (enabler + valor operador) e **BNF-01B** (admin/operador + CTA) bem delimitadas. |
| **Verificabilidade** | Critérios binários onde necessário (**AC10**); matriz de estados completa para **@qa**. |
| **Governança** | Registo **SM/PO** versionado; histórico **v1.0** preservado. |

**Micro-correcção documental (v1.2):** o resumo da versão no cabeçalho foi alinhado (**`feature_off`** ↔ **AC10**, não **AC9**); tasks **BNF-01B** referem **AC9–AC12**.

---

## BNF-01A — Story (Enabler técnico): hook de definições ADN da organização (`localDownloadRoot`)

**Status:** Draft  

**Dependências (DoR):** Pré-requisito técnico (hook/módulo ADN sync existente).

**Referências:** Arquitectura BNF §3 ADR-01/02, §4.1, §5, §6; PRD **FR65/FR66** (dados), **NFR38**; PRD **BNF-01.2** (operador vê contexto da raiz).

**Riscos:** `organizationId` incorrecto na URL; fetch sem cancelamento (memory leak / setState após unmount).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` — verificar que utilizador sem acesso à org não vê valores de outra org (403/404 tratados).

### Story

**As a** operador(a) ou administrador(a) que consulta a **ficha da empresa**,  
**I want** que o portal carregue **uma única vez** (por montagem lógica) as definições ADN da organização (`localDownloadRoot`, `adnSyncEnabled`, `canManage`) via um hook reutilizável,  
**so that** eu veja na mesma página **informação correcta sobre a pasta raiz** (**BNF-01.2**, **FR65/FR66**) sem duplicação de `fetch` entre Painel e ficha e sem violar **NFR38**.

### Acceptance Criteria

1. Existe ficheiro **`apps/web/src/hooks/use-organization-adn-sync-settings.ts`** (nome pode ajustar-se no PR) que aceita **`organizationId: string`** e devolve estado explícito: pelo menos **`loading`**, **`data`** (ou `null` quando `!res.ok`), **`error`** (opcional discriminação rede vs HTTP).  
2. O hook executa **`GET /api/v1/organizations/{organizationId}/adn-sync-settings`** com **`credentials: "include"`** e trata **`res.ok`**; em sucesso, faz parse do JSON alinhado ao handler: `localDownloadRoot`, `adnSyncEnabled`, `canManage` (tipos TypeScript partilhados ou inline consistentes com `configuracoes/page.tsx`).  
3. **Cancelamento:** em `useEffect`, evitar `setState` após unmount (padrão `cancelled` ou `AbortController` — conforme arquitectura BNF §5).  
4. **NFR38:** o `organizationId` passado ao hook na ficha deve vir **exclusivamente** de **`company.organizationId`** após `GET /api/v1/companies/{id}` com sucesso; documentar no PR que não se usa query string para org.  
5. Quando `!res.ok`, o estado não deve expor valores de uma resposta anterior de outra org (reset ao mudar `organizationId` ou ao falhar).  
6. **DoD / integração:** o hook é **consumido no `AdnSyncPanel`** e, enquanto `loading`, a UI mostra **indicador visível** de carregamento das definições (texto ou skeleton — ver **DoD** macro); **não** é aceite entregar apenas o ficheiro do hook sem qualquer alteração visível no painel, **salvo** PR único **BNF-01A+B** onde a UI final de **BNF-01B** entra no mesmo merge (declarar no PR).

### Tasks / Subtasks

- [x] Implementar o hook conforme ACs.  
- [x] Integrar no **`AdnSyncPanel`** com estado de **loading** visível (**AC6**).  
- [ ] (Opcional) Teste unit com `fetch` mockado — 200 com `localDownloadRoot: null`, 200 com string, 403.

### Dev Notes

- Reutilizar padrão de `apps/web/src/app/(dashboard)/dashboard/page.tsx` (linhas ~17–50) como referência de parse.  
- **Não** estender `GET /api/v1/companies/{id}` com `localDownloadRoot` (**ADR-01**).  
- A validação **`company.organizationId` vs org activa** fica explicitada em **BNF-01B AC11** (o hook **não** deve ser invocado com id inconsistente — ver **Dev Note** em **BNF-01B**).

---

## BNF-01B — Story: ficha empresa — UI «Buscar notas agora» + contexto de pasta local

**Status:** Draft  

**Dependências (DoR):** **BNF-01A** concluído **ou** incluído no mesmo PR antes da UI final.

**Referências:** PRD **FR64–FR68**; spec UX BNF §4–§8, §12; arquitectura BNF §2, §5, §8; `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`, `use-adn-sync-for-company.ts`.

**Riscos:** Dois botões com o mesmo `POST` (spec proíbe); copy a induzir download síncrono no browser.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` — matriz PRD §10 + a11y **FR68**

### Story

**As a** administrador(a) **ou operador(a)** na ficha de uma empresa monitorada,  
**I want** ver o **contexto da pasta raiz** da organização e, quando autorizado(a), um controlo claro **«Buscar notas agora»**, com texto que explique **fila vs disco**,  
**so that** eu perceba onde as notas podem ser espelhadas (**BNF-01.2**, **FR65–FR67**) e, com permissão, enfileire a recolha ADN com expectativas correctas (**FR64**) e sem regressão de acessibilidade (**FR68**).

### Acceptance Criteria

1. **FR64:** Com `access === "active"` e utilizador autorizado a `POST` (paridade actual), existe **um** botão primário cuja acção é **`requestSync`** do **`useAdnSyncForCompany`** (sem novo módulo `POST` — **NFR35**). O rótulo visível é **«Buscar notas agora»** (ou texto aprovado por **@po** no gate) e não existe segundo botão primário equivalente ao mesmo `POST` (**spec UX §5**).  
2. **FR65:** Se `localDownloadRoot` estiver ausente ou vazio após normalização, mostrar **callout persistente** (não só toast) com link para **`/configuracoes`** e copy alinhada ao PRD; o `POST` de sync **não** é bloqueado por este estado.  
3. **FR66:** Se `localDownloadRoot` estiver definido, mostrar estado positivo («Pasta raiz configurada…») + link para alterar em Configurações; nível de detalhe do path conforme decisão **@po/@qa** (mínimo: booleano sem path completo).  
4. **FR67:** Bloco de texto curto (1–3 frases) **acima** ou junto ao callout, distingindo pedido no browser (fila/job) vs ficheiros no disco (raiz + worker/agente).  
5. **FR68:** Botão primário com **`aria-busy={busy}`** (ou equivalente) e **`disabled={busy}`**; `aria-label` distinto de «Actualizar»; callouts informativos com **`role="status"`** (não `alert` para aviso não crítico — spec UX §8).  
6. **Confirmação:** `window.confirm` (MVP) com texto que mencione fila e dependência da pasta raiz (**PRD §3**, spec §5.2) — substituir constante em **`use-adn-sync-for-company.ts`** ou documentar duplicação evitada.  
7. **Sucesso:** após **202**, a mensagem (`actionMsg`) deve incluir referência à **fila** e, quando aplicável, ao **espelho local** assíncrono (**NFR36**).  
8. **Dialog «Como funciona?»:** actualizar bullets se necessário para mencionar espelho em disco / pasta raiz, sem contradizer a arquitectura (certificado continua fora do browser, etc.).  
9. **`forbidden` + callout de raiz (feedback PO v1.1):** Quando o hook de settings tiver **`data`** válido após `res.ok` **e** `access === "forbidden"`, o bloco **FR65/FR66** (**callout** de raiz) **deve** ser apresentado se aplicável (raiz vazia ou definida); o CTA **«Buscar notas agora»** / `POST` permanece **inactivo ou oculto** como na implementação actual — **sem** esconder o callout **só** por falta de permissão de sync.  
10. **`feature_off` — decisão binária (fecho lembrete PO → SM v1.2):** Com **`access === "feature_off"`** (sync ADN indisponível / **GET** sync **404**), **não** renderizar o **callout FR65/FR66** nem o bloco de texto **FR67** (fila vs disco / pasta raiz); manter apenas o copy já existente de funcionalidade ADN indisponível. O `GET adn-sync-settings` neste estado é **opcional** (optimização); se os dados forem obtidos, **não** os usar para mostrar callout de raiz nem **FR67**.  
11. **Defesa multi-tenant (paridade EM-01B AC9):** Se `company.organizationId` **≠** `effectiveOrganizationId` retornado pelo mesmo mecanismo de sessão usado no dashboard (ex.: `useMeSummary` / hook equivalente), **não** invocar `GET adn-sync-settings` para esse id **nem** renderizar callout com valores; mostrar estado neutro (ex.: omitir bloco de raiz) e **uma** estratégia documentada no PR (opcional: `console` apenas em `development`).  
12. **Regressão:** estados `feature_off`, `forbidden`, `error`, `loading` do painel ADN mantêm-se coerentes; **«Actualizar»** continua a chamar só `refresh()`.

### Tasks / Subtasks

- [x] Criar **`LocalDownloadRootCallout`** (ou equivalente) conforme spec UX §6.  
- [x] Alterar **`adn-sync-panel.tsx`**: consumir hook de **BNF-01A**, montar callout + texto **FR67**, renomear CTA, `aria-busy`, mensagens; implementar **AC9–AC12**.  
- [x] Rever título da secção (`h2`) se **@po** fechar «Notas e sincronização» vs manter «Sincronização ADN» + subtítulo.  
- [ ] Smoke: `access === "active"` com raiz null e com raiz definida; **429** no `POST`; **`access === "forbidden"`** com settings **200** (callout + sem CTA de sync); **`feature_off`** (sem callout **FR65/FR66** nem **FR67**).  
- [x] Confirmar que **`page.tsx`** da empresa não precisa de alterações estruturais (preferência arquitectura: lógica no painel).

### Dev Notes

- Não introduzir TanStack Query nesta story (**arquitectura ADR-03**).  
- Se **BNF-01A** e **BNF-01B** forem **um PR único**, ordenar commits: hook primeiro, UI depois.  
- **NFR36 — copy canónica:** usar como base os rascunhos em `docs/front-end-spec-forcar-busca-notas-ficha-empresa.md` **§5.2** para `window.confirm`, mensagem de sucesso pós-**202** e textos dos callouts **FR65/FR66**; qualquer alteração de redacção deve constar no PR com breve justificação ou aprovação **@po**.

---

## BNF-01C — Story (opcional): Painel — reutilizar hook de settings

**Status:** Draft / opcional  

**Dependências (DoR):** **BNF-01A** mergeado.

**Referências:** Arquitectura BNF §1 (factorização opcional), §5 última linha.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` — regressão Painel (indicador de pasta raiz / copy existente)

### Story

**As a** membro da equipa de manutenção,  
**I want** que o Painel use o mesmo hook **`useOrganizationAdnSyncSettings`** que a ficha da empresa,  
**so that** o parse de `localDownloadRoot` não divirja entre ficheiros (**NFR36** implícito em comportamento).

### Acceptance Criteria

1. `apps/web/src/app/(dashboard)/dashboard/page.tsx` deixa de implementar inline o `useEffect` de parse de **`adn-sync-settings`** **ou** reduz-se a um thin wrapper que chama o hook.  
2. Comportamento observável do Painel (estado `serverMirrorPath` ou equivalente) **equivalente** ao anterior.  
3. Sem novas chamadas HTTP extra por render (dependências do hook correctas).

### Tasks / Subtasks

- [ ] Refactor Painel para usar o hook.  
- [ ] Remover código morto / duplicado.  
- [ ] Smoke no dashboard com org com e sem `localDownloadRoot`.

---

## Notas de sequência e PR

1. **Um PR (BNF-01A+B):** aceitável — exigir revisão cuidadosa dos ACs **1–12** de **BNF-01B** e dos ACs (**1–6**) de **BNF-01A**.  
2. **Dois PRs:** **BNF-01A** primeiro (hook + **loading** visível no `AdnSyncPanel`), depois **BNF-01B** (UI completa).  
3. **BNF-01C:** sprint separado ou mesmo sprint se sobrar capacidade.

---

## Dev Agent Record — BNF-01A + BNF-01B

**Agent Model Used:** Cursor agent (implementação)

### Completion Notes

- Entrega atómica **BNF-01A+B**: hook `useOrganizationAdnSyncSettings` com `credentials: "include"`, `cache: "no-store"`, cancelamento no `useEffect` e reset quando `fetchEnabled` ou `organizationId` mudam.
- **AC10:** `GET adn-sync-settings` só com `access === "active" | "forbidden"`; em `feature_off` não há pedido nem UI **FR65/FR66/FR67**.
- **AC11:** `company.organizationId === effectiveOrganizationId` (`useMeSummary`); caso contrário sem fetch e sem callout; `console.warn` apenas em `development`.
- Copy de confirmação / sucesso alinhada à spec UX **§5.2**; CTA **«Buscar notas agora»** com `aria-busy` e `aria-label` distinto de **Actualizar**.
- `npm run typecheck` e `npm run test` em `apps/web` passaram (2026-04-24).
- **Pós-QA (@qa):** mensagem neutra com `role="status"` quando `GET adn-sync-settings` falha (HTTP/rede); em `access === "active"`, cartão de certificado/readiness renderizado **depois** de último job + acções (alinhamento spec UX §5.1).

### File List

- `apps/web/src/hooks/use-organization-adn-sync-settings.ts` (novo)
- `apps/web/src/app/(dashboard)/empresas/[id]/local-download-root-callout.tsx` (novo)
- `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`
- `apps/web/src/hooks/use-adn-sync-for-company.ts`

### Change Log

- 2026-04-24 — Implementação UI ficha empresa + hook de settings (épico BNF-01).
- 2026-04-24 — Ajustes pós-revisão QA: feedback de erro do settings + ordem certificado vs job/acções em `active`.

### Debug Log References

- N/A

---

## QA Results

**Revisor:** Quinn (@qa)  
**Data:** 2026-04-24  
**Âmbito:** revisão estática do código face a **BNF-01A** (AC1–6), **BNF-01B** (AC1–12), **NFR35–38**, DoD macro (evidência automatizada onde aplicável).  
**Evidência automatizada citada pelo @dev:** `npm run typecheck` e `npm run test` em `apps/web` — OK (revisão QA não reexecutou a pipeline nesta sessão).

### Decisão de gate

**PASS com observações (CONCERNS)** — critérios principais cobertos no código; permanecem dependências de **smoke manual** e um melhoramento opcional de UX/observabilidade.

### Rastreio BNF-01A

| AC | Veredicto | Notas |
| --- | --- | --- |
| 1 — Hook + estado `loading` / `data` / `error` | **OK** | `use-organization-adn-sync-settings.ts` + `fetchEnabled`. |
| 2 — `GET` + `credentials` + parse | **OK** | `credentials: "include"`, `cache: "no-store"`, campos alinhados a Configurações/handler. |
| 3 — Cancelamento / sem setState após unmount | **OK** | Flag `cancelled` no cleanup; reset ao mudar deps. |
| 4 — NFR38 `organizationId` só de `company` | **OK** | URL do hook usa `company.organizationId`; painel não usa query string. |
| 5 — Sem valores de org anterior em falha | **OK** | Início do efeito repõe `data`/`error`; abort lógico em corrida. |
| 6 — Loading visível no painel | **OK** | «A carregar definições…» quando `settingsFetchEnabled && settingsLoading`. |

### Rastreio BNF-01B

| AC | Veredicto | Notas |
| --- | --- | --- |
| FR64 — Um CTA primário `requestSync` | **OK** | Rótulo «Buscar notas agora»; único `POST` via hook existente (**NFR35**). |
| FR65 / FR66 — Callouts | **OK** | `LocalDownloadRootCallout` missing/configured; sem path completo na variante configured (**FR66**). |
| FR67 — Texto fila vs disco | **OK** | Parágrafo com `role="status"` antes dos callouts. |
| FR68 — a11y botão + callouts | **OK** | `aria-busy`, `disabled={busy}` no primário; `aria-label` distinto de Actualizar; callouts com `role="status"` (não `alert`). |
| Confirmação / sucesso | **OK** | `CONFIRM_TEXT` e mensagem pós-202 alinhados à spec **§5.2** (fila + espelho quando aplicável). |
| Dialog «Como funciona?» | **OK** | Bullet sobre pasta raiz / espelho em disco + worker. |
| AC9 — `forbidden` + callout, sem CTA POST | **OK** | Bloco raiz com `access === "forbidden"` + settings OK; ramo activo (CTA) não renderizado. |
| AC10 — `feature_off` sem FR65/66/67 | **OK** | `settingsFetchEnabled` só com `active` \| `forbidden`; sem GET nem bloco raiz em `feature_off`. |
| AC11 — Multi-tenant | **OK** | `useMeSummary` + igualdade de IDs; sem fetch nem callout se mismatch; `console.warn` só em `development`. |
| AC12 — Regressão Actualizar | **OK** | `refresh()` inalterado semântica; `aria-label` em Actualizar. |

### Observações (não bloqueantes)

1. **Falha silenciosa do `GET adn-sync-settings`:** com `active` ou `forbidden`, se `!settingsLoading && !settingsData && settingsError`, o painel não mostra linha de erro nem fallback — utilizador pode não perceber que o contexto de raiz não carregou. Sugestão futura (dívida leve): mensagem neutra «Não foi possível carregar a pasta raiz da organização» com `role="status"`.
2. **Ordem visual vs spec UX §5.1:** a spec sugere job depois de FR67/callout; no código, o cartão de **certificado/readiness** fica entre o bloco raiz e o «Último job». Não viola ACs; alinhar ao wireframe seria cosmético.
3. **Cobertura de testes:** task opcional de teste unitário ao hook permanece em aberto; smoke macro da story (incl. **429**, **forbidden**+settings 200, **feature_off**) continua **manual** — recomenda-se fechar antes do merge a produção.

### Itens fora do âmbito desta revisão

- **BNF-01C** (Painel a reutilizar o hook): não implementado — esperado.
- **CodeRabbit CLI (WSL):** não executado nesta revisão QA; manter no checklist do PR se política do repo o exigir.

### Resumo executivo

Implementação **coerente com a story v1.2** e com mitigação clara de **NFR35**, **NFR38**, **AC9–AC12**. **Gate: PASS com CONCERNS** até conclusão do **smoke** referido na própria story e decisão de produto sobre feedback em erro do `GET` settings.

---

— River, removendo obstáculos
