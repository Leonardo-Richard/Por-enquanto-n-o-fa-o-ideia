# User stories — Incremento: integração ADN (NFS-e / worker + portal)

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** `docs/prd-integracao-nfse-dist-adn.md`, `docs/front-end-spec-integracao-nfse-dist-adn.md`, `docs/architecture-integracao-nfse-dist-adn.md`, `docs/briefing-integracao-nfse-dist-adn.md`  
**Pré-requisito:** modelo **organização + empresas monitoradas** operacional (`docs/stories/incremento-dois-niveis-organizacao-vs-empresas-fiscais.md` mínimo até **ORG-05** + **ORG-03**); rotas `GET/POST .../organizations/:orgId/monitored-companies/...` e sessão com **organização activa**.  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-22  
**Versão do conjunto:** **0.3.2** — v0.3.1 + fecho PO (nota 9/10): HMAC **só** sobre corpo raw UTF-8; `retry-bulk` com **50** ids máximo fixo no MVP; glossário mínimo de colunas.  
**Estado do conjunto:** **Draft** — gate PO (`*validate-story-draft`): critérios v0.3.2 fechados pelo SM; assinatura formal `@po` opcional.

---

## Índice

| ID | Título resumido | Dependências principais |
| -- | ----------------- | ------------------------ |
| **ADN-01** | DDL + Drizzle: flag org, `adn_sync_jobs`, `adn_artifacts`, `adn_ingestion_failures` | `organizations`, `companies` com `organization_id` |
| **ADN-02** | Storage: bucket privado, convenção de paths, helpers servidor (sign upload/download) | **ADN-01**; projeto Supabase com Storage activo |
| **ADN-03** | API interna worker: HMAC (`NFR20`), `uploads:prepare`, `artifacts:commit`, `PATCH jobs/:id` | **ADN-01**, **ADN-02** |
| **ADN-04** | API pública v1: sync, artifacts, download, failures, retry, mapa `error_code` → UI | **ADN-01**, **ADN-02**, **ADN-03** (para commits reais em e2e) ou mock interno até ADN-03 pronto |
| **ADN-05** | Auditoria: eventos `adn_*` com `actor_user_id`, org, company, job (**FR47**) | **ADN-04** (pontos de emissão) |
| **ADN-06** | Export `GET .../adn/automation-export.json` (**FR48**) | **ADN-04** |
| **ADN-07** | UI: bloco Sincronização ADN, tabelas, polling, modais, flag off (**FR45**, spec UX) | **ADN-04** |
| **ADN-08** | Testes integração (ACL, 404 flag, idempotência, download) + notas runbook worker | **ADN-03**, **ADN-04**, **ADN-07** mínimo |

**Ordem sugerida:** ADN-01 → ADN-02 → ADN-03 → **ADN-04** → ADN-05 → ADN-06 → ADN-07 → ADN-08.

**Paralelização:** **ADN-05** e **ADN-06** podem ser o mesmo PR que **ADN-04** se a equipa preferir fatiar menos; **ADN-07** pode iniciar com mocks contractuais apenas após contrato **ADN-04** estável (OpenAPI ou exemplos JSON).

**Fatia opcional de PR:** se **ADN-04** ficar demasiado grande, dividir em **ADN-04a** (sync + jobs + `GET sync`) e **ADN-04b** (artifacts + download + failures + retry) — mesma política HTTP abaixo para ambos.

---

## Política HTTP vinculativa (MVP — fechamento PO)

Todas as rotas `.../adn/...` **públicas** (sessão utilizador) e testes **ADN-08** devem obedecer à tabela seguinte (sem “403 ou 404 conforme projeto”).

| Situação | HTTP | Corpo | Notas |
| -------- | ---- | ----- | ----- |
| `organizations.adn_sync_enabled=false` para `:organizationId` | **404** | Mensagem neutra genérica | **FR45** / spec UX: não revelar existência da feature por tenant. |
| Sessão válida mas utilizador **sem** membership em `:organizationId` | **403** | Sem dados de recurso | Não permitir sondar orgs alheias (**NFR18**). |
| `companyId` inexistente **ou** `companies.organization_id ≠ :organizationId` | **404** | Mensagem neutra | Não distinguir “CNPJ não existe” vs “CNPJ noutra org” na API pública. |
| Membro com `org_role=user` chama `POST .../sync`, `POST .../retry*`, ou `GET .../automation-export` | **403** | Opcional `error_code` estável | Mutações e export apenas **admin** org. |
| Membro com `org_role=admin` (ou superadmin em vista plataforma **com** as mesmas capacidades de leitura já definidas no incremento ORG) — leitura | **200** | — | `GET sync`, `GET artifacts`, `GET failures`, `GET .../download` (URL assinada). |
| **Superadmin:** leitura (`GET`) | **200** | — | Apenas quando o fluxo “vista plataforma / aceder à organização” **já** autoriza ver essa empresa monitorada (reutilizar guards ORG). |
| **Superadmin:** `POST sync`, `POST retry`, `automation-export` | **403** no MVP | — | **Não contornar** ACL fiscal sem épico explícito; alinhar a PRD “sem papel admin na org”. |

