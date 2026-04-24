# User stories — Incremento: upload de certificado e-CNPJ pelo browser (edição empresa monitorada)

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** `docs/prd-upload-certificado-browser-edicao-empresa-monitorada.md`, `docs/architecture-upload-certificado-browser-edicao-empresa-monitorada.md`, `docs/front-end-spec-upload-certificado-browser-edicao-empresa-monitorada.md`, `docs/briefing-proposta-upload-certificado-browser-edicao-empresa.md`  
**Pré-requisitos:** bloco **Sincronização ADN** no detalhe da empresa (**ADN-07** / `incremento-integracao-nfse-dist-adn.md`). **ADR** mergeado **antes de UBR-03** (DDL alinhado ao modelo de segredos). **Rotas HTTP de certificado** (a partir de **UBR-04**) e **escrita no cofre** (a partir de **UBR-05**) exigem **UBR-01**; **UBR-05** em diante exigem **UBR-02** (cofre *staging*). Spec UX e arquitectura técnica na versão referenciada no cabeçalho.  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-24  
**Versão do conjunto:** **0.4** — refinamento pós-avaliação **@po** (nota **9,5/10**): alinhamento tabela histórica **v0.2** com **§Promoção**; rastreio **UBR-05** + **AC5**.  
**Estado do conjunto:** **Draft** — ver **§Promoção de estado** abaixo.

### Refinamento @po incorporado (v0.2) — *histórico*

| Feedback PO | Resposta neste documento |
| ------------- | ------------------------- |
| **UBR-04 (L)** demasiado denso | Partido em **UBR-04** (contrato + validação + `GET`) e **UBR-05** (escrita cofre + `POST` + rate limit). |
| **CE-BR8** só no DoD global | Nova story **UBR-11** com AC explícito de regressão **FR48**. |
| **BR-NFR8** (*virus scan*) ausente | Secção **§Backlog** pós-MVP (**UBR-BL-01**); fora do *scope* mínimo **UBR-01–UBR-11**. |
| **BR-NFR7** (LGPD / DPIA) | **§Conformidade e produto**; *nota:* a linha original “**Promoção → Ready for sprint (produção)**” foi **substituída** em **v0.3** por **Ready for sprint** (*staging*) vs **Go produção** — ver **§Promoção de estado** actual. |
| Contrato API FE/BE | **UBR-04** AC1: schema **Zod** e/ou **OpenAPI** partilhado no repositório. |
| **UBR-03** teste RLS | DoR + task: *seed* mínimo duas orgs; teste documentado. |
| **UBR-02** referência a story | Integração aponta para **UBR-05** (não UBR-04). |

### Refinamento @po incorporado (v0.3)

| Feedback PO (nota 9/10) | Resposta neste documento |
| ------------------------ | --------------------------- |
| Pré-requisito **“UBR-03+ cofre/API”** ambíguo | Cabeçalho **Pré-requisitos** separa **UBR-03** (só DDL + ADR), **UBR-04+** (API) e **UBR-05+** (cofre + **UBR-02**). |
| **202 Accepted** / `pending_validation` sem *owner* | **UBR-05** AC5: *MVP* síncrono **ou** entrega em **UBR-BL-02**; não deixar ambos em aberto. |
| **Sprint ready** vs **produção** | **§Promoção**: linhas distintas **Ready for sprint** (*staging*) e **Go produção** (+ **§Conformidade**). |

### Refinamento @po incorporado (v0.4)

| Feedback PO (nota 9,5/10) | Resposta neste documento |
| -------------------------- | ------------------------- |
| Tabela **v0.2** vs **§Promoção** actual | Secção **v0.2** marcada como *histórico*; linha **BR-NFR7** explicita **supersedido** por **v0.3**. |
| Rastreio **UBR-05** sem **AC5** | Linha **UBR-05** na tabela **§Rastreio** referencia **AC5** + **UBR-BL-02**. |

---

## Ready por story (**UBR-01** … **UBR-11**)

Cada bloco **UBR-xx** mantém `**Status:** Draft` até cumprir **todos** os pontos aplicáveis:

