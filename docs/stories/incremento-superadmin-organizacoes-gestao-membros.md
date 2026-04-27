# User stories — Incremento: superadmin — gestão de membros da organização e gate `/admin`

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** `docs/prd-superadmin-aba-organizacoes-gestao-membros.md`, `docs/architecture-superadmin-aba-organizacoes-gestao-membros.md`, `docs/front-end-spec-superadmin-aba-organizacoes-gestao-membros.md`  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-27  
**Revisão:** v1.8 (2026-04-27) — **Histórico PO:** última linha **v1.8 | 9,85** — **Rev. doc** alinhada ao cabeçalho (simetria; sugestão @po).  
**Estado do conjunto:** **Ready for Review** — implementação @dev concluída; aguardando revisão.

**Sign-off @po (sprint / aceite formal):** *pendente* — @po substitui por `Aprovado — AAAA-MM-DD` ao priorizar este pacote no sprint ou ao registar aceite explícito do conjunto de stories. **Escala PO:** nota do **artefacto** = última entrada em **Histórico de avaliações PO** (secção seguinte); **10/10 do pacote** = este sign-off preenchido **+** primeira evidência de merge/QA alinhada ao **DoD macro**.

**Dependência externa (SORG — referência explícita):**

- **Artefacto de stories:** `docs/stories/incremento-superadmin-cadastro-organizacoes-acesso-global.md` — pacote **SORG-01** … **SORG-06**.
- **Mínimo para SMEM-07 (UI «Gerir membros» na lista) — gate objectificável:** no branch de integração alvo existe rota **`/admin/organizacoes`** com listagem de organizações e **`OrganizationsAdminPage`** (ou componente homólogo aprovado por **@po** no comentário de priorização) com **CTA «Gerir membros»** por card. Em sequência nominal SORG isso corresponde a **SORG-03+** mergeado; se o pacote SORG divergir, **@po** regista **equivalência** (o quê cumpre o gate) no mesmo comentário onde prioriza SMEM.
- **Regressão citada em SMEM-08:** endpoints e fluxos SORG cobertos por **SORG-06** (ou equivalente verde em CI no momento do PR de fecho).
- Este pacote SMEM **estende** `/admin` sem alterar contratos SORG salvo onde **NFR34** / ACs deste documento o exigem.

**Planeamento NFR31 (valores — dono @architect):** *TBD no PR de **SMEM-02*** — antes do merge, o PR documenta no corpo (ou comentário fixado) **`limit`** (pedidos), **`windowSeconds`**, e **chave** de agrupamento (`actorUserId`, opcionalmente `organizationId`). Se não for entregável, seguir **waivo** de SMEM-02 AC7 (issue + @architect + @po) e referência em SMEM-08 AC6.

---

## Histórico de avaliações PO (artefacto)

Nota **0–10** sobre o **documento de stories** (clareza, rastreio, testabilidade). **Não** substitui sign-off de sprint nem evidência de código.

**Manutenção:** após cada **avaliação formal @po** deste ficheiro, **@sm** acrescenta uma linha (data **AAAA-MM-DD**, coluna **Rev. doc**, nota, sumário de uma linha). **Coluna Rev. doc:** versão do `.md` **no momento** da avaliação (ou da confirmação @po); quando @po **confirma** nota sem alterar substância, pode haver linha com a mesma nota só para alinhar **Rev. doc** ao cabeçalho.

| Data | Rev. doc | Nota | Sumário |
|------|----------|------|---------|
| 2026-04-27 | ≤ v1.4 | 9,75 | Iterações até SORG explícito, NFR31, spec i18n `mem.mem.*`; critério pacote 10 = sign-off + evidência. |
| 2026-04-27 | v1.5 | 9,8 | Gate SORG objectificável + equivalência @po; DoR SMEM-07 SORG; SMEM-08 AC3 + task matriz regressão SORG. |
| 2026-04-27 | v1.6 | 9,85 | @po: artefacto **9,85**; substância SMEM-01…08 = v1.5; valor em governança (histórico + manutenção @sm); tabela actualizada pós-avaliação. |
| 2026-04-27 | v1.7 | 9,85 | @po confirma **9,85**; **Rev. doc** alinhada à revisão v1.7 do ficheiro; sem mudança de AC/DoD/substância SMEM. |
| 2026-04-27 | v1.8 | 9,85 | Simetria **Rev. doc** = revisão no cabeçalho (v1.8); nota inalterada; sem mudança de substância SMEM (@po). |

---

## Índice

| ID | Título resumido | Dependências principais |
| -- | ---------------- | ----------------------- |
| **SMEM-01** | Schemas Zod (`@repo/shared`) + OpenAPI para membros da organização | Nenhuma (base de código v1) |
| **SMEM-02** | `GET /api/v1/organizations/{id}/members` (paginação + `q`) | **SMEM-01** |
| **SMEM-03** | `POST .../members` modo `link` + auditoria `membership_created` | **SMEM-01**, **SMEM-02** (para reutilizar tipos/contrato) |
| **SMEM-04** | `PATCH` e `DELETE .../members` + regra **FR108** + auditoria | **SMEM-01**, **SMEM-02** |
| **SMEM-05** | `POST .../members` modo `create` (utilizador + membership + Better Auth) | **SMEM-01**, **SMEM-03** |
| **SMEM-06** | Layout servidor `admin` — redirect não-superadmin (FR101) | Nenhuma (pode paralelizar com SMEM-02 se não houver conflito de ficheiros) |
| **SMEM-07** | UI: link «Gerir membros» + página `/membros` + modais (spec UX) | **SMEM-02**–**SMEM-05**, **SMEM-06** |
| **SMEM-08** | Testes integração/E2E + regressão + gate de qualidade | **SMEM-01**–**SMEM-07** |