### Rotas internas (`/api/internal/v1/adn/*`) — **vinculativo MVP**

| Situação | HTTP | Notas |
| -------- | ---- | ----- |
| HMAC inválido, ausente ou *skew* > 5 min | **401** | Igual **ADN-03**. |
| Org com `adn_sync_enabled=false` | **403** | Recusa de ingestão (máquina autenticada mas org não elegível). **Não** usar **404** nas rotas internas no MVP. |
| `company_id` inválido ou não pertence à `organizationId` do corpo | **403** | Mesmo raciocínio: recusa sem ambiguidade. |
| Payload semântico inválido (ex.: `access_key` com tamanho ≠ 44, tipos errados) | **400** | Erro de cliente; `error_code` estável (sem stack). |

---

## Rastreio PRD / NFR → ADN

| ID | FR / NFR principais |
| -- | ------------------- |
| ADN-01 | FR41 (persistência jobs), FR43 (artefactos), FR45 (coluna flag), base FR46 |
| ADN-02 | FR44 (bytes seguros), NFR19, NFR23 |
| ADN-03 | FR41 (ciclo de vida job via worker), NFR20, NFR21 (rate limit interno), NFR22 (contadores opcionais) |
| ADN-04 | FR41–FR44, FR45 (404), FR46, NFR21 (429 mapeado), NFR19 |
| ADN-05 | FR47 |
| ADN-06 | FR48 |
| ADN-07 | FR41–FR46 (UI), FR45, NFR13 (spec UX), a11y |
| ADN-08 | Critérios globais PRD §10, NFR18 (isolamento) |

---

## Glossário mínimo de colunas (MVP — reduzir ida/volta à arquitectura)

Valores exactos de tipos/constraints completos continuam em `docs/architecture-integracao-nfse-dist-adn.md` §3; aqui só o **mínimo** para implementação sem abrir o PDF mental para cada AC.

### `organizations`

| Coluna | Nota MVP |
| ------ | -------- |
| `adn_sync_enabled` | `BOOLEAN NOT NULL DEFAULT false` — **FR45**; UI/API públicas **404** quando `false`. |

### `adn_sync_jobs`

| Coluna | Nota MVP |
| ------ | -------- |
| `organization_id`, `company_id` | FKs; invariante: `companies.organization_id` da linha de `company_id` = `organization_id` do job. |
| `status` | Ciclo de vida job (ex.: `queued`, `running`, `succeeded`, `failed`, … — enum alinhado a Drizzle). |
| `trigger` | Origem: `manual`, `scheduled`, `retry`, … |
| `requested_by_user_id` | Quem disparou (nullable se *scheduled*). |
| `idempotency_key` | Cabeçalho normalizado ou hash; nullable se só *scheduled*. |
| `summary_json` | Resumo para badge/UI (**FR41–FR42**). |
| `created_at`, `updated_at` | Auditoria temporal. |

### `adn_artifacts`

| Coluna | Nota MVP |
| ------ | -------- |
| `company_id`, `access_key`, `kind` | **UNIQUE** composto; `access_key` 44 caracteres. |
| `storage_bucket`, `storage_object_key` | **Nunca** expostos na API pública de listagem. |
| `content_sha256`, `issued_at` | Integridade + ordenação fiscal. |

### `adn_ingestion_failures`

| Coluna | Nota MVP |
| ------ | -------- |
| `error_code` | Estável; mapeamento §7 arquitectura → `userMessage` pt. |
| `can_retry` | Alimenta UI de reprocessamento (**FR46**). |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit em PR; `@architect` em **ADN-01**, **ADN-03**, **ADN-04** (segurança, HMAC, ausência de segredos no cliente).  
- **Foco:** nenhuma rota expõe `storage_object_key` ou chave de acesso completa sem ACL; requests internas sem HMAC válido → **401**; corpo de erro público sem stack trace (**NFR19**).

---

## Definition of Done (macro)