1. **DoR** da story (secção **Dependências (DoR)**) cumprido ou **excepção** registada no PR com acordo explícito de `@po` (ou delegado).  
2. **Todos os AC** da story verificáveis no PR (checklist, comentário de revisão ou evidência **@qa** quando listado).  
3. **§Definition of Done — conjunto UBR** — itens aplicáveis ao PR satisfeitos.  
4. **Promoção de linha:** no merge que fecha a story, actualizar neste ficheiro `**Status:** Draft` → `**Status:** Ready` no bloco respectivo **ou** PR subsequente em `docs/` só com essa alteração + referência ao PR de implementação.

---

## Promoção de estado (**Draft** → **Ready for sprint** / **Go produção**)

| Estado | Critério |
| ------ | -------- |
| **Draft** | Conjunto em refinamento ou aguarda `*validate-story-draft` por `@po`. |
| **Ready for sprint** | `@po` validou AC/DoD do *slice* para **staging/homologação**; **UBR-01** merged ou excepção documentada; cofre **staging** para **UBR-05**+. **Não** exige **§Conformidade** LGPD completo se o *deploy* for **apenas** não-prod. |
| **Go produção** | Cumpre critérios de **Ready for sprint** **e** **§Conformidade** (DPIA / registo de tratamento ou excepção documentada `@po`/`@pm`) **e** decisão explícita de activar `CERT_UPLOAD_*` em **produção**. |

| Data | Estado | Nota |
| ---- | ------ | ---- |
| *(preencher)* | Ready for sprint | Validado `@po` (*staging*) |
| *(preencher)* | Go produção | Validado `@po` / `@pm` + gate **§Conformidade** |

---

## Conformidade e produto (**BR-NFR7**)

- **LGPD / DPIA:** não é entregável de código único; **@pm** + jurídico definem base legal, retenção e DPIA antes de **activar upload em produção**.  
- **Critério de gate:** até existir registo escrito (wiki/Confluence/ticket) com decisão **“DPIA não necessária”** ou **“DPIA concluída”**, o *release* produção do upload deve permanecer **desactivado** por feature flag ou aprovação formal `@po` em *exception*.

---

## Definition of Done — conjunto **UBR** (todas as stories aplicáveis)

1. **AC** verificáveis; **CodeRabbit** (ou equivalente) no PR; **CRITICAL** / **HIGH** tratados ou justificados com `@architect`.  
2. **Segurança:** sem PFX, senhas ou chaves em diff ou em `NEXT_PUBLIC_*`; apenas flags booleanas públicas conforme arquitectura §11 (**BR-NFR2**).  
3. **Logs:** sem thumbprint completo + CNPJ em **INFO** (**BR-NFR3** / **CE-NFR5**).  
4. **@qa:** onde indicado, evidência no PR (matriz de erros, permissões, *tenant isolation*).  
5. **FR48:** export JSON **sem** novos campos de segredo (**CE-BR8**); **UBR-11** cobre regressão explícita quando o incremento tocar rotas de export.  
6. **Conformidade:** gate **§Conformidade** satisfeito ou excepção `@po` antes de produção com upload activo.

---

## Backlog explícito — pós-MVP (*async* / **BR-NFR8**)

| ID | Nota |
| -- | ---- |
| **UBR-BL-01** | Pipeline opcional pós-upload antes de `active` (**BR-NFR8** — *malware scan*); criar story própria quando `@pm` aprovar custo/latência. |
| **UBR-BL-02** | Resposta **202 Accepted** + estado `pending_validation` + *polling* UI (spec UX §4.5) **se** o MVP **não** for síncrono (**UBR-05** AC5); inclui contrato de job/webhook e transição para `active`; depende de ADR. **Fora** do *scope* mínimo se AC5 *sync* for escolhido. |

---

## Índice