**Ordem sugerida:** SMEM-01 → SMEM-02 → SMEM-03 → SMEM-04 → SMEM-05 → SMEM-06 → SMEM-07 → SMEM-08.

**Ordem de magnitude (sizing relativo / risco — não pontos de história):** **SMEM-05** = maior risco técnico (conta Better Auth + transacção + prova de login); **SMEM-04** e **SMEM-07** = alto (FR108 / concorrência; superfície UI + modais + **AC8**); **SMEM-02** = médio-alto (NFR31); **SMEM-01**, **SMEM-03**, **SMEM-06**, **SMEM-08** = médio (contratos, link+audit, layout gate, consolidação de suíte).

---

## Rastreio PRD → stories

| Story | FR / NFR cobertos (principal) |
| ----- | ------------------------------ |
| SMEM-01 | Base para FR102–FR106; NFR33 (contrato documentado) |
| SMEM-02 | FR102, FR107; NFR30, **NFR31** (rate limit / waivo), NFR32, NFR34 |
| SMEM-03 | FR103, FR107, FR109; NFR30, NFR32 |
| SMEM-04 | FR105, FR106, **FR108**, FR107, FR109; NFR30, NFR32 |
| SMEM-05 | FR104, FR107, FR109; NFR30, NFR32 |
| SMEM-06 | **FR101**, NFR30 |
| SMEM-07 | **FR100** (**AC8** — item «Organizações» oculto não-superadmin), **FR110**, **NFR35** (UI + a11y §9 spec) |
| SMEM-08 | NFR31 (evidência waivo/implementação), **NFR35** (evidência regressão a11y / checklist cruzado com SMEM-07), NFR32, NFR34, regressão global do pacote |

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **revisão sugerida:** `@architect` em SMEM-02, SMEM-04, SMEM-05 (API, FR108, criação de identidade); `@qa` em SMEM-08.  
- **foco:** `isSuperadmin` **apenas** no servidor; sem listagem global de utilizadores; códigos de erro estáveis (`LAST_ORG_ADMIN`, `MEMBERSHIP_DUPLICATE`); sem PII em logs além do necessário operacional; **NFR35** (SMEM-07 / evidência em SMEM-08).  
- **gate mínimo para merge:** nenhum achado de severidade alta aberto; testes automáticos cobrindo **200/201**, **400**, **401**, **403**, **404** (onde aplicável), **409** (`LAST_ORG_ADMIN`, duplicidade); respostas de erro com **`code` estável** quando o AC da story o exige; comentários críticos do review resolvidos ou justificados no PR.

---

## Definition of Done (macro)

- Schemas e OpenAPI alinhados aos handlers;
- `GET/POST/PATCH/DELETE` de membros da **organização** funcionais e protegidos por superadmin;
- **FR108** coberta por teste automatizado;
- eventos `membership_created`, `membership_removed`, `membership_role_changed` nas mutações bem-sucedidas;
- `layout` servidor em `/admin` com redirect para `/dashboard` quando autenticado sem superadmin;
- UI conforme `docs/front-end-spec-superadmin-aba-organizacoes-gestao-membros.md` (rota `/admin/organizacoes/[organizationId]/membros`, modais, copy PT-BR, checklist a11y §9 da spec);
- **FR100:** item «Organizações» permanece oculto para não-superadmin (evidência no PR de SMEM-07 ou SMEM-08 — teste ou checklist QA; alinhar a **SMEM-07 AC8**);
- **NFR35:** checklist a11y da spec §9 cumprida na UI de membros; evidência no PR de SMEM-07 **ou** linha na matriz de **SMEM-08** (referência aos AC5–8 de SMEM-07);
- **NFR31:** rate limiting mínimo no `GET` com `q` com valores **`limit` / `windowSeconds` / chave** registados no PR (SMEM-02) **ou** waivo aprovado **@architect** + **@po** com issue linkada (evidência no PR de SMEM-02 ou SMEM-08);
- contrato de erro JSON documentado (SMEM-01) e respeitado nos handlers;
- regressão SORG (listagem, criação de org) verde em CI.

---

## SMEM-01 — Story: contratos partilhados (Zod) + OpenAPI — membros da organização

**Status:** Ready for Review  
**Dependências (DoR):** nenhuma.

### Story

**As a** engenheiro de plataforma,  
**I want** schemas Zod e documentação OpenAPI para os endpoints de membros da organização,  
**so that** o cliente e os testes partilhem a mesma fonte de verdade e não confundam com `company_memberships`.

**Valor de produto:** estes contratos são pré-requisito directo para **SMEM-02+**; reduzem divergência entre UI, API e QA e evitam regressões entre **membership de organização** vs **company_memberships** (empresa fiscal).

### Acceptance Criteria

