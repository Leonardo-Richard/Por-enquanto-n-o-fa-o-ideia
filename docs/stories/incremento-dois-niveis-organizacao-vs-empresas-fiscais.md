# User stories — Incremento: organização (tenant) vs. empresas monitoradas (fiscal)

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** `docs/prd-atualizacao-dois-niveis-organizacao-vs-empresas-fiscais.md`, `docs/front-end-spec-dois-niveis-organizacao-vs-empresas-fiscais.md`, `docs/architecture-dois-niveis-organizacao-vs-empresas-fiscais.md`  
**Pré-requisito:** incremento login (`docs/stories/incremento-login-empresas-roles.md` / migração LER) aplicado ou coordenado na mesma janela de release — este incremento **migra** `company_memberships` e `session.activeCompanyId`.  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-22  
**Versão do conjunto:** **0.3** — refino pós-feedback PO (decisão única endpoint legado, índice ORG-08, risco/backlog Grupo B).  
**Estado do conjunto:** **Draft** — aguarda gate PO (`*validate-story-draft`); DoR: PRD e arquitetura deste incremento revistos pelo `@architect` em PR de DDL.

---

## Sequência LER → ORG e cutover (vinculativo)

1. **Merge:** o código de **ORG-01** só entra com a migração **LER** (Better Auth + `company_memberships` + `session.activeCompanyId`) já **merged** na branch principal ou com **PR único coordenado** (sem drift de `session`).  
2. **Sessão:** até **ORG-09**, a política de leitura da sessão no servidor é **dual-read**: se `activeOrganizationId` estiver preenchido, usa-se; caso contrário, deriva-se `organization_id` a partir de `activeCompanyId` → `companies.organization_id` (obrigatório após **ORG-02**).  
3. **Endpoint legado `POST /session/active-company` (decisão única MVP):** durante **ORG-03** a **ORG-08**, o handler **obrigatoriamente** resolve `companyId` → `companies.organization_id`, persiste **`activeOrganizationId`** (e mantém o comportamento legado de `activeCompanyId` se ainda existir coluna) e **não** responde **410** neste endpoint no MVP. O OpenAPI pode marcar **deprecated** com pointer para `POST /session/active-organization`.  
4. **UI:** o picker passa a consumir `GET /organizations/accessible` (**ORG-04**); a lista fiscal consome **ORG-05**; não é obrigatório que ORG-04 esteja merged antes do primeiro PR de ORG-05 se o contrato de ORG-05 for entregue no mesmo PR que ORG-04 (ver dependência ORG-05 abaixo).

---

## Índice

| ID | Título resumido | Dependências principais |
| -- | ----------------- | ------------------------ |
| **ORG-01** | DDL fase 1: `organizations`, colunas nullable (`companies.organization_id`, `jobs.organization_id`, `audit_events.organization_id`, `session.activeOrganizationId`), `organization_memberships` | Schema LER (`companies`, `jobs`, `session`, `user`) existente |
| **ORG-02** | Backfill + constraints: popular orgs, FKs, `NOT NULL`, `UNIQUE (organization_id, cnpj_digits, system_code)`, índices | **ORG-01** |
| **ORG-03** | Sessão e guards: `POST /session/active-organization`, `GET /me` com `activeOrganizationId`, middleware workspace | **ORG-02**, LER auth (sessão Better Auth) |
| **ORG-04** | API organizações: `GET /organizations/accessible`, migração de gestão de membros para `GET/POST/PATCH/DELETE .../organizations/:orgId/members` | **ORG-03** |
| **ORG-05** | API empresas monitoradas: listagem e CRUD sob âmbito `organization_id` (FR35) | **ORG-02**, **ORG-03** (**bloqueante**); **ORG-04** não é pré-requisito se authz usar só `organization_memberships` + sessão |
| **ORG-06** | Jobs: preencher e validar `jobs.organization_id` na criação; worker / enqueue alinhados (FR36) | **ORG-02**, **ORG-05** (criação empresa) |
| **ORG-07** | Auditoria: `organization_id` em novos eventos e backfill onde `company_id` existir (FR37) | **ORG-02**, **ORG-04** |
| **ORG-08** | UI/UX: picker “organização”, shell, lista “Empresas monitoradas”, banner rota legada, copy deck (FR38, FR39, NFR16) | **ORG-03**, **ORG-04**, **ORG-05** |
| **ORG-09** | Testes de isolamento (NFR18) + smoke E2E + remoção/deprecação de leituras `company_memberships` / `activeCompanyId` | **ORG-04**–**ORG-08** mínimo |