- Migrações `db/migrations/` com rollback ou nota explícita de irreversibilidade + backup.  
- Variáveis novas documentadas em `.env.example` (**servidor apenas**; nunca `NEXT_PUBLIC_*` para segredos ADN).  
- Testes de integração **ADN-08** verdes em CI antes de marcar incremento “done”.  
- Evidência de smoke: org com `adn_sync_enabled=true` em staging → job + artefacto + download na UI (pode usar worker manual ou script interno).

### Definition of Done (por fatia)

| ID | DoD mínimo |
| -- | ----------- |
| **ADN-01** | Migração aplicável em staging; schema Drizzle alinhado; `adn_sync_enabled` default `false`. |
| **ADN-02** | Upload/download assinado testado manualmente ou teste integração contra Storage de projeto de teste. |
| **ADN-03** | cURL de exemplo no PR ou `docs/qa/` com HMAC **raw body UTF-8** conforme AC2 (sem secret real). |
| **ADN-04** | OpenAPI em `docs/api/` (rotas públicas ADN); comportamentos HTTP conforme secção **Política HTTP vinculativa**; TTL download documentado. |
| **ADN-05** | Pelo menos um teste que asserta presença de `organization_id` + `company_id` no evento. |
| **ADN-06** | Export sem campos sensíveis; validação de conteúdo em teste. |
| **ADN-07** | Checklist WCAG mínima do spec UX §7 referenciada no PR. |
| **ADN-08** | CI verde; runbook worker 1 página em `docs/qa/` ou `README` worker. |

---

## PO — Fora de âmbito (reafirmação)

Conforme PRD incremento §4: escolha de cloud da VM Windows, reimplementação ADN em Node, integração ERP terceiro, definição legal final LGPD.

**PDF em massa (fase 1b):** fora do MVP deste conjunto; apenas hooks de `kind=pdf` e colunas se já forem criadas em **ADN-01** — UI “Em breve” conforme spec UX §10.

---

## Registo de aprovação PO

| Data | Versão | Decisão | Assinatura |
| ---- | ------ | -------- | ---------- |
| 2026-04-22 | 0.2 | Refino SM pós-feedback PO: política 403/404, superadmin, HMAC, TTL, testes expiração, activação flag staging | @sm |
| 2026-04-22 | 0.3 | Micro-ajustes PO (rotas internas só 401/403/400; idempotência `POST sync` com corpo canónico; **202** no enqueue) | @sm |
| 2026-04-22 | 0.3.1 | Fecho SM: payload interno inválido **400**; `POST sync` strict (datas `YYYY-MM-DD`, chaves extra → **400**); ADN-03 ↔ tabela rotas internas | @sm |
| 2026-04-22 | 0.3.2 | Fecho SM pós-feedback PO: HMAC só *raw body* UTF-8; `retry-bulk` máx. **50** fixo + **400** se exceder; glossário mínimo colunas | @sm |
| _opcional_ | 0.3.2 | Gate `*validate-story-draft` — conjunto **aprovado para sprint** (nota PO 9/10 v0.2; v0.3.2 fecha frestas HMAC + bulk + glossário) | @po |

---

## ADN-01 — Story: schema Postgres + Drizzle (flag, jobs, artefactos, falhas)

**Status:** Draft  

**Dependências (DoR):** Tabelas `organizations` e `companies` com FK `companies.organization_id` conforme incremento ORG.