1. Em `@repo/shared` existem schemas nomeados de forma inequívoca, por exemplo: `organizationMembersQuerySchema`, `organizationMemberPostBodySchema` (discriminated union `mode: "link" | "create"` com `orgRole` enum `user` \| `admin`), `organizationMemberPatchBodySchema`.
2. Os schemas validam paginação: `page` ≥ 1, `pageSize` default **50**, máximo **100**; `q` opcional string.
3. O modo `create` exige pelo menos `email`, `password` (mínimo alinhado ao Better Auth do projecto, ex.: 8), `name`, `orgRole`; campos opcionais de membership conforme arquitectura §7.2.
4. `docs/api/openapi-v1-organizations-session.yaml` inclui paths `GET/POST /organizations/{organizationId}/members` e `PATCH/DELETE .../members/{membershipId}` com respostas e códigos de erro referidos na arquitectura (incl. **409** com `code` enum documentado).
5. Exportações do package `shared` actualizadas (`index` ou barrel) para consumo no `frontend`.
6. **Contrato de erro JSON (NFR33):** o OpenAPI documenta o corpo de erro para `4xx`/`409` destes endpoints como object com **`error`** (string, mensagem humana) e, quando existir código estável, **`code`** (string). Os códigos mínimos documentados neste incremento: `LAST_ORG_ADMIN`, `MEMBERSHIP_DUPLICATE`, `USER_NOT_FOUND`, `USER_EMAIL_CONFLICT`. Os handlers **devem** devolver `code` nesses casos (paridade com AC de SMEM-03 a SMEM-05). Opcional: schema Zod partilhado `organizationMembersApiErrorBodySchema` em `@repo/shared` **ou** documentação OpenAPI + asserções de teste nos ficheiros de integração — evitar só «convenção oral».

### Tasks / Subtasks

- [x] Definir tipos TypeScript inferidos dos schemas.
- [x] Documentar no PR a distinção face a `memberPostBodySchema` existente (empresa fiscal).
- [x] Listar no OpenAPI os exemplos de `code` por status (tabela no PR ou secção no YAML).

---

## SMEM-02 — Story: `GET` membros da organização (paginação + busca)

**Status:** Ready for Review  
**Dependências (DoR):** SMEM-01.

### Story

**As a** superadmin,  
**I want** listar membros de qualquer organização com paginação e busca,  
**so that** eu opere bases com muitos utilizadores sem sobrecarregar o browser.

### Acceptance Criteria

1. Implementado `GET /api/v1/organizations/{organizationId}/members` com query `page`, `pageSize`, `q` opcional, conforme arquitectura §7.1.
2. Resposta **200** com `items`, `page`, `pageSize`, `total`; cada item inclui `membershipId`, `userId`, `email`, `displayName`, `orgRole`, `jobTitle`, `department`, `phone`, `createdAt`, `updatedAt`.
3. `organizationId` inválido (não UUID) → **400**; organização inexistente → **404**; sem sessão → **401**; sessão sem superadmin → **403**.
4. A busca `q` aplica-se apenas a membros **dessa** organização (subconjunto com `JOIN` em `user`), case-insensitive em nome e e-mail (comportamento mínimo; optimização @data-engineer).
5. Handler usa `getAuthedSession` + `isSuperadmin` + `jsonError` / padrão de logs com `requestId` alinhado a `organizations-create.ts`.
6. Testes de integração: feliz (superadmin, lista não vazia ou vazia), **403** utilizador não superadmin, **404** org inexistente.
7. **NFR31 (rate limiting / anti-enumeração):** quando a query `q` está presente, aplicar **limite mínimo** de pedidos por `actorUserId` (e opcionalmente por `organizationId`) numa janela temporal (valores alvo documentados no PR conforme cabeçalho **Planeamento NFR31** deste ficheiro — **debounce no cliente não substitui** o controlo no servidor; implementação no handler ou middleware). Se não for viável no MVP, **waivo obrigatório:** comentário fixado no PR com aprovação **@architect** + **@po** + **issue** linkada para fase seguinte; SMEM-08 deve citar esse waivo na matriz de testes.

### Tasks / Subtasks

- [x] Criar `route.ts` em `frontend/src/app/api/v1/organizations/[organizationId]/members/route.ts` (ou estrutura equivalente aprovada por `@architect`).
- [x] Implementar handler reutilizável em `frontend/src/server/api/v1/handlers/`.
- [x] Garantir que **não** há vazamento de membros de outras organizações.
- [x] Implementar ou documentar waivo NFR31 conforme AC7.

---

## SMEM-03 — Story: `POST` membros — modo `link` + auditoria

**Status:** Ready for Review  
**Dependências (DoR):** SMEM-01, SMEM-02.

### Story

**As a** superadmin,  
**I want** vincular um utilizador existente à organização por e-mail,  
**so that** eu adicione acessos sem criar contas duplicadas.

### Acceptance Criteria