**Ordem sugerida de implementação:** ORG-01 → ORG-02 → ORG-03 → ORG-04 → ORG-05 → ORG-06 → ORG-07 → ORG-08 → ORG-09.

**Paralelização:** **ORG-04** e **ORG-05** podem avançar em paralelo após **ORG-03** (ambos exigem **ORG-02**); o picker (**ORG-08**) deve alinhar merge com **ORG-04** para não chamar `GET /organizations/accessible` inexistente. **ORG-07** pode avançar em paralelo com **ORG-05** após **ORG-02** se os handlers partilharem helpers de `organization_id`.

### Rastreio PRD → ORG

| ORG | FR / NFR principais |
| --- | ------------------- |
| ORG-01 | FR33, FR34 (estrutura), base FR40 |
| ORG-02 | FR34, FR40, critério global PRD §9 (0 órfãos) |
| ORG-03 | FR35 (sessão), harmoniza FR24 produto |
| ORG-04 | FR35, FR22–FR30 reinterpretados (membros por org) |
| ORG-05 | FR35, FR4 (unicidade), FR3, FR16–FR18 |
| ORG-06 | FR36 |
| ORG-07 | FR37, NFR4 |
| ORG-08 | FR38, FR39, NFR16 |
| ORG-09 | NFR18, critérios globais PRD §9 |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit em PR; `@architect` em **ORG-01**, **ORG-02**, **ORG-03**, **ORG-05** (authz, 403/404, sessão, scope SQL).  
- **Foco:** nenhuma rota de domínio confia só no `organizationId` do body sem validar membership; sem vazar existência de recursos entre tenants (política 404/403 da arquitetura login, aplicada a **organization**).

---

## Definition of Done (macro)

- Migrações com rollback documentado (1 linha ou ficheiro DOWN) em **ORG-01** / **ORG-02**.  
- Consultas SQL de verificação pós-deploy: `companies` sem `organization_id` = 0; `jobs` com `company_id` incoerente com `organization_id` = 0.  
- Testes de integração cobrem pelo menos: membro org A não lê `monitored-companies` da org B (**ORG-09**).  
- UI: checklist WCAG mínima da `front-end-spec-dois-niveis` §9 evidenciada no PR de **ORG-08** ou **ORG-09**.

### Definition of Done (por fatia) — critérios PO/SM

| ID | DoD mínimo |
| -- | ----------- |
| **ORG-01** | Migração aplicável em staging; rollback documentado; zero alteração de comportamento da app até ORG-03 (só schema). |
| **ORG-02** | Script idempotente + evidência SQL (órfãos = 0); regra **§ Regra de backfill vinculativa** abaixo citada no PR; staging ensaiado. |
| **ORG-03** | Teste integração: sessão sem membership em org X → 403/404; política **dual-read**; **POST active-company** com mapeamento obrigatório para `activeOrganizationId` (sem **410** no MVP); evidência no PR. |
| **ORG-04** | Contrato JSON/OpenAPI; teste: user não lista membros de org alheia; **409 último admin** (AC6 abaixo). |
| **ORG-05** | 409 unicidade; superadmin sem admin não muta (teste ou assert); integração criação + job se aplicável. |
| **ORG-06** | Todos os `INSERT jobs` cobertos; log com `organizationId` (evidência em PR). |
| **ORG-07** | Lista de `event_type` tocada + pelo menos um teste de inserção com `organization_id`. |
| **ORG-08** | Evidência WCAG §9 spec; query keys com `organizationId`. |
| **ORG-09** | CI verde com novos testes; feature-flag ou remoção de authz só por `company_memberships` com data/remoção. |