**Referências:** Arquitetura §3.1–3.4; PRD **FR41**, **FR43**, **FR45**, **FR46**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@data-engineer` + `@architect`

### Story

**As a** sistema,  
**I want** persistir jobs ADN, metadados de artefactos e falhas de ingestão com isolamento por organização e empresa monitorada,  
**so that** o portal e o worker possam operar de forma idempotente e auditável.

### Acceptance Criteria

1. Coluna `organizations.adn_sync_enabled BOOLEAN NOT NULL DEFAULT false` (ou alternativa aprovada na arquitetura §3.1).  
2. Tabela `adn_sync_jobs` com colunas mínimas da arquitetura §3.2 (`organization_id`, `company_id`, `status`, `trigger`, `requested_by_user_id`, `idempotency_key`, timestamps, `summary_json`, contadores 429/503 opcionais).  
3. Tabela `adn_artifacts` com `UNIQUE (company_id, access_key, kind)` e campos de Storage (`storage_bucket`, `storage_object_key`, `content_sha256`, `issued_at`, …) conforme §3.3.  
4. Tabela `adn_ingestion_failures` conforme §3.4 (`error_code`, `can_retry`, …).  
5. FKs: `company_id` → `companies.id`, `organization_id` → `organizations.id`; invariante documentado: `company.organization_id` = linha job.  
6. Migração versionada em `db/migrations/` + actualização `packages/db` (schema Drizzle) + tipos partilhados se aplicável em `@repo/shared`.  
7. **Activar ADN em staging (MVP sem UI de produto):** documentar em `docs/qa/adn-staging-setup.md` (ou equivalente) **um** dos métodos: (a) `UPDATE organizations SET adn_sync_enabled = true WHERE id = …` com checklist de segurança; **ou** (b) seed SQL idempotente para org de teste. **UI Superadmin** para togglear a flag fica **backlog** explícito (não bloqueia ADN-07 se staging já tiver flag).

### Tasks / Subtasks

- [ ] Migração SQL  
- [ ] Schema Drizzle + tipos  
- [ ] Rollback ou nota de irreversibilidade  
- [ ] Doc `docs/qa/` para activar flag em staging  

### Dev Notes

- Não logar `access_key` completa em middlewares globais (NFR19).

---

## ADN-02 — Story: Supabase Storage — bucket, paths e assinaturas no servidor

**Status:** Draft  

**Dependências (DoR):** **ADN-01** merged.

**Referências:** Arquitetura §4; PRD **FR44**, **NFR23**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** portal,  
**I want** armazenar bytes XML em bucket privado com path canónico por org/empresa,  
**so that** downloads passem sempre por URLs assinadas de curta duração.

### Acceptance Criteria

1. Bucket privado criado (nome configurável via env, ex.: `ADN_STORAGE_BUCKET`) — **sem** política pública de leitura.  
2. Path canónico: `org/{organization_id}/company/{company_id}/{access_key}/{kind}.{ext}` (ou equivalente documentado).  
3. Funções servidor (ex.: `lib/adn-storage.ts`) que expõem: **createPresignedPut** (upload worker) e **createPresignedGet** (download utilizador), usando credencial **servidor** apenas.  
4. `.env.example` documenta variáveis necessárias (sem valores reais); **nenhum** segredo em `NEXT_PUBLIC_*`.  
5. **TTL assinado (vinculativo):** constantes por env com defaults: `ADN_DOWNLOAD_URL_TTL_SECONDS` **90** (alterações **60–120** s devem ser justificadas no PR); URL **PUT** presigned para upload do worker com TTL **≤ 15 min** (valor exacto no doc de QA). A resposta de `GET .../download` (API pública, **ADN-04**) deve usar o mesmo TTL de leitura — este AC garante que os helpers de **ADN-02** suportam ambos os casos.  
6. Teste mínimo: mock ou integração contra Storage de staging (decisão `@qa` / `@architect`).

### Dev Notes

- Se o projecto ainda não usa `@supabase/supabase-js` no servidor, usar API REST Storage com **service role** só em runtime servidor (alinhar `architecture-supabase-fe-be.md`).

---

## ADN-03 — Story: API interna `/api/internal/v1/adn/*` (worker, HMAC)

**Status:** Draft  

**Dependências (DoR):** **ADN-01**, **ADN-02**; secret `ADN_WORKER_HMAC_SECRET` disponível em ambiente de staging.

**Referências:** Arquitetura §5.3, §6 (rate limit); PRD **NFR20**, **NFR21**, **NFR22**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** worker Windows,  
**I want** autenticar-me ao portal e registar artefactos após upload ao Storage,  
**so that** apenas processos autorizados ingiram dados fiscais.

### Acceptance Criteria

1. Rotas internas conforme arquitetura: `uploads:prepare`, `artifacts:commit`, `PATCH .../jobs/:jobId` (nomes exactos podem seguir convenção `:action` do projeto).  
2. Validação **HMAC** do pedido (**MVP vinculativo**, alinhado à arquitectura §5.3 — sem *canonical string* alternativa): cabeçalhos obrigatórios `X-ADN-Timestamp` + `X-ADN-Signature`. O servidor deve ler o corpo **raw** (bytes UTF-8 exactamente como recebidos, **antes** de `JSON.parse` / re-serialização). `X-ADN-Timestamp` = segundos Unix UTC em string decimal. `X-ADN-Signature` = **hex minúsculo** de `HMAC-SHA256( key = ADN_WORKER_HMAC_SECRET, message = rawBody )`. Comparar assinatura em tempo constante. *Skew* de relógio > **5 min** → **401**; HMAC inválido ou cabeçalhos ausentes → **401**. O exemplo em `docs/qa/` ou PR deve reproduzir **exactamente** esta fórmula (cURL + Node). *Canonical string* (method+path+hash) fica **fora do MVP** — épico futuro se necessário.  
3. `uploads:prepare` valida: org com `adn_sync_enabled=true`, `company_id` pertence à org, `access_key` formato 44, `sha256` presente; resposta inclui `artifactDraftId`, URL PUT, campos de expiração.  
4. `artifacts:commit` fecha registo em `adn_artifacts`, idempotente com **ADN-01** constraint; actualiza job (`summary_json`, `status`).  
5. Rate limiting básico por IP / org no namespace interno (NFR21).  
6. Runtime **nodejs** (não edge) para handlers que usem crypto estável e timeouts maiores se necessário.

### Tasks / Subtasks

- [ ] Middleware HMAC reutilizável  
- [ ] Handlers + Zod (ou validador existente)  
- [ ] Exemplo cURL/HMAC na documentação interna  

### Dev Notes

- Alternativa mTLS: documentar como épico futuro; MVP = HMAC.  
- Códigos HTTP de recusa alinhados à subsecção **Rotas internas** em **Política HTTP vinculativa**: **403** para flag off / company inválido; **401** para HMAC; **400** para payload semântico inválido.  
- Ordem de middleware: bufferizar corpo raw → verificar HMAC → só depois `JSON.parse` para handlers (evita divergência de espaços/chaves JSON).

---

## ADN-04 — Story: API pública v1 — sync, artefactos, download, falhas, retry

**Status:** Draft  

**Dependências (DoR):** **ADN-01**, **ADN-02**; **ADN-03** para e2e real ou fixture de commit em teste.

**Referências:** Arquitetura §5.2, §7; PRD **FR41–FR46**; spec UX fluxos 4.1–4.4.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** utilizador autenticado,  
**I want** consultar estado de sincronização, listar notas, descarregar XML e reprocessar falhas dentro da minha organização,  
**so that** cumpra o fluxo fiscal sem aceder ao ADN directamente.

### Acceptance Criteria

1. Rotas sob `.../organizations/:organizationId/monitored-companies/:companyId/adn/...` alinhadas à arquitetura §5.2 (`GET/POST sync`, `GET artifacts` com paginação + filtros `issuedFrom`/`issuedTo`, `GET .../artifacts/:id/download`, `GET failures`, `POST failures/:id/retry`, `POST failures:retry-bulk`). Corpo `{ "failureIds": string[] }` (UUID v4). **Máximo 50** elementos por pedido no MVP (**fixo** — sem override por env). Se `failureIds.length > 50`, array vazio, duplicados óbvios de validação, ou UUID inválido → **400** com `error_code` estável (ex.: `ADN_INVALID_BULK_RETRY`).  
2. **Comportamentos HTTP:** obrigatório cumprir a secção **Política HTTP vinculativa** deste documento (inclui **FR45** → **404** quando flag off; **403** membership; **404** company/org mismatch).  
3. **Superadmin:** conforme linhas da tabela política — leitura `GET` alinhada ao incremento ORG; **sem** `POST sync` / retry / export sem ser **admin** da organização alvo no MVP.  
4. Resposta de listagem **sem** `storage_object_key`; chave de acesso mascarada conforme spec UX.  
5. **`GET .../artifacts/:id/download`:** resposta **JSON** `200` com `{ "downloadUrl", "expiresAt" }` (**única** política MVP — sem 302 para simplificar cliente e testes). `expiresAt` = ISO8601; TTL = env `ADN_DOWNLOAD_URL_TTL_SECONDS` (default **90**). Se artefacto inexistente ou sem ACL → **404**.  
6. Mapa `error_code` → `userMessage` pt (arquitetura §7); nunca devolver stack ou `error_detail` interno ao cliente browser.  
7. `POST .../sync` — sucesso de enfileiramento (**job criado ou reutilizado**): resposta **202** `Accepted` com corpo JSON contendo pelo menos `{ "job": { "id": "…", "status": "…" } }` (campos adicionais permitidos). **Não** usar **200** neste endpoint no MVP (semântica “enqueue”, alinhado a feedback PO).  
8. **Idempotência (`Idempotency-Key`):** se o cabeçalho se repetir dentro de **24 h** e o **corpo canónico** for byte-a-byte igual após normalização servidor (ver **Dev Notes** abaixo), devolver **202** com o **mesmo** `job.id`. **Não** usar **409** para chave duplicada neste MVP.  
9. Resposta `429` da API pública inclui `Retry-After` segundos quando aplicável (**NFR21**) e `error_code` estável (ex.: `ADN_RATE_LIMIT`).

### Tasks / Subtasks

- [ ] Handlers + authz helpers  
- [ ] OpenAPI parcial em `docs/api/` (**obrigatório** para rotas públicas ADN no MVP deste incremento)  

### Dev Notes

- **Corpo canónico para `Idempotency-Key`:** após `JSON.parse`, considerar **apenas** as chaves opcionais `issuedFrom` e `issuedTo` (strings **`YYYY-MM-DD`** em calendário civil; sem hora). Qualquer outra chave no corpo de `POST .../sync` → **400** (*strict* no MVP). Corpo vazio ou `{}` equivale a “sem janela explícita”. Comparar com objecto normalizado (chaves ordenadas, `trim` nos valores) antes de *fingerprint* / *hash* de idempotência.  
- Polling: cabeçalhos `Cache-Control: no-store` ou `max-age` curto (ex.: **0–15 s**) em `GET sync` para coerência com UI.

---

## ADN-05 — Story: auditoria — eventos ADN (**FR47**)

**Status:** Draft  

**Dependências (DoR):** **ADN-04** (pontos de emissão definidos).

**Referências:** Arquitetura §8; PRD **FR47**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** responsável de compliance,  
**I want** eventos append-only para pedidos de sync, conclusões e downloads,  
**so that** saibamos quem acedeu a que documento e quando.

### Acceptance Criteria

1. Eventos mínimos: `adn_sync_requested`, `adn_sync_completed`, `adn_sync_failed`, `adn_artifact_downloaded` (nomes podem seguir padrão existente em `audit_events`).  
2. Payload inclui `actor_user_id`, `organization_id`, `company_id`, `adn_sync_job_id` ou `artifact_id` conforme caso; **sem** URL assinada no payload.  
3. Integração com tabela/helper de auditoria já existente (`apps/web/src/lib/audit.ts` ou equivalente).  
4. Pelo menos um teste de integração que verifica gravação em pedido `POST sync` e `GET download`.

---

## ADN-06 — Story: export JSON para automação (**FR48**)

**Status:** Draft  

**Dependências (DoR):** **ADN-04**.

**Referências:** Arquitetura §5.2 última linha; PRD **FR48**; spec UX §4.5.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@po` (copy do aviso de segurança)

### Story

**As a** admin da organização,  
**I want** exportar lista de CNPJs/nomes das empresas monitoradas da org em JSON,  
**so that** o operador configure o worker sem expor certificados no ficheiro.

### Acceptance Criteria

1. `GET .../adn/automation-export.json` (path final alinhado ao routing do projeto) com `Content-Disposition: attachment`.  
2. Corpo contém apenas dados não sensíveis (ex.: `cnpj_digits`, `trade_name`, `system_code`, ids internos se necessários — **sem** PFX, thumbprint, secrets).  
3. **403** para `org_role=user` e para **superadmin** sem `org_role=admin` na org alvo (política HTTP).  
4. Teste: ficheiro parseável e sem chaves proibidas (lista negra de nomes de campos: `pfx`, `thumbprint`, `password`, `secret`, `privateKey`, …).

---

## ADN-07 — Story: UI — secção Sincronização ADN (empresa monitorada)

**Status:** Draft  

**Dependências (DoR):** **ADN-04** (API estável); tokens e shell conforme `docs/front-end-spec-dois-niveis-organizacao-vs-empresas-fiscais.md`.

**Referências:** `docs/front-end-spec-integracao-nfse-dist-adn.md` (§3–§7, §8 query keys).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@ux-design-expert`

### Story

**As a** operador fiscal,  
**I want** ver estado da sincronização ADN e descarregar XML a partir do detalhe da empresa monitorada,  
**so that** acompanhe a recolha sem jargão técnico.

### Acceptance Criteria

1. Secção **Sincronização ADN** no detalhe da empresa monitorada com `h2`, badge de estado, **Última sincronização**, contagens quando API fornecer (**FR41–FR42**).  
2. **Polling** apenas quando `status === 'running'`; intervalo 5–15 s; parar ao desmontar ou ao estado terminal (spec UX §4.1).  
3. Botão **Sincronizar agora** com modal de confirmação (admin + flag); tratar **202** da API como sucesso (enqueue) + toast conforme copy do spec; tratamento de **429** com copy “Serviço nacional ocupado” + cooldown se API enviar `retry_after` (spec §4.2).  
4. Tabela **Notas recebidas** (ou termo único escolhido no PR) com filtros de data, colunas do spec §5.2, estado vazio §5.2.  
5. Secção falhas + **Reprocessar** linha e bulk (admin) conforme §4.4 e §5.3.  
6. **FR45:** não montar secção nem rotas cliente se org não tem flag; se utilizador navegar por URL directa, mostrar **404** alinhado à API (sem mensagem que revele outros tenants).  
7. Query keys incluem `organizationId` e `monitoredCompanyId`; invalidação ao trocar organização.  
8. `aria-live="polite"` em mudança de estado de sync (spec §6).

### Tasks / Subtasks

- [ ] Componentes shadcn (Card, Table, Badge, Alert, Dialog)  
- [ ] Hooks TanStack Query  

### Dev Notes

- PDF: coluna “Em breve” ou `—` até épico 1b.  
- **Guia certificado (CE-FR9):** após **ADN-07**, encadear **`docs/stories/incremento-certificado-adn-guia-portal.md`** — story **CER-04** (Alert + link runbook + env).

---

## ADN-08 — Story: testes de integração + runbook worker

**Status:** Draft  

**Dependências (DoR):** **ADN-03**, **ADN-04**, **ADN-07** (para smoke UI opcional).

**Referências:** Arquitetura §12; PRD §10 critérios globais.

**Executor Assignment**

- **executor:** `@dev` + `@qa`  
- **quality_gate:** `@architect`

### Story

**As a** equipa de plataforma,  
**I want** testes automatizados e um runbook mínimo para o worker,  
**so that** não haja regressões de isolamento nem ingestão anónima.

### Acceptance Criteria

1. Teste: utilizador **sem** membership na org A → `GET .../organizations/A/.../adn/sync` → **403** (**NFR18**, política vinculativa).  
2. Teste: utilizador membro da org **B** onde `organizations.adn_sync_enabled=false` → `GET .../organizations/B/.../adn/sync` → **404**.  
3. Teste: `companyId` de outra organização no path → **404** (não **403**).  
4. Teste: dois `artifacts:commit` idênticos (HMAC válido) → uma única linha em `adn_artifacts`.  
5. Teste: pedido interno sem HMAC → **401**.  
5b. Teste: pedido interno com HMAC válido mas org com `adn_sync_enabled=false` → **403** (nunca **404** neste namespace).  
6. Teste: `GET .../download` devolve `expiresAt`; simular relógio ou esperar TTL+1 **ou** forçar URL já expirada → consumo do URL deve falhar com **403** do Storage **ou** erro documentado; a API pública, se re-pedir download após expiração, deve devolver **200** com **novo** par `downloadUrl`/`expiresAt` (smoke mínimo: dois GETs sequenciais geram URLs distintos).  
7. Teste: `org_role=user` → `POST .../sync` → **403**; `org_role=admin` → `POST .../sync` → **202** com `job.id` presente.  
7b. Teste: `POST .../sync` duas vezes com o mesmo `Idempotency-Key` e corpo canónico igual → duas respostas **202** com o **mesmo** `job.id`.  
8. Teste: **superadmin** sem admin na org → `POST .../sync` → **403** (MVP).  
8b. Teste: `POST .../failures:retry-bulk` com **51** `failureIds` válidos → **400** + `error_code` estável (política limite **50**).  
9. Documento curto em `docs/qa/` (ou `docs/`) com: variáveis do worker, ordem prepare → PUT → commit, exemplo HMAC, activação flag staging, e “se 429 no ADN, reduzir workers NFSE_dist”.  
10. (Opcional) Job CI com tag `@adn` apenas para estes testes.

---

## Backlog pós-MVP (não numerado neste ficheiro)

- PDF on-demand / paralelismo controlado (PRD fase 1b).  
- Worker como pacote no monorepo ou pipeline de release.  
- mTLS em substituição ou complemento ao HMAC.  
- Dashboard métricas **NFR22** para NOC.  
- **UI Superadmin** (ou consola segura) para alterar `adn_sync_enabled` sem SQL manual — substitui o procedimento de staging em **ADN-01** AC7 quando existir.

---

## QA Results

**Data da revisão:** 2026-04-22  
**Revisor:** Quinn (QA / AIOS)  
**Âmbito:** código e artefactos existentes no repositório face a **v0.3.2** deste documento (sem execução E2E em browser nesta ronda).  
**Decisão de gate:** **CONCERNS** — base técnica ADN presente e alinhada em vários pontos críticos (migração, HMAC *raw body*, rotas públicas/internas, OpenAPI parcial, runbook); **não** PASS até fechar lacunas abaixo (sobretudo **ADN-07**, **ADN-08**, **NFR21** pública, **ADN-05** completo).

### Resumo executivo

A implementação cobre bem **ADN-01** (DDL + Drizzle, incluindo `adn_artifact_drafts`), **ADN-02** (helpers Storage + env), **ADN-03** (prepare / commit / PATCH job com verificação HMAC conforme AC2) e o núcleo de **ADN-04** (sync GET/POST com **202** e idempotência, artifacts, download, failures list, retry stub, bulk com validação **≤50**, export JSON). **ADN-05** está **parcial** (só dois tipos de evento em fluxos limitados). **ADN-07** está **muito aquém** do spec UX (painel mínimo na página de empresa, sem tabelas/modais/copy 429/TanStack Query). **ADN-08** **não** foi implementado (sem testes de integração dedicados ADN no CI).

### Rastreio por fatia (implementação vs AC)

| ID | Cobertura | Observações QA |
| -- | --------- | ---------------- |
| **ADN-01** | **Alta** | Migração `20260425103000_adn_01_ddl.sql` + schema Drizzle; nota: glossário da story menciona exemplo `succeeded` mas o CHECK SQL usa `completed` — alinhar documentação ou enum UI. |
| **ADN-02** | **Média** | Código presente; DoD pedia teste/manual ou integração Storage — **não** há teste automatizado; bucket real depende de ops. |
| **ADN-03** | **Média–Alta** | HMAC e ordem *raw body* coerentes com AC2; **NFR21** (*rate limit* interno por IP/org) **não** evidenciado no código; **NFR22** contadores existem no schema mas sem narrativa de uso nos handlers. |
| **ADN-04** | **Média** | Política HTTP em `adn-public-access.ts` alinhada à tabela (404 flag, 403 membership, admin em mutações/export, superadmin POST bloqueado). Lacunas: resposta **429** + cabeçalho **`Retry-After`** + `error_code` estável (**AC9**) **não** implementada; erros **400** misturam `details` Zod (risco **NFR19** se `details` forem demasiado verbosos em prod — validar *sanitização*). |
| **ADN-05** | **Baixa** | Apenas `adn_sync_requested` e `adn_artifact_downloaded` via `insertAuditEvent`; faltam eventos mínimos da story (**`adn_sync_completed`**, **`adn_sync_failed`**, etc.) e **AC4** (teste de integração sobre payload). |
| **ADN-06** | **Média** | Rota e export sem campos sensíveis aparentes; **DoD** pedia teste de conteúdo — ausente. |
| **ADN-07** | **Baixa** | `adn-sync-panel.tsx`: confirmação nativa `confirm` vs modal especificado; sem badge explícito, sem tabela de notas, sem secção falhas/reprocessar, sem tratamento **429** / `retry_after`, sem TanStack Query nem invalidação por org; polling **8 s** (aceitável dentro 5–15 s); **aria-live** não cobre mudanças de estado como na spec. Painel oculta-se em qualquer `!ok` do GET sync, não só **404** — risco de confundir **403** com “feature off” (**FR45** UX). |
| **ADN-08** | **Não cumprido** | Nenhum teste novo mapeado aos critérios 1–8b; runbook existe (`docs/qa/adn-staging-setup.md`) mas não substitui a suíte pedida. |

### Segurança e privacidade (amostragem)

- **Positivo:** segredos ADN em variáveis servidor; listagem de artifacts sem `storage_object_key`; download por URL assinada; HMAC sem re-parse antes da verificação.  
- **Atenção:** superadmin com `canAccessOrganization(..., true)` pode aceder a org **sem** membership humano explícito — validar se isto viola a intenção “vista plataforma já autoriza” da política (revisão **@architect**).  
- **Segredos:** `.env.example` documenta `SUPABASE_SERVICE_ROLE_KEY` — correcto; garantir que nunca entra em `NEXT_PUBLIC_*`.

### Próximos passos (prioridade sugerida)

1. **@dev:** Implementar **ADN-08** (pelo menos casos 1, 2, 3, 5, 5b, 7, 7b, 8, 8b com DB de teste) + opcional tag `@adn`.  
2. **@dev:** Completar **ADN-07** conforme spec (shadcn, tabelas, modais, 429, query keys).  
3. **@dev:** **429** + `Retry-After` na API pública ADN onde aplicável; alinhar nomes de campos (`retry_after` vs cabeçalho HTTP) com spec UX.  
4. **@dev:** Estender **ADN-05** com eventos em falta e teste de integração.  
5. **@architect:** Rever exposição de erros **400** e papel superadmin vs org.  
6. **@po:** Manter **Draft** até `*validate-story-draft` formal se o processo o exigir; esta revisão **não** substitui gate PO.

— **River (SM) / AIOS**