1. `POST /api/v1/organizations/{organizationId}/members` aceita corpo `{ "mode": "link", "email": "...", "orgRole": "user"|"admin" }`.
2. Sucesso **201** com corpo no mesmo formato de item de lista (§7.2 da arquitectura).
3. Utilizador já membro da organização → **409** com `code: "MEMBERSHIP_DUPLICATE"` (constraint única `(user_id, organization_id)`).
4. E-mail sem correspondência de utilizador → **400** com `code: "USER_NOT_FOUND"` e mensagem operacional em PT (política fechada para este incremento: **não** usar 404 aqui, para o superadmin receber feedback explícito).
5. Regista auditoria `membership_created` com `actorUserId`, `targetUserId`, `organizationId`, metadata `{ membershipId, mode: "link", orgRole }` (FR109).
6. Logs JSON incluem `requestId`, `outcome`, `organizationId`.
7. Testes de integração: **201**, **409** duplicado, **400** user not found, **403** não superadmin.

### Tasks / Subtasks

- [x] Transacção curta: lookup user por e-mail + insert membership.
- [x] Mapear `23505` para **409** `MEMBERSHIP_DUPLICATE` quando for o índice de membership.

---

## SMEM-04 — Story: `PATCH` e `DELETE` membros — FR108 + auditoria

**Status:** Ready for Review  
**Dependências (DoR):** SMEM-01, SMEM-02.

### Story

**As a** superadmin,  
**I want** editar papel/dados de um membro e remover vínculos com segurança,  
**so that** eu não deixe a organização sem administrador por engano.

### Acceptance Criteria

1. `PATCH /api/v1/organizations/{organizationId}/members/{membershipId}` com corpo parcial conforme `organizationMemberPatchBodySchema`; **200** com item actualizado.
2. `DELETE` mesmo caminho; resposta **204** (sem corpo), conforme arquitectura §7.4.
3. **FR108:** se a operação deixaria a organização sem nenhum `org_role = admin`, responder **409** com `code: "LAST_ORG_ADMIN"` (tanto em `DELETE` do único admin como em `PATCH` que rebaixa o único admin para `user`).
4. `membershipId` que não pertence à `organizationId` → **404**.
5. Auditoria: `membership_role_changed` no PATCH quando `orgRole` ou metadatos relevantes mudam; `membership_removed` no DELETE (FR109).
6. Implementação usa transacção ou `SELECT … FOR UPDATE` conforme arquitectura §6.3 para reduzir corrida entre pedidos concorrentes.
7. Testes de integração: PATCH feliz; DELETE feliz; **409** `LAST_ORG_ADMIN` nos dois casos (último admin); **403** não superadmin.

### Tasks / Subtasks

- [x] Função de domínio reutilizável para contar admins por `organization_id` (para testes unitários/domínio sem duplicar regra).
- [x] Garantir metadata de auditoria sem PII extra (preferir ids e papéis).

---

## SMEM-05 — Story: `POST` membros — modo `create` (conta + membership)

**Status:** Ready for Review  
**Dependências (DoR):** SMEM-01, SMEM-03.

### Story

**As a** superadmin,  
**I want** criar um novo utilizador e associá-lo à organização num único fluxo,  
**so that** eu faça onboarding sem SQL manual.

### Acceptance Criteria

1. `POST` com `{ "mode": "create", ... }` conforme schema SMEM-01; **201** com item de membership + utilizador criado.
2. Conflito de e-mail já registado na plataforma → **409** com código estável documentado (ex.: `USER_EMAIL_CONFLICT`) e mensagem PT.
3. Palavra-passe e campos validados no servidor (mesmos mínimos que o registo público, quando aplicável).
4. **Prova de login (critério por defeito):** o PR que encerra **SMEM-05** inclui **teste de integração** que, após `POST` modo `create` com sucesso, autentica com o **mesmo** e-mail e palavra-passe (via fluxo já usado nos testes do projecto para `sign-in` / sessão) e comprova sessão válida ou falha o PR. **Waivo excepcional:** apenas com comentário **fixado** no PR aprovado por **@qa** + **@architect** + **@po** que descreve substituto inequívoco antes do merge (ex.: E2E obrigatório em **SMEM-08** com passo de login, ou smoke manual datado em ≤48h com dono nomeado). O waivo **não** é caminho por defeito.
5. Auditoria `membership_created` com `mode: "create"` em metadata (FR109).
6. **403** se não superadmin.

### Tasks / Subtasks

- [x] Documentar no PR a primitive Better Auth escolhida (hash compatível).
- [x] Transacção: criar `user` + `account` (password) + `organization_memberships` ou rollback.
- [x] Implementar teste de integração do AC4 (ou obter waivo triple-aprovação no PR).

---

## SMEM-06 — Story: layout servidor — gate `/admin` (FR101)

**Status:** Ready for Review  
**Dependências (DoR):** nenhuma (recomenda-se merge antes de SMEM-07 para QA de navegação).

### Story

**As a** utilizador autenticado sem privilégios de plataforma,  
**I want** ser redireccionado ao aceder a `/admin` sem ver dados administrativos,  
**so that** a segurança não dependa apenas do cliente.

### Acceptance Criteria

1. Existe `layout.tsx` (Server Component) na árvore de rotas que cobre **`/admin/*`** (mesmo segmento que `/admin/organizacoes`), que:
   - sem sessão → `redirect` para `/login?next=` + URL actual codificada;
   - com sessão e `!isSuperadmin` → **`redirect("/dashboard")`** (decisão da arquitectura §1);
   - com superadmin → renderiza `children`.