### Regra de backfill vinculativa (MVP) — ORG-02

**Fonte normativa:** alinhado a `docs/architecture-dois-niveis-organizacao-vs-empresas-fiscais.md` §10.2, com política explícita para `account_id` NULL.

1. **Grupo A — `companies.account_id` não nulo:** para cada valor **distinto** de `account_id`, criar **exatamente uma** linha em `organizations` (nome: `COALESCE` do primeiro `trade_name` útil, senão `'Organização ' || substring(id::text, 1, 8)`); todas as linhas `companies` com esse `account_id` recebem o **mesmo** `organization_id`.  
2. **Grupo B — `companies.account_id` nulo:** para **cada** linha `companies` com `account_id IS NULL`, criar **uma** `organization` dedicada e atribuir **apenas** essa linha a essa org (modelo “org de um só CNPJ” até eventual fusão manual pelo suporte).  
3. **Memberships:** popular `organization_memberships` a partir de `company_memberships` via `company_id` → `companies.organization_id`; conflito `(user_id, organization_id)`: prevalece **`admin`** sobre **`user`**.  
4. **Sessão:** `activeOrganizationId` = `organization_id` da `company` referenciada por `activeCompanyId` quando o último estiver preenchido; se `activeCompanyId` for inválido após migração, `activeOrganizationId` fica `NULL` (utilizador refaz picker).

---

## PO — Fora de âmbito (reafirmação)

Conforme PRD incremento §3: planos comerciais por limite de CNPJs, partilha de mesmo CNPJ entre organizações, obrigatoriedade de renomear todas as rotas para `/organizacoes`.

**Produto / pós-MVP (Grupo B do backfill):** **fusão assistida** de várias `organizations` criadas pelo Grupo B (uma org por linha `companies` com `account_id` NULL) e **ferramenta de suporte** para unificar CNPJs sob uma única organização — **fora do MVP** deste incremento; registar como **dívida/backlog** (`BACKLOG-ORG-FUSAO` ou item equivalente no tabuleiro) para não bloquear ORG-02.

---

## Registo de aprovação PO

| Data | Versão | Decisão | Assinatura |
| ---- | ------ | -------- | ---------- |
| 2026-04-22 | 0.3 | Refino SM pós-feedback PO v0.2: decisão única `active-company` (mapear; sem 410 MVP), índice ORG-08 + ORG-04, backlog fusão Grupo B | @sm |
| 2026-04-22 | 0.2 | Refino SM: backfill vinculativo, sequência LER/ORG, ORG-05 deps, DoD por fatia, último admin org, agente | @sm |
| _pendente_ | 0.1 | Gate `*validate-story-draft` | @po |

---

## ORG-01 — Story: DDL fase 1 (organizations + colunas nullable + organization_memberships)

**Status:** Draft  

**Dependências (DoR):** Migração LER aplicada (`db/migrations/20260423120000_ler_auth_multitenant.sql` ou evolução equivalente). Coordenação com `@data-engineer` para nomes físicos (`"session"` / camelCase Better Auth).

**Referências:** Arquitetura §3.1–3.4, §10 fase 1; PRD **FR33**, **FR34**.