| ID | Título resumido | Tamanho | Dependências principais |
| -- | ----------------- | ------- | ------------------------ |
| **UBR-01** | ADR “browser → cofre → worker” + act. docs normativos | **S** | `@pm` + `@architect` (aprovação) |
| **UBR-02** | Provisionamento cofre + IAM + runbook staging | **M** | **UBR-01** |
| **UBR-03** | DDL metadados certificado + auditoria (sem bytes PFX) | **S** | **UBR-01**; `@data-engineer` opcional |
| **UBR-04** | Contrato API + `GET` + módulo validação PKCS12/CNPJ + erros `CERT_UPLOAD_*` | **M** | **UBR-03** |
| **UBR-05** | `POST` multipart + escrita cofre + rate limit + metadados BD + testes staging | **L** | **UBR-02**, **UBR-04** |
| **UBR-06** | API `DELETE` revogação + política rotação/versão cofre | **M** | **UBR-05** |
| **UBR-07** | UI: feature flags + organismo “Registo do certificado” | **M** | **UBR-04**, **UBR-05**; spec UX §3–§5 |
| **UBR-08** | UI: modais rotação/revogação + `error_code` → copy UX §6 | **M** | **UBR-06**, **UBR-07** |
| **UBR-09** | Worker: consumo cofre → materialização NFSE_dist | **L** | **UBR-02**, **UBR-05** |
| **UBR-10** | Observabilidade: métricas/logs PRD §7 | **S** | **UBR-05** (mínimo); **UBR-09** opcional |
| **UBR-11** | Regressão **FR48** — export JSON inalterado | **S** | **UBR-05** (ou mesmo PR que **UBR-07** se não tocar export) |