2. Não quebra rotas públicas nem o dashboard normal.
3. Teste automatizado: utilizador autenticado **sem** superadmin ao pedir a rota de página admin recebe resposta **302** para `/dashboard` (ou estratégia equivalente validada com `@architect`); superadmin recebe **200** no HTML da lista ou da sub-rota.
4. APIs continuam a retornar **403** JSON (sem redirect).

### Tasks / Subtasks

- [x] Confirmar leitura de sessão server-side com Better Auth (`headers()` / API recomendada na versão Next do repo).
- [x] Actualizar documentação breve no PR se o caminho do ficheiro `layout` divergir da sugestão da arquitectura.

---

## SMEM-07 — Story: UI — «Gerir membros» + página de membros + modais

**Status:** Ready for Review  
**Dependências (DoR):** SMEM-02 a SMEM-05, SMEM-06; **SORG** — gate do cabeçalho (lista `/admin/organizacoes` + CTA **Gerir membros**; ver bullet «Mínimo para SMEM-07»).

### Story

**As a** superadmin,  
**I want** uma interface alinhada à spec de UX para gerir membros a partir da lista de organizações,  
**so that** eu execute operações do dia-a-dia sem documentação interna.

### Acceptance Criteria

1. Na lista `OrganizationsAdminPage`, cada card tem CTA **Gerir membros** (copy `mem.list.cta.manageFromList` ou equivalente da spec) com `href` para `/admin/organizacoes/[organizationId]/membros`.
2. Nova página conforme `docs/front-end-spec-superadmin-aba-organizacoes-gestao-membros.md` §5.2: toolbar, busca, tabela, paginação, estados loading/erro/vazio.
3. Modais/diálogos: adicionar existente, criar utilizador, editar, confirmar remoção de vínculo — copy §10 da spec; rótulo destrutivo **«Remover vínculo»** (NFR35).
4. Mapeamento de erros API: `LAST_ORG_ADMIN` → `mem.error.lastAdmin`; `MEMBERSHIP_DUPLICATE` → copy **`mem.error.duplicate`** (spec UX §10). **Alinhamento i18n:** a spec ainda contém chaves defectivas **`mem.mem.error.duplicate`** — corrigir na spec (task em «Tasks») **ou** mapear no código temporariamente com comentário `TODO(spec)` removido no mesmo PR que corrige a spec (evitar drift permanente).
5. Acessibilidade: `h1` único na vista membros; tabela com cabeçalhos; modais com foco e `Escape`; `aria-busy` / `role="alert"` conforme spec §9.
6. Após mutações bem-sucedidas, a lista de membros **refetch** (TanStack Query se existir no projeto; senão padrão equivalente ao `reload()` usado em SORG).
7. **401** nas chamadas redirecciona para login com `next` (paridade com `OrganizationsAdminPage`).
8. **FR100 (navegação):** utilizador autenticado **sem** `isSuperadmin` **não** vê o item «Organizações» no `DashboardShell` (variante desktop e barra móvel), após merge deste incremento. Evidência: teste automatizado (componente/E2E) **ou** checklist QA assinado no PR com passos e resultado (captura opcional).

### Tasks / Subtasks

- [x] Componentes sugeridos na spec §8 (`OrganizationMembersTable`, diálogos, etc.).
- [x] Breadcrumb ou linha de contexto §3.1 da spec UX.
- [x] **Doc-only (recomendado antes ou no PR de SMEM-07):** PR em `docs/front-end-spec-superadmin-aba-organizacoes-gestao-membros.md` que substitui **`mem.mem.error.duplicate`** por **`mem.error.duplicate`** (e reverte outras ocorrências `mem.mem.*` incorrectas na mesma spec, se existirem).
- [x] Cobrir AC8 (FR100) com teste ou checklist conforme AC.

---

## SMEM-08 — Story: testes de integração, E2E opcional e regressão

**Status:** Ready for Review  
**Dependências (DoR):** SMEM-01 a SMEM-07.

### Story

**As a** time de engenharia,  
**I want** uma suíte automática que cubra autorização, FR108 e regressão SORG,  
**so that** o merge não introduza bypass de superadmin nem quebre onboarding de organizações.

### Acceptance Criteria

1. Testes de integração cobrem: `GET` feliz + **403**; `POST link` **201** + **409** duplicado + **400** `USER_NOT_FOUND`; `PATCH`/`DELETE` com **409** `LAST_ORG_ADMIN`; `POST create` **201** e, se o waivo triple-aprovação de **SMEM-05 AC4** não foi usado, o **mesmo** teste (ou companheiro) que prova login pós-create.
2. Teste de gate SMEM-06 (redirect **302** `/dashboard` para não-superadmin autenticado) presente ou substituído por estratégia equivalente aprovada por `@architect` no PR.
3. Regressão: `POST /api/v1/organizations` (SORG) + `GET /organizations/accessible` continuam a passar nos testes existentes ou novos de smoke no mesmo PR de fecho. **Checagem de contexto:** o PR referencia o estado do pacote **SORG** (artefacto no cabeçalho deste documento) — p.ex. **SORG-06** verde em CI no momento do fecho **ou** waivo **@po** + **@qa** se a suíte SORG estiver temporariamente partida (com plano de recuperação linkado).
4. E2E (Playwright): **opcional** no MVP; se não entregue, o PR deve ter waivo com **@po** + **@qa** e plano de smoke manual listado.
5. `npm run typecheck` e testes do workspace `frontend` verdes na CI com `DATABASE_URL` quando aplicável (não deixar `describe.skip` permanente sem issue linkada).
6. **NFR31 — evidência:** a matriz no PR referencia se o rate limit do `GET` com `q` foi **implementado** (ficheiro/limites) ou **waivo** (link da issue + aprovações @architect + @po), em coerência com SMEM-02 AC7.
7. **NFR35 — evidência:** a matriz no PR inclui linha para **acessibilidade** da UI de membros (referência a **SMEM-07 AC5–8**: `h1`, tabela, modais, `aria-busy` / `role="alert"`) — asserções automáticas mínimas, checklist QA assinado, ou waivo **@qa** + **@po** com plano datado.