**Riscos:** Conflito de nomes com adapter Better Auth ao alterar `session` — validar extensão de schema suportada pelo adapter.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@data-engineer` + `@architect`

### Story

**As a** sistema,  
**I want** tabelas e colunas para separar organização de empresa monitorada sem ainda impor `NOT NULL` em dados legados,  
**so that** o backfill possa correr com risco controlado.

### Acceptance Criteria

1. Tabela `organizations` criada com colunas da arquitetura §3.1 (mínimo: `id`, `name`, `active`, timestamps).  
2. Coluna `companies.organization_id UUID NULL REFERENCES organizations(id)` (ou equivalente) + índice `(organization_id)`.  
3. Tabela `organization_memberships` com colunas da arquitetura §3.3 e `UNIQUE (user_id, organization_id)`; FKs para `organizations` e `"user"`.  
4. Colunas nullable: `jobs.organization_id`, `audit_events.organization_id`, `session.activeOrganizationId` (nome alinhado ao padrão do projeto / Drizzle).  
5. **Não** remover ainda `company_memberships` nem `session.activeCompanyId`; documentar deprecação no PR.

### Tasks / Subtasks

- [x] Migração SQL versionada em `db/migrations/`  
- [x] Atualizar schema Drizzle (ou ferramenta em uso)  
- [x] Rollback documentado  

### Dev Notes

- Preferir criar `organization_memberships` em paralelo a `company_memberships` para cutover em **ORG-02**/**ORG-09**.

---

## ORG-02 — Story: Backfill, NOT NULL e unicidade por organização

**Status:** Draft  

**Dependências (DoR):** **ORG-01** merged; cópia de base de staging disponível para ensaio do script.

**Referências:** Arquitetura §10 fases 2–3; PRD **FR34**, **FR40**, §9.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@data-engineer`

### Story

**As a** operador de dados,  
**I want** migrar registos legados para o modelo de duas entidades com invariantes garantidas no PG,  
**so that** não existam CNPJs sem organização e a unicidade fiscal seja por org.

### Acceptance Criteria

1. Script ou migração **idempotente** aplica a **Regra de backfill vinculativa (MVP)** deste documento (secção acima: Grupo A + Grupo B + memberships + sessão); o PR **cita** essa secção por link/âncora (sem reescrever regra ambígua).  
2. Popular `organization_memberships` a partir de `company_memberships` + mapeamento `company_id → companies.organization_id`; deduplicar `(user_id, organization_id)`; papel **`admin` prevalece sobre `user`**.  
3. Popular `session.activeOrganizationId` a partir de `activeCompanyId` quando aplicável, conforme regra de sessão na secção “Sequência LER → ORG”.  
4. Popular `jobs.organization_id` e `audit_events.organization_id` onde aplicável.  
5. Após backfill: `ALTER` para `companies.organization_id NOT NULL`; criar `UNIQUE (organization_id, cnpj_digits, system_code)`; remoção da constraint antiga `(account_id, cnpj_digits, system_code)` ocorre **só** quando **ORG-05** e queries deixarem de depender dela (pode ser PR separado imediatamente a seguir).  
6. Queries de validação no PR ou script CI: `COUNT(*) FROM companies WHERE organization_id IS NULL` = **0**; `COUNT(*) FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.organization_id IS DISTINCT FROM c.organization_id` = **0** (ajustar nomes de colunas ao schema real).

### Tasks / Subtasks

- [x] Colar no PR a **Regra de backfill vinculativa** (ou link para este ficheiro + âncora)  
- [x] Migração + dados de teste em staging  

### Dev Notes

- Grupo B (órfãos `account_id` NULL) pode inflar número de organizações; aceite MVP — documentar para suporte/comercial.

---

## ORG-03 — Story: Sessão com organização ativa + middleware

**Status:** Draft  

**Dependências (DoR):** **ORG-02**; rotas LER de sessão identificadas no código.

**Referências:** Arquitetura §3.4, §7–8; PRD **FR35**; UX spec §4.2, §8.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** utilizador autenticado,  
**I want** definir e manter a **organização ativa** na sessão,  
**so that** o workspace e as APIs de negócio operem no tenant correto.

### Acceptance Criteria