**Ordem sugerida:** **UBR-01** → **UBR-02** → **UBR-03** → **UBR-04** → **UBR-05** → **UBR-06** → (**UBR-07** ∥ **UBR-09** após **UBR-05**) → **UBR-08** → **UBR-10** → **UBR-11** (pode entrar no PR de **UBR-05**/**UBR-07** se export for tocado).

---

## Rastreio PRD / arquitectura / UX → UBR

| Story | CE-BR / BR-NFR / secções |
| ----- | ------------------------ |
| UBR-01 | PRD §10 dependências; arquitectura §14 |
| UBR-02 | BR-NFR2, BR-NFR7; arquitectura §6 |
| UBR-03 | CE-BR7; arquitectura §1 tabela metadados |
| UBR-04 | CE-BR2 (validação), CE-BR6 (auth no GET), BR-NFR1, BR-NFR3, BR-NFR5; arch §4–§5 (contrato + erros) |
| UBR-05 | CE-BR1, CE-BR2 (persistência), BR-NFR4, BR-NFR6; arch §4 POST + cofre; **AC5** decisão MVP síncrono **vs** **UBR-BL-02** (202 / `pending_validation`) |
| UBR-06 | CE-BR4, CE-BR5, CE-BR7; arch §6 |
| UBR-07 | CE-BR1, CE-BR6; UX §1–§5 |
| UBR-08 | CE-BR3, CE-BR4, CE-BR5; UX §4, §6, §7 |
| UBR-09 | CE-BR3, PRD épico 4; arch §7 |
| UBR-10 | PRD §7 métricas; arch §12 telemetria |
| UBR-11 | **CE-BR8**; FR48 |

---

## CodeRabbit / quality gate (conjunto)

- **executor:** `@dev` nas stories de código; **UBR-01** pode ser `@architect` + docs.  
- **Revisão:** `@architect` em **UBR-04**, **UBR-05**, **UBR-06**, **UBR-09** (segredos, IAM, isolamento, contrato).  
- **@qa:** **UBR-04**, **UBR-05**, **UBR-06**, **UBR-07**, **UBR-08** (matriz PRD §11 + spec UX §6); **UBR-09** smoke CE-FR7; **UBR-11** regressão export.  
- **@po:** copy final UX §6 antes de *release* copy-frozen; gate **§Conformidade** para produção.

---

## UBR-01 — Story: ADR e actualização de normas (NFR19 / CE-NFR1)

**Status:** Draft  
**Tamanho:** S  

**Dependências (DoR):** Nenhuma (documento).

**Referências:** PRD §8, §10.1; `docs/architecture-upload-certificado-browser-edicao-empresa-monitorada.md` §14.

**Executor Assignment**

- **executor:** `@architect` (+ `@pm` aprovação texto de consequências)  
- **quality_gate:** `@pm`

### Story

**Como** equipa de produto,  
**quero** um **ADR** aprovado que formalize “browser → cofre → worker” e a opção **A** ou **B** de upload,  
**para** desbloquear implementação sem conflito com **NFR19** / **CE-NFR1**.

### Acceptance Criteria

1. Ficheiro em **`docs/adr/`** (criar pasta no repositório se ainda não existir) com ADR: contexto, decisão (**A** vs **B**), consequências e data.  
2. `docs/prd-importacao-certificado-empresa-monitorada-adn.md` **ou** `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` referencia o ADR (actualização mínima conforme PRD §10).  
3. Diagrama C4 alvo reflectido (Mermaid do doc de arquitectura upload ou equivalente no ADR).

### Tasks / Subtasks

- [x] Redigir ADR; revisão `@architect`.  
- [ ] Merge ADR; link opcional na tabela **Promoção de estado** deste ficheiro.

---

## UBR-02 — Story: Provisionamento cofre + IAM + runbook staging

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **UBR-01** merged.

**Referências:** Arquitectura §6, §10; PRD épico 1 story 1.2.

**Executor Assignment**

- **executor:** `@dev` / DevOps com suporte `@architect`  
- **quality_gate:** `@architect`

### Story

**Como** DevOps,  
**quero** cofre (e KMS se aplicável) provisionado por ambiente com IAM mínimo,  
**para** que `@dev` possa integrar **UBR-05** em staging sem segredos em Git.

### Acceptance Criteria

1. Runbook mínimo em `docs/qa/` (ou path acordado) descreve variáveis, *roles* e teste manual “secret write/read” **sem** PFX real em repositório.  
2. Credenciais de runtime do portal documentadas como **OIDC** / role — não *access keys* em `.env` commitado.  
3. Prefixo de armazenamento `adn-cert/{orgId}/…` (ou equivalente ADR) aplicável.

### Tasks / Subtasks

- [ ] Terraform / console / *marketplace* — conforme stack da equipa.  
- [ ] Validar permissões negadas para prefixo de outra org (teste manual).

---

## UBR-03 — Story: DDL metadados + auditoria (sem PFX)

**Status:** Draft  
**Tamanho:** S  

**Dependências (DoR):** **UBR-01** merged; acordo de nomes de tabela com `@data-engineer`; **seed** ou *fixture* de teste com **pelo menos duas organizações** e empresas distintas para prova de RLS (documentar comando ou ficheiro de seed).

**Referências:** Arquitectura §1 tabela metadados; **CE-BR7**; **BR-NFR5**.

**Executor Assignment**

- **executor:** `@dev` (migração Drizzle/SQL conforme repo)  
- **quality_gate:** `@data-engineer` ou `@architect`

### Story

**Como** sistema,  
**quero** persistir **metadados** e **eventos de auditoria** do certificado sem coluna de PFX/senha,  
**para** suportar UI, rotação e rastreio (**CE-BR7**).

### Acceptance Criteria

1. Migração cria estrutura para: `organization_id`, `company_id`, estado (`pending_validation` \| `active` \| `revoked`), `not_after` (date), referência opaca ao cofre, `updated_at`, `updated_by_user_id` (ou equivalente).  
2. Tabela de auditoria: tipo de evento, actor, resultado, *timestamp*; **sem** colunas para senha ou *bytes* de certificado.  
3. RLS / políticas multi-tenant: isolamento **organizationId** + **companyId** (**BR-NFR5**).  
4. Teste automatizado **ou** script manual documentado no PR: utilizador/sessão org **A** não lê metadados de empresa da org **B**.

### Tasks / Subtasks

- [x] Migração + tipos Drizzle se aplicável.  
- [x] Seed mínimo duas orgs (DoR) + teste RLS (AC4).

---

## UBR-04 — Story: Contrato API + `GET` + validação PKCS12/CNPJ

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **UBR-03** merged; ADR (**UBR-01**) com campos de resposta acordados.

**Referências:** Arquitectura §4–§5; PRD **CE-BR2** (validação), **CE-BR6**; **BR-NFR3**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect` + `@qa` (unitários validação)

### Story

**Como** admin autenticado,  
**quero** um contrato estável e um `GET` de metadados, com validação de certificado testável sem cofre,  
**para** alinhar FE/BE antes da escrita segura (**UBR-05**).

### Acceptance Criteria

1. **Contrato partilhado:** schemas **Zod** (e/ou ficheiro **OpenAPI** YAML/JSON no repo em path único acordado — ex.: `packages/shared` ou `docs/api/`) cobrem `GET` response e erros `CERT_UPLOAD_*` + corpo de erro genérico.  
2. `GET .../certificate` implementado: metadados seguros para UI (**CE-BR3**); **403/404** conforme política de enumeração (arquitectura §3).  
3. Módulo **servidor** `validatePkcs12ForCompany(cnpjEmpresa, buffer, password)` (nome ilustrativo) valida PKCS#12, CNPJ e datas; testes **unitários** com fixture PKCS#12 de teste (sem segredo de produção).  
4. Mapa único `error_code` → `message` público (**BR-NFR3**); reutilizado por **UBR-05**/**UBR-08**.

### Tasks / Subtasks

- [x] Zod/OpenAPI + export para consumo em `apps/web`.  
- [x] Route Handler `GET` + testes.  
- [x] Módulo validação + testes unitários (fixture).

---

## UBR-05 — Story: `POST` multipart + cofre + rate limit + metadados

**Status:** Draft  
**Tamanho:** L  

**Dependências (DoR):** **UBR-02**, **UBR-04**; ADR opção **A** (multipart) **ou** contrato **B**; cofre *mock* ou sandbox em CI/staging.

**Referências:** Arquitectura §4 POST, §5, §10; **CE-BR1**, **CE-BR2**; **BR-NFR1**, **BR-NFR4**, **BR-NFR5**, **BR-NFR6**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect` + `@qa`

### Story

**Como** admin com permissão de mutação,  
**quero** enviar PKCS#12 via `POST` para o cofre após validação,  
**para** que o material fique disponível ao worker (**CE-BR1**, **CE-BR2**).

### Acceptance Criteria

1. `POST .../certificate` com `multipart/form-data` (`file`, `password`): reutiliza validador **UBR-04**; em sucesso escreve no cofre e actualiza metadados na BD.  
2. Rate limit + `CERT_UPLOAD_MAX_BYTES` (**BR-NFR6**); `CERT_UPLOAD_API_ENABLED=false` → **404** ou **403** nas rotas de upload/`GET` sensível conforme ADR.  
3. Testes de integração: senha errada, CNPJ mismatch, ficheiro grande, rate limit; cofre *mock* ou staging.  
4. Nenhuma alteração ao JSON de **export FR48** neste PR — se tocar em rotas de export, **UBR-11** deve entrar no mesmo PR com AC cumprido.  
5. **MVP síncrono vs async:** **uma** das opções deve estar fechada no PR (decisão `@po` registada em comentário ou ADR): **(A)** `POST` conclui com **200/201** (ou **204**) após cofre + metadados **sem** obrigar estado `pending_validation` **nem** **202**; **OU (B)** fluxo **202** + `pending_validation` + *polling* conforme spec UX §4.5, entregue como **UBR-BL-02** (não deixar (A) e (B) ambos indefinidos).

### Tasks / Subtasks

- [x] Handler `POST` + cliente cofre *scoped*.  
- [x] Actualização de linhas metadados + auditoria (*success*).  
- [x] Testes integração listados no AC3.

---

## UBR-06 — Story: API `DELETE` revogação + rotação (versão cofre)

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **UBR-05** merged.

**Referências:** **CE-BR4**, **CE-BR5**, **CE-BR7**; arquitectura §6.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**Como** admin,  
**quero** revogar o certificado registado e substituí-lo por um novo upload,  
**para** cumprir rotação e remoção seguras (**CE-BR4**, **CE-BR5**).

### Acceptance Criteria

1. `DELETE` remove ponteiro *current* / marca `revoked` e impede uso pelo worker após política acordada (**CE-BR5**).  
2. Novo `POST` após estado `active` cria nova versão no cofre e inactiva versão anterior (**CE-BR4**).  
3. Auditoria regista eventos de revogação e substituição **sem** segredos (**CE-BR7**).  
4. Idempotência: `DELETE` repetido → **204** sem **500**.

### Tasks / Subtasks

- [x] Implementar versioning conforme ADR.  
- [x] Testes @qa: revogação + novo upload.

---

## UBR-07 — Story: UI — feature flags + organismo “Registo do certificado”

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **UBR-04** (`GET` + contrato), **UBR-05** (`POST` funcional); `NEXT_PUBLIC_CERT_UPLOAD_UI_ENABLED` definido em build.

**Referências:** Spec UX §3, §5; **CE-BR1**, **CE-BR6**; arquitectura §11.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` (a11y básica + flag off)

### Story

**Como** admin,  
**quero** ver o formulário de registo na secção Sincronização ADN quando a funcionalidade estiver activa,  
**para** enviar o certificado sem usar `localStorage` (**BR-NFR1**).

### Acceptance Criteria

1. Com `NEXT_PUBLIC_CERT_UPLOAD_UI_ENABLED` **false**, UI **idêntica** ao comportamento anterior (sem inputs de segredo) — regressão **CE-NFR1**.  
2. Com flag **true** e permissão de mutação: `fieldset` + ficheiro + senha + **Enviar** / **Limpar** conforme spec UX §5.2; tipos/respostas alinhados ao contrato **UBR-04**.  
3. Sem persistência de PFX/senha em `localStorage` / `sessionStorage` / URL.  
4. Integração visual no painel existente (`AdnCertificateReadinessCard` ou composição spec §3.1).

### Tasks / Subtasks

- [x] `FormData` + `fetch` para `POST`.  
- [x] Estados `idle` / `uploading` com `aria-busy` (spec §5.3).

---

## UBR-08 — Story: UI — modais rotação/revogação + mapeamento de erros

**Status:** Draft  
**Tamanho:** M  

**Dependências (DoR):** **UBR-06**, **UBR-07**.

**Referências:** Spec UX §4.2–§4.3, §6, §7; **CE-BR3**, **CE-BR4**, **CE-BR5**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` + `@po` (copy)

### Story

**Como** admin,  
**quero** confirmar substituição e revogação em modais e ver mensagens claras de erro,  
**para** evitar acções irreversíveis por engano e entender falhas (**CE-BR4**, **CE-BR5**).

### Acceptance Criteria

1. Fluxo **Substituir** e **Revogar** conforme spec UX §4.2–§4.3 (checkbox na revogação).  
2. Tabela `error_code` → copy **exacta** spec UX §6; importa mesma fonte de verdade que API (**UBR-04**).  
3. **Não** exibir thumbprint completo nem PFX (**CE-BR3**).  
4. WCAG: foco inicial **Cancelar** nos modais de risco; `aria-describedby` em erros (spec §7).

### Tasks / Subtasks

- [ ] Módulo partilhado `error_code` → string (FE).  
- [ ] Testes e2e leves ou manuais documentados no PR.

---

## UBR-09 — Story: Worker — consumo cofre → materialização NFSE_dist

**Status:** Draft  
**Tamanho:** L  

**Dependências (DoR):** **UBR-02**, **UBR-05**; VM com credencial cofre.

**Referências:** Arquitectura §7; PRD épico 4; briefing NFSE_dist.

**Executor Assignment**

- **executor:** `@dev` (worker / *wrapper*)  
- **quality_gate:** `@architect` + `@qa` smoke

### Story

**Como** operador de recolha,  
**quero** que o worker obtenha o PFX do cofre e o disponibilize ao NFSE_dist,  
**para** que a sincronização ADN funcione com material originado no portal (**CE-BR3**).

### Acceptance Criteria

1. Job ou serviço documentado puxa segredo por `(organizationId, companyId)` / CNPJ e materializa path compatível com **NFSE_dist** (ADR).  
2. ACL mínima no disco (**CE-NFR3** espelhado).  
3. Smoke **CE-FR7** com nota “origem cofre” em `docs/qa/` ou runbook worker.  
4. Falha de cofre não derruba portal; erro categorizado.

### Tasks / Subtasks

- [ ] Script/job + documentação operacional.  
- [ ] Logs sem segredos (**BR-NFR3**).

---

## UBR-10 — Story: Observabilidade — métricas e logs estruturados

**Status:** Draft  
**Tamanho:** S  

**Dependências (DoR):** **UBR-05** merged.

**Referências:** PRD §7; arquitectura §12; spec UX §9 (opcional).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@pm` (nomes de métricas)

### Story

**Como** PM,  
**quero** eventos agregáveis de upload (sucesso/falha/código) sem PII excessiva,  
**para** medir taxa de falha e tempo até ADN OK (**PRD §7**).

### Acceptance Criteria

1. Eventos ou logs: `cert_upload_succeeded` / `failed` com `error_code` — **sem** CNPJ+thumbprint em **INFO**.  
2. Opcional: dashboard ou query exemplo documentada no PR se código de dashboard for *out of scope*.

### Tasks / Subtasks

- [ ] Instrumentar rotas **POST**/**DELETE**.  
- [ ] Validar amostra de log em staging (redacção).

---

## UBR-11 — Story: Regressão **FR48** — export JSON sem segredos

**Status:** Draft  
**Tamanho:** S  

**Dependências (DoR):** **UBR-05** merged (ou PR conjunto que toque export); rota(s) de export identificadas no repo.

**Referências:** **CE-BR8**; PRD §1.1 item 5; `docs/prd-integracao-nfse-dist-adn.md` **FR48**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa`

### Story

**Como** responsável de produto,  
**quero** garantir que o export de lista para automação **não** passa a incluir dados de certificado,  
**para** cumprir **FR48** e **CE-BR8** após o incremento de upload.

### Acceptance Criteria

1. Resposta JSON do export **FR48** (rota(s) existentes) **não** contém campos novos: PFX, senha, thumbprint, `vault_ref`, nem conteúdo base64 de certificado.  
2. Teste automatizado **ou** checklist manual no PR com *payload* exemplo antes/depois (redigido).  
3. Se o incremento **não** alterar ficheiros de export, PR com **justificativa** “N/A — rotas não tocadas” + link para *grep* ou lista de ficheiros revistos — aceite com aprovação `@po`.

### Tasks / Subtasks

- [x] Auditar handlers de export; adicionar teste de regressão se aplicável.  
- [x] Evidência no PR (AC2 ou AC3).

---

## Change log deste ficheiro de stories

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 0.1    | Conjunto inicial UBR-01…UBR-09. |
| 2026-04-24 | 0.2    | Refinamento @po: UBR-04/05 *split*, UBR-06…11 renumeração, UBR-11 CE-BR8, backlog BR-NFR8, LGPD, contrato API, DoR RLS, gates e índice actualizados. |
| 2026-04-24 | 0.3    | Refinamento @po (nota 9/10): pré-requisitos por *slice*; **Ready for sprint** vs **Go produção**; **UBR-05** AC5 MVP síncrono vs **UBR-BL-02** async; backlog renomeado. |
| 2026-04-24 | 0.4    | Refinamento @po (nota 9,5/10): tabela **v0.2** *histórico* + nota **BR-NFR7**; **§Rastreio** UBR-05 + **AC5**. |
| 2026-04-24 | 0.4.1  | Implementação MVP código: DDL `company_certificates`, API GET/POST/DELETE, cofre `mock`, UI com flags; ADR `docs/adr/0001-upload-certificado-browser-para-cofre.md`. |
| 2026-04-24 | 0.4.2  | Pós-QA: RLS `anon`/`authenticated`; código `CERT_UPLOAD_EXPECT_MULTIPART` (415); *rate limit* após validação PKCS12; compensação cofre se falha BD; CNPJ via SAN; testes integração (multipart, senha, CNPJ, 413, 429, POST/DELETE) + regressão FR48 export. |

---

— **River (SM / AIOS)** — conjunto **0.4**; **nenhum** código alterado por este agente.

## QA Results

**Data da revisão:** 2026-04-24  
**Revisor:** Quinn (QA / AIOS)  
**Âmbito:** implementação MVP em código (DDL, API `…/certificate`, cofre `mock`, UI com flags, ADR) face aos blocos **UBR-01**, **UBR-03**, **UBR-04**, **UBR-05**, **UBR-06**, **UBR-07** deste índice.

### Decisão de *gate* (advisory)

| Gate | **CONCERNS** |
| ---- | ------------- |
| Síntese | Boa aderência ao fluxo **multipart síncrono** (POST **204**), defesa em profundidade com `CERT_UPLOAD_API_ENABLED`, UI condicionada a `NEXT_PUBLIC_CERT_UPLOAD_UI_ENABLED`, metadados sem PFX na BD e mensagens de erro públicas centralizadas em `@repo/shared`. Não se atribui **PASS** até fechar lacunas de **BR-NFR5** (RLS) e testes de integração previstos em **UBR-05 AC3**, ou até excepção escrita acordada com `@architect` / `@po`. |

### Rastreio rápido (subset UBR)

| Referência | Veredicto | Notas |
| ---------- | ----------- | ----- |
| **UBR-03 AC4** (RLS / tenant) | **Em falta** | DDL sem políticas RLS; sem teste automatizado “org A não lê empresa org B” neste incremento. |
| **UBR-03** DoR *seed* duas orgs | **Em falta** | Migração + Drizzle existem; DoR de *seed* para prova RLS não satisfeito só com o entregue. |
| **UBR-04** (contrato, GET, validação) | **Atendido (MVP)** | Schemas Zod partilhados; `GET` + `validatePkcs12ForCompany` + testes unitários com PKCS#12 gerado. |
| **UBR-05 AC2** (*rate limit*, tamanho, flag API) | **Atendido (MVP)** | `CERT_UPLOAD_MAX_BYTES`, rate limit em memória (limitação multi-instância já conhecida no padrão ADN). |
| **UBR-05 AC3** (integração) | **Parcial** | `adn-api.integration.test.ts` cobre sobretudo GET com API on/off; falta a matriz listada no AC (senha, CNPJ, 413, 429, cofre) com `DATABASE_URL`. |
| **UBR-05 AC5** (síncrono *vs* async) | **Atendido** | ADR + comportamento síncrono coerentes com opção (A). |
| **UBR-06** (DELETE, idempotência) | **Atendido (MVP)** | **204** idempotente; sem bateria de testes dedicada. |
| **UBR-07 AC1** (UI com flag *off*) | **Atendido** | Sem flag pública activa o formulário não monta; regressão **CE-NFR1** preservada na superfície analisada. |
| **UBR-08** (modais substituir/revogar) | **Fora do *scope* deste entregue** | Previsto como story seguinte; **DELETE** existe na API mas sem UI de confirmação especificada na UX §4.2–4.3. |
| **UBR-02** (cofre real / IAM) | **Em falta** | Apenas driver `mock` em processo — correcto para dev; bloqueador para **Go produção**. |
| **UBR-11** (FR48 export) | **Não evidenciado nesta revisão** | Recomendação: no PR trazer *grep* / lista de ficheiros ou teste de regressão conforme AC3 **N/A** vs testável. |

### Riscos e recomendações (por prioridade)

1. **Alta — Isolamento multi-tenant (BR-NFR5):** sem RLS nas novas tabelas, o risco desloca-se para “nunca falhar na camada app”. Prioridade: políticas Supabase/Postgres + teste de isolamento **ou** excepção documentada `@architect`.
2. **Média — Consistência cofre ↔ BD:** se a escrita Drizzle falhar após `writeCertificateToVault`, pode ficar *blob* no mock sem metadados; avaliar ordem transacional / compensação em evolução.
3. **Média — CNPJ em certificados reais:** validação baseada em `\d{14}` no *subject* pode ser insuficiente para SAN/OIDs ICP-Brasil; reforçar com regras e *fixtures* de homologação antes de produção.
4. **Média — *Rate limit* antes da validação criptográfica:** consome quota com payloads inválidos; pode ser desejável para anti-abuso; documentar trade-off.
5. **Baixa — Alinhamento *copy* / HTTP:** `Content-Type` incorrecto mapeado para `CERT_UPLOAD_INVALID_FILE` (“Use .pfx…”) — considerar mensagem ou código mais específico.

### NFR (amostra)

- **BR-NFR1 / BR-NFR4:** não foi detectada persistência de PFX/senha em `localStorage` / URL no componente de registo revisto; senha limpa após sucesso.
- **BR-NFR3:** uso do mapa público de erros; log `cert_upload.succeeded` sem thumbprint nem CNPJ em claro — alinhado ao espírito do DoD citado.

### Próximos passos sugeridos (@dev / PR)

1. Fechar **UBR-03 AC4** (RLS + teste ou excepção formal).  
2. Completar **UBR-05 AC3** com `DATABASE_URL` em CI/staging.  
3. Ligar UI a **DELETE** / fluxos **UBR-08** quando a *story* for puxada.  
4. Anexar evidência **UBR-11** ao PR.

---

**Parecer final:** **CONCERNS** — código utilizável em *staging* com flags e migração aplicada; **não** recomendado como “pronto para *gate* produção” sem RLS/cofre real e sem fechar testes de integração do *slice* **UBR-05**.

— **Quinn (QA / AIOS)**, 2026-04-24