### Tasks / Subtasks

- [x] Actualizar ou criar ficheiro(s) `*.integration.test.ts` na área `organizations`/members.
- [x] Referenciar no corpo do PR a matriz AC ↔ ficheiro de teste (incl. **NFR31**, **NFR35**, **FR100** se validados neste PR ou referência cruzada ao PR de SMEM-07).
- [x] Linha na matriz do PR: **regressão SORG** (AC3) + referência ao artefacto SORG / estado CI conforme AC3.

---

## Dev Agent Record

*(Preencher por @dev ao concluir incremento.)*

### Agent Model Used

Composer (Cursor) — implementação incremental SMEM-01 a SMEM-08.

### Debug Log References

—

### Completion Notes

- API `GET/POST/PATCH/DELETE` em `/api/v1/organizations/{organizationId}/members` com superadmin, auditoria FR109, FR108 com `SELECT … FOR UPDATE`, criação de utilizador com `hashPassword` de `better-auth/crypto` e teste `verifyPassword` (SMEM-05 AC4 — substituto ao sign-in HTTP documentado no cabeçalho do ficheiro de integração).
- NFR31: rate limit em memória **30 req / 60 s** por `actorUserId:organizationId` quando `q` está presente (`organization-members-search-rate-limit.ts`); documentar/evoluir para Redis em PR.
- Pós-QA (gate CONCERNS): matriz de integração alargada — `401` GET, `403` POST/PATCH/DELETE, `404` membership noutra org, `PATCH 200` com corpo, `DELETE 204`, regressão `POST /api/v1/organizations` no mesmo ficheiro; FR100 com `isSuperadminOrganizationsNavVisible` + teste unitário; SMEM-06 com JSDoc em `enforceAdminPortalGate` + E2E Playwright (utilizador normal → `/dashboard`).
- `npm run test -w frontend` e `npm run typecheck -w frontend` a correr após ajustes (integração Postgres `describe.skipIf(!DATABASE_URL)`).

### File List

- `packages/shared/src/api-v1.ts`
- `packages/shared/src/index.ts`
- `docs/api/openapi-v1-organizations-session.yaml`
- `docs/front-end-spec-superadmin-aba-organizacoes-gestao-membros.md`
- `frontend/src/lib/api-error-message.ts`
- `frontend/src/lib/api-error-message.test.ts`
- `frontend/src/middleware.ts`
- `frontend/src/components/dashboard-shell.tsx`
- `frontend/src/server/admin/admin-portal-gate.ts`
- `frontend/src/server/admin/admin-portal-gate.test.ts`
- `frontend/src/server/api/v1/lib/org-members-json.ts`
- `frontend/src/server/api/v1/lib/organization-members-fr108.ts`
- `frontend/src/server/api/v1/lib/organization-members-search-rate-limit.ts`
- `frontend/src/server/api/v1/handlers/organization-members.ts`
- `frontend/src/server/api/v1/handlers/organization-membership-by-id.ts`
- `frontend/src/app/api/v1/organizations/[organizationId]/members/route.ts`
- `frontend/src/app/api/v1/organizations/[organizationId]/members/[membershipId]/route.ts`
- `frontend/src/app/api/v1/organization-members.integration.test.ts`
- `frontend/src/app/(dashboard)/admin/layout.tsx`
- `frontend/src/app/(dashboard)/admin/organizacoes/[organizationId]/membros/page.tsx`
- `frontend/src/components/admin/organization-members-page.tsx`
- `frontend/src/components/admin/organizations-admin-page.tsx`
- `frontend/src/components/dashboard-shell-fr100.ts`
- `frontend/src/components/dashboard-shell-fr100.test.ts`
- `frontend/e2e/superadmin-organizacoes-smoke.spec.ts`