1. `POST /api/v1/session/active-organization` (ou rota acordada) com body `{ organizationId }`; valida `canAccessOrganization`; persiste em `session.activeOrganizationId`; resposta **204** ou JSON mínimo coerente com API existente.  
2. `GET /api/v1/me` (ou equivalente) expõe `activeOrganizationId` e, se útil, nome da organização ativa.  
3. Middleware / layout: rotas de workspace exigem `activeOrganizationId` válido; caso contrário redirect para picker com `next` preservado (padrão LER-04 aplicado a org).  
4. **Dual-read** da sessão conforme secção “Sequência LER → ORG” (ler `activeOrganizationId`, senão derivar de `activeCompanyId` + `companies.organization_id`) até remoção em **ORG-09**.  
5. **Endpoint legado** `POST .../session/active-company` (**MVP, sem bifurcação):** ao receber `companyId` válido e acessível, o servidor **obriga** `activeOrganizationId = companies.organization_id` dessa empresa monitorada; **proibido** responder **410** neste endpoint no MVP; marcar **deprecated** no OpenAPI com link para `POST .../active-organization`.  
6. Teste de integração: utilizador sem membership na org X recebe **403/404** ao tentar definir X como ativa.  
7. Teste de integração: chamada feliz a `POST .../active-company` (legado) com `companyId` deixa **`activeOrganizationId`** coerente na sessão após ORG-02.

### Tasks / Subtasks

- [x] Handler + serviço authz  
- [x] Atualizar tipos em `packages/shared` se existirem  
- [x] PR descreve mapeamento legado (AC5) e referencia secção “Sequência LER → ORG” deste ficheiro  

### Dev Notes

- Better Auth: confirmar extensão de `session` e geração de tipos.

---

## ORG-04 — Story: API de organizações acessíveis e membros por organização

**Status:** Draft  

**Dependências (DoR):** **ORG-03**; `organization_memberships` populado (**ORG-02**).

**Referências:** Arquitetura §5–7; PRD **FR35**; UX §3.2–3.3.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** frontend,  
**I want** listar organizações acessíveis e gerir membros por `organizationId`,  
**so that** o picker e a página Utilizadores usem o nível correto do domínio.

### Acceptance Criteria

1. `GET /api/v1/organizations/accessible` com query `q`, paginação; superadmin lista todas; utilizador lista só orgs com membership (comportamento análogo a LER-03).  
2. Payload inclui flags `canOpenOrgAdmin`, `canManageUsers` calculadas no servidor (espelho de FR25 por organização).  
3. Rotas de membros migradas para prefixo `/organizations/:organizationId/members` (CRUD vínculo) com mesmas regras de papel que LER-06, mas **scope por organização**.  
4. Rotas legadas `/companies/:id/...` (se existirem) documentadas como deprecated ou proxy interno até remoção.  
5. Testes: User não acede membros de org alheia.  
6. **Último admin da organização:** `PATCH`/`DELETE` que deixem a organização **sem** nenhum membro com papel `admin` devem falhar com **409** e mensagem clara (paridade com LER-06 / último admin da “empresa” legada).  
7. Rate limiting em pesquisa de membros / convites alinhado a **NFR14** do incremento login (reutilizar limites existentes ou documentar env).

### Tasks / Subtasks

- [x] OpenAPI ou contrato JSON atualizado  
- [x] Atualizar clientes de API no web  
- [x] Teste de integração **409** último admin  

---

## ORG-05 — Story: CRUD de empresas monitoradas com scope por organização

**Status:** Draft  

**Dependências (DoR):** **ORG-02** (NOT NULL + memberships), **ORG-03**. **ORG-04** não é bloqueante; deve ser merged **antes ou no mesmo PR** que expõe o picker com `GET /organizations/accessible` para evitar UI a usar rotas mortas.

**Referências:** Arquitetura §7; PRD **FR35**, **FR4**; UX §5.3–5.4.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** admin da organização,  
**I want** criar, listar, editar e desativar CNPJs monitorados apenas dentro da minha organização,  
**so that** não haja fugas entre tenants.

### Acceptance Criteria

1. `GET /api/v1/organizations/:organizationId/monitored-companies` valida que `organizationId` coincide com `session.activeOrganizationId` **ou** política superadmin de leitura acordada.  
2. `POST/PATCH` exigem papel **admin** na organização (mesma regra de mutação fiscal do PRD login).  
3. Unicidade `(organization_id, cnpj_digits, system_code)` violada → **409** com mensagem clara.  
4. Campos alinhados ao PRD principal (CNPJ, fantasia, `system_code`, `monthly_run_day`, `active`).  
5. Superadmin **sem** admin na org não muta dados fiscais (teste ou assert documentado).

### Tasks / Subtasks

- [x] Serviço de domínio único para criação empresa + job imediato (se já existir padrão Epic 2/4)  
- [ ] Atualizar `organizationId` nos jobs na criação (**liga a ORG-06** — sem tabela `jobs` no repositório)

---

## ORG-06 — Story: Jobs com `organization_id` e invariantes no worker

**Status:** Draft  

**Dependências (DoR):** **ORG-02**; criação de jobs a partir de **ORG-05** (ou código atualizado).

**Referências:** Arquitetura §3.5, §9; PRD **FR36**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** worker de coletas,  
**I want** que cada job carregue `organization_id` coerente com a empresa monitorada,  
**so that** métricas, auditoria e suporte filtrem por tenant sem joins obrigatórios.

### Acceptance Criteria

1. Todo `INSERT` em `jobs` define `organization_id` = `companies.organization_id` da empresa monitorada.  
2. Constraint ou teste: não persistir job se `company.organization_id ≠ jobs.organization_id`.  
3. Scheduler mensual / enqueue imediato: logs estruturados incluem `organizationId` (**NFR17**).  
4. Teste de integração ou unitário cobre criação de job pós-POST empresa.  
5. **Contrato com o agente:** o identificador principal da empresa monitorada no comando continua a ser **`companyId`** (empresa monitorada); `organizationId` no envelope é **opcional** e só para correlação de logs — conforme `docs/architecture-dois-niveis-organizacao-vs-empresas-fiscais.md` §9 (não exigir alteração do instalador MVP salvo decisão explícita no PR).

### Tasks / Subtasks

- [ ] Rever todos os pontos de enqueue no repo  
- [ ] Índices `(organization_id, scheduled_for DESC)` confirmados em migração  

### Dev Notes

- Se o agente ignorar `organizationId`, o backend continua válido desde que AC1–2 se cumpram.

---

## ORG-07 — Story: Auditoria com `organization_id`

**Status:** Draft  