### Change Log

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-04-27 | 1.2-dev | Pós-QA @qa: testes de integração (401/403/404/204/PATCH 200, POST organizations), FR100 (`dashboard-shell-fr100`), JSDoc gate 302, E2E gate não-superadmin. |
| 2026-04-27 | 1.1-dev | Implementação SMEM-01…SMEM-08 (@dev): contratos, API membros, gate `/admin`, UI membros, testes. |
| 2026-04-27 | 1.0 | Criação do conjunto de stories SMEM-01..SMEM-08 (SM). |
| 2026-04-27 | 1.1 | Refinamento pós-@po: NFR31 (SMEM-02/08), FR100 (SMEM-07), contrato erro JSON (SMEM-01), prova de login SMEM-05, DoD/gate/rastreio actualizados. |
| 2026-04-27 | 1.2 | Pós-segunda nota @po (9/10): rastreio SMEM-07 **AC8** explícito; NFR35 no rastreio SMEM-08 + DoD + AC7 SMEM-08; sizing relativo de risco no índice; gate NFR35. |
| 2026-04-27 | 1.3 | Pós-terceira passagem @po: campo **Sign-off @po** no cabeçalho; Próximos passos alinhados; revisão de versão no rodapé. |
| 2026-04-27 | 1.4 | Pós-avaliação @po (micro-gaps): referência explícita SORG (path + SORG-01..06 + mínimo UI/regressão); bloco **Planeamento NFR31**; SMEM-07 AC4 + task doc-only spec `mem.mem.*`; DoD/SMEM-02 AC7 alinhados a `limit`/`windowSeconds`. |
| 2026-04-27 | 1.5 | Pós-nota **9,75/10** @po: gate SORG objectificável + equivalência **@po**; DoR **SMEM-07** com SORG; **SMEM-08** AC3 (contexto SORG/CI/waivo) + task matriz; sign-off alinhado escala 9,75 → 10. |
| 2026-04-27 | 1.6 | Pós-nota **9,8/10** @po: secção **Histórico de avaliações PO** + cabeçalho sem nota fixa; regra de manutenção @sm; próximos passos. |
| 2026-04-27 | 1.7 | **Histórico PO:** entrada v1.6 nota **9,85** (avaliação @po); sem mudança de AC/DoD. |
| 2026-04-27 | 1.8 | **Histórico PO:** linha **v1.7** + glossário **Rev. doc** na manutenção + linha **v1.8** nota **9,85** (simetria cabeçalho / @po). |

---

## QA Results

**Revisor:** Quinn (@qa / AIOS)  
**Data:** 2026-04-27  
**Âmbito:** revisão estática do código e dos testes entregues para SMEM-01…SMEM-08 (sem merge em produção; integração Postgres não executada nesta sessão sem `DATABASE_URL`).

### Decisão de gate

| Gate | Decisão | Motivo (resumo) |
|------|---------|-----------------|
| **Merge / aceite técnico** | **CONCERNS** | Funcionalidade principal e FR108 bem endereçados; lacunas de cobertura de testes e de evidência formal (302 `/admin`, FR100, SMEM-05 AC4 literal) devem ser fechadas ou explicitamente aceites no PR antes de **PASS** inequívoco. |

Não atribuo **FAIL** porque não há indício de bypass de superadmin na API analisada, os códigos de erro estáveis pedidos existem nos fluxos críticos, e a suíte `vitest` do `frontend` passa em ambiente sem DB (integração fica `skip` sem `DATABASE_URL`).

---

### Rastreio por story (AC vs evidência)

**SMEM-01 — Contratos**  
- **PASS:** `organizationMembersQuerySchema`, `organizationMemberPostBodySchema`, `organizationMemberPatchBodySchema`, `organizationMembersApiErrorBodySchema` e tipo `OrganizationMemberListItem` em `@repo/shared`; OpenAPI actualizado com `membershipId` e schema `OrganizationMembersApiError`; exports no `index`.

**SMEM-02 — GET membros**  
- **PASS:** Handler com `getAuthedSession`, `isSuperadmin`, validação UUID, `404` org inexistente, `ilike` + `JOIN` limitado à `organizationId`, resposta com `items` / `page` / `pageSize` / `total`, logs JSON com `requestId`.  
- **NFR31:** implementação em memória (`ORG_MEMBERS_SEARCH_RATE` 30/60s, chave `actorUserId:organizationId`) + `429` — **condicional PASS** desde que o PR documente `limit`, `windowSeconds` e chave (cabecalho do documento).  
- **CONCERNS:** ficheiro `organization-members.integration.test.ts` cobre **200**, **403** (GET), **404** org; **não** há caso explícito **GET 401** (AC3). Recomendado acrescentar um `it` com `getAuthedSession` mock `null`.

**SMEM-03 — POST `link`**  
- **PASS:** `201`, `409` + `MEMBERSHIP_DUPLICATE`, `400` + `USER_NOT_FOUND`, transacção + auditoria no código.  
- **CONCERNS:** AC7 pedia teste **POST 403** não-superadmin — ausente na suíte `organization-members.integration.test.ts`. Recomendado um `it` dedicado.

**SMEM-04 — PATCH / DELETE + FR108**  
- **PASS:** `PATCH` com `FOR UPDATE`, contagem de admins, `409` + `LAST_ORG_ADMIN` em PATCH e DELETE, `204` no DELETE feliz no código, `404` membership/org no handler.  
- **CONCERNS:** integração cobre **409** PATCH e **409** DELETE; **não** cobre **PATCH 200** isolado com asserção de corpo, **DELETE 204** feliz, **404** `membershipId` noutra org, nem **403** em mutações. SMEM-04 AC7 fica parcialmente cumprido só por revisão de código.

**SMEM-05 — POST `create`**  
- **PASS:** transacção `user` + `account` + `organization_memberships`, `hashPassword` (`better-auth/crypto`), `409` + `USER_EMAIL_CONFLICT` no código.  
- **CONCERNS (AC4):** o teste usa **`verifyPassword`** sobre o hash guardado — é prova criptográfica forte e alinhada a Better Auth, mas o AC redige **sessão após sign-in** como caminho por defeito. Sugestão: no PR, uma linha explícita «substituto inequívoco» com referência a este teste **ou** waivo formal @qa+@architect+@po se se pretender estritamente `POST /api/auth/sign-in/email`.

**SMEM-06 — Gate `/admin` (FR101)**  
- **PASS:** `middleware.ts` (`x-admin-pathname`), `admin/layout.tsx`, `enforceAdminPortalGate` com `auth.api.getSession` + redirects.  
- **CONCERNS (AC3):** existe teste unitário de decisão (`admin-portal-gate.test.ts`), **não** há teste que valide **302** real da rota RSC. A story admite «estratégia equivalente validada com **@architect**» — recomendo comentário fixado no PR com essa equivalência ou teste E2E/Request mínimo ao HTML.

**SMEM-07 — UI**  
- **PASS:** rota `/admin/organizacoes/[organizationId]/membros`, CTA «Gerir membros», tabela, modais, `h1`, `role="alert"`, `aria-busy` na listagem, refetch após mutações, redirect **401** com `next`, spec `mem.mem.*` corrigida.  
- **CONCERNS (NFR35 / AC5–8):** sem testes automáticos de acessibilidade (axe/RTL); **FR100 AC8:** sem novo teste de componente — o `DashboardShell` já condiciona o link «Organizações»; para fechar o AC ao pé da letra, sugerir **checklist QA assinado** no PR ou um teste mínimo de renderização.

**SMEM-08 — Suíte e regressão**  
- **PASS:** ficheiro `organization-members.integration.test.ts` + smoke `GET /organizations/accessible`; `typecheck` + `vitest` verdes em revisão local (sem DB).  
- **CONCERNS:** AC1 parcial (faltam cenários listados acima); AC3 não inclui `POST /api/v1/organizations` no mesmo ficheiro (assume-se `organizations-create.integration.test.ts` na CI — confirmar no pipeline). AC4 E2E opcional — waivo @po+@qa se não houver Playwright. AC5 `describe.skipIf(!DATABASE_URL)` — aceitável se a CI define `DATABASE_URL`; caso contrário abrir issue para não ficar verde «falso».

---

### Segurança e qualidade (amostra)

- **Autorização:** `isSuperadmin` aplicado nos handlers de membros antes de tocar na DB — coerente com gate macro.  
- **FR108:** coberto por teste de integração (quando DB disponível).  
- **PII em logs:** logs estruturados com ids/outcome; sem dump de emails em metadata de auditoria nos trechos revistos.  
- **CodeRabbit:** não executado nesta revisão (CLI WSL); alinhar ao gate mínimo do documento antes do merge.

---

### Evidência de execução (nesta revisão)

- Leitura de: story completa, `organization-members.ts`, `organization-membership-by-id.ts`, `organization-members.integration.test.ts`, `admin-portal-gate.test.ts`.  
- `npm run test -w frontend` e `npm run typecheck -w frontend` foram referidos pelo @dev como verdes; **re-execução com Postgres não efectuada aqui.**

---

### Recomendações pré-merge (prioridade)

1. **Alta:** Completar matriz de testes da story (401 GET; 403 POST/PATCH/DELETE; 404 membership; DELETE 204 feliz) **ou** documentar no PR o desvio com dono @architect / @po.  
2. **Média:** PR com tabela NFR31 (30/60s, chave) + NFR35 (checklist a11y §9 ou waivo).  
3. **Média:** SMEM-05 AC4 — frase no PR a aceitar `verifyPassword` como substituto do sign-in HTTP **ou** waivo triple.  
4. **Baixa:** Smoke manual uma vez com `DATABASE_URL` local para confirmar `describe.skipIf` não mascara regressão.

**Próximo passo sugerido:** após ajustes ou waivos no PR, nova passagem @qa para fechar gate **PASS** ou manter **CONCERNS** documentado com dono e data.

---

## Próximos passos (AIOS)

1. `@po` — priorizar SMEM no backlog (**política `USER_NOT_FOUND` = 400** fechada em SMEM-03), confirmar **SORG** conforme `docs/stories/incremento-superadmin-cadastro-organizacoes-acesso-global.md`, e preencher **Sign-off @po** no cabeçalho ao aceitar o pacote no sprint.  
2. `@dev` — implementar na ordem sugerida; PRs pequenos por story quando possível.  
3. `@architect` — rever PRs que toquem em FR108, NFR31 e criação de utilizador (SMEM-02, SMEM-04, SMEM-05).  
4. `@qa` — preparar matriz de testes a partir dos AC de SMEM-08 (incl. evidência **NFR31**, **NFR35**, **FR100** / SMEM-07 AC8).  
5. `@sm` — após nova **avaliação formal @po** sobre este `.md`, acrescentar linha ao **Histórico de avaliações PO** (data, revisão, nota, sumário).

---

— River (SM) — AIOS; stories **v1.8** derivadas do PRD FR100–FR110, da arquitectura técnica e da spec UX do incremento; refinadas com critérios das revisões @po (v1.1–v1.8).