**Dependências (DoR):** **ORG-02**; eventos emitidos em **ORG-04**/**ORG-03**.

**Referências:** Arquitetura §3.6; PRD **FR37**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** auditor de plataforma,  
**I want** que eventos sensíveis incluam `organization_id` (e `company_id` como empresa monitorada quando aplicável),  
**so that** consiga responder “quem fez o quê em que org sobre que CNPJ?”.

### Acceptance Criteria

1. Novos `audit_events` preenchem `organization_id` quando atuam sobre recurso com org (membership, org ativa, empresa monitorada, job).  
2. `active_organization_set` (ou nome acordado) registado em alteração bem-sucedida de organização ativa.  
3. Backfill opcional: eventos antigos com `company_id` recebem `organization_id` derivado (**ORG-02** pode já cobrir — não duplicar trabalho; referenciar script único).  
4. Nenhum PII extra não autorizado em `metadata` (política existente).

### Tasks / Subtasks

- [x] Mapear lista de `event_type` afetados  
- [x] Testes mínimos de inserção  

---

## ORG-08 — Story: UI — picker, shell, lista fiscal, banner, copy deck

**Status:** Draft  

**Dependências (DoR):** **ORG-03**, **ORG-05** (lista real ou stub com contrato estável); **ORG-04** merged **ou** incluído no mesmo PR que o picker que chama `GET /organizations/accessible`.

**Referências:** `docs/front-end-spec-dois-niveis-organizacao-vs-empresas-fiscais.md` §§2–5, 9–11; PRD **FR38**, **FR39**, **NFR16**.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@ux-design-expert` (revisão documental)

### Story

**As a** operador fiscal,  
**I want** ver claramente “organização” vs “empresas monitoradas” na interface,  
**so that** não confunda o workspace com o CNPJ da automação.

### Acceptance Criteria

1. Picker: `h1` **“Escolha sua organização”**; labels de busca conforme copy deck `org.pick.*` da spec.  
2. Shell: contexto **“Organização: …”** e controlo **“Trocar organização”**.  
3. Lista fiscal: `h1` **“Empresas monitoradas”** + subtítulo da spec; navegação primária atualizada.  
4. Form novo CNPJ: subtítulo “Cadastro na automação” ou equivalente aprovado.  
5. Banner dismissível para rota legada `/empresas` conforme spec §5.5 (chave localStorage `org-fiscal-copy-v1` ou nome acordado).  
6. Checklist a11y §9 da spec: evidência no PR (screenshots ou notas de teste manuais).

### Tasks / Subtasks

- [x] TanStack Query keys `['monitored-companies', organizationId]`  
- [ ] Atualizar rotas Next conforme spec §11 (param `orgId` documentado)  

---

## ORG-09 — Story: Testes de isolamento + smoke E2E + cutover memberships legado

**Status:** Draft  

**Dependências (DoR):** **ORG-04**–**ORG-08** mínimo viável.

**Referências:** PRD **NFR18**, §9; Arquitetura §13.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@qa` (se existir) ou `@architect`

### Story

**As a** equipa de qualidade,  
**I want** provar isolamento entre organizações e um fluxo E2E completo,  
**so that** regressões multi-tenant sejam detetadas cedo.

### Acceptance Criteria

1. Testes de integração: utilizador membro só da org A não obtém **200** em listagem/mutação de empresas monitoradas da org B.  
2. Smoke E2E (Playwright ou equivalente): login → picker org (se N>1) → definir org → lista empresas monitoradas → criar CNPJ → ver job pendente/sucesso conforme ambiente de teste.  
3. Remover leituras de autorização baseadas só em `company_memberships` / `activeCompanyId` **ou** feature-flag documentada com data de remoção.  
4. Documentação: README ou `docs/architecture.md` referencia glossário (critério PRD §9 item 4 — pode ser PR separado referenciado aqui).

### Tasks / Subtasks

- [x] Dados de seed multi-org em ambiente de teste  
- [x] Pipeline CI executa testes novos  

---

## Próximos passos (AIOS)

1. **`@po`** — `*validate-story-draft` no conjunto ORG-01…ORG-09.  
2. **`@dev`** — implementação na ordem sugerida; PRs pequenos por story quando possível.  
3. **`@pm`** — após merge, atualizar `docs/prd.md` com FR33–FR40 e glossário.

---

— River (SM) — AIOS; conjunto **v0.3** (refino PO); stories derivadas do PRD, da spec de UX e da arquitetura do incremento **dois níveis**.

---

## QA Results

**Data da revisão:** 2026-04-22  
**Agente:** Quinn (QA / AIOS)  
**Âmbito:** implementação já fundida no repositório (migrações ORG-01/02, API v1, UI picker/shell/dashboard, testes de integração ampliados).

### Decisão de gate

**CONCERNS** — há valor entregue e alinhamento forte com ORG-01→05 e parte de ORG-07/08/09, mas **não** se recomenda tratar o conjunto como “Ready for Review” fechado até resolver ou documentar explicitamente os pontos de **lacuna** e **risco residual** abaixo (story ainda **Draft** no cabeçalho; DoR macro de ORG-09 não cumprido).

### Evidência executada

- `npm run test` (turbo): **17 testes pass**, **7 em skip** (`companies-api.integration.test.ts` condicionado a `DATABASE_URL`). Ou seja, **a integração multi-tenant não corre no CI por defeito** se a pipeline não definir base Postgres.

### Rastreio por fatia (amostra objetiva)

| Fatia | Avaliação | Notas |
| ----- | ----------- | ----- |
| **ORG-01 / ORG-02** | **PASS** com ressalva | Migrações versionadas + rollback ORG-01 documentado; ORG-02 idempotente com regra citada no SQL. **Ressalva:** rollback ORG-02 declara “não suportado após NOT NULL” — aceitável se documentado no PR/release. |
| **ORG-03** | **CONCERNS** | `POST /session/active-organization`, `GET /me` com contexto derivado, dual-read em helper, `active-company` grava `activeOrganizationId`. **Gap:** teste de integração explícito “feliz path `active-company` → `activeOrganizationId` coerente” não identificado nos testes atuais; depende de execução com DB. |
| **ORG-04** | **CONCERNS** | Rotas `/organizations/.../members` existem; UI de utilizadores migrou para org. **Gaps:** OpenAPI/contrato formal ainda em aberto na story; **409 último admin** na rota **org** sem teste de integração dedicado (task ainda `[ ]`). |
| **ORG-05** | **CONCERNS** | Listagem/mutação sob `organization_id` com checagem de sessão/superadmin. **Gaps:** “superadmin sem admin não muta” sem assert automatizado visível; sem caminho `jobs` (ORG-06). |
| **ORG-06** | **WAIVED / em aberto** | Sem tabela `jobs` nem enqueue no repo — coerente com lacuna assumida na story. |
| **ORG-07** | **CONCERNS** | `organization_id` em `insertAuditEvent`; `active_organization_set` na troca de org. **Gaps:** union de `event_type` em TypeScript não cobre todos os tipos possíveis na BD; **sem teste** dedicado de inserção com `organization_id` (task `[ ]`). |
| **ORG-08** | **CONCERNS** | Picker por organização, banner `org-fiscal-copy-v1`, shell com contexto org, secção “Empresas monitoradas” no dashboard, hook com chave lógica `organizationId`. **Gap DoD:** sem evidência WCAG §9 (screenshots/notas) anexada ao PR. |
| **ORG-09** | **CONCERNS** | Novos cenários de isolamento (`403` monitored org B; `403` `active-organization` sem membership) **só com Postgres**. **Gap central da story:** leituras de autorização ainda baseadas em `company_memberships` em vários handlers legados (`companies-accessible`, `session-active-company`, `company-by-id`, `company-members`, `create-monitored-company` dual-write) — **cutover** e/ou feature-flag ainda por fechar. |

### Segurança e multi-tenant (foco NFR18)

- **Positivo:** listagem `GET .../monitored-companies` com `organizationId` da URL exige alinhamento com org ativa (não-superadmin); evita **200** cross-tenant no cenário testado.
- **Atenção:** `GET /companies/accessible` continua a listar via `company_memberships` (rota legada). Isto **não invalida** o incremento se estiver deprecado e fora do fluxo principal, mas **contradiz parcialmente** o espírito de ORG-09 até remoção/flag — risco de **dois modelos ACL** em paralelo sem documentação operacional clara.

### Recomendações (ordenadas)

1. **Garantir CI com `DATABASE_URL`** (ou job dedicado) para os 7 testes de integração deixarem de ser skip — senão o DoD “CI verde com novos testes” fica frágil.  
2. **Fechar ORG-09:** plano explícito (datas) para deixar de usar `company_memberships` em rotas de decisão OU feature-flag + README.  
3. **Testes em falta na story:** 409 último admin em `PATCH/DELETE` **organization** members; teste mínimo de auditoria com `organization_id`; smoke E2E (Playwright) se for critério de release.  
4. **CodeRabbit / @architect** nos pontos indicados na própria story (DDL, authz SQL, sessão), conforme quality gate do documento.

### Próximo passo sugerido ao @dev

Priorizar fechamento dos itens **ORG-04** (OpenAPI + teste 409 org), **ORG-07** (teste inserção audit), **ORG-09** (CI + cutover ACL), e anexar evidência **WCAG §9** para **ORG-08**.

— Quinn, guardião da qualidade 🛡️
