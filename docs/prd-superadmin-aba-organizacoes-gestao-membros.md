# PRD — Incremento: aba «Organizações» reforçada e gestão de membros por superadmin

**Documento:** requisitos do incremento descrito em `docs/briefing-superadmin-aba-organizacoes-gestao-membros.md`.  
**Normativa integrada:** `docs/prd.md` (quando aplicável), `docs/prd-atualizacao-login-empresas-roles.md` (papéis, remoção = vínculo, auditoria), `docs/prd-superadmin-cadastro-organizacoes-acesso-global.md` (FR41–FR50, criação de organizações), `docs/prd-atualizacao-dois-niveis-organizacao-vs-empresas-fiscais.md` (organização vs. empresa fiscal).  
**Em caso de conflito:** prevalece a matriz de segurança mais restritiva; remoção de membro **nunca** implica eliminação global de conta neste MVP salvo secção explícita «fora de âmbito» revista por PM.

**Change log (este incremento):**

| Data       | Versão | Descrição | Autor |
| ---------- | ------ | --------- | ----- |
| 2026-04-27 | 1.0    | PRD inicial: gate servidor `/admin`, APIs e UI de membros ao nível da organização, salvaguarda do último admin, auditoria. | PM (Morgan / AIOS) |

**Numeração de requisitos:** utilizam-se **FR100+** e **NFR30+** neste documento para evitar colisão com outros PRDs incrementais até harmonização global em `docs/prd.md`.

---

## 1. Objetivos de produto

1. Garantir que a experiência **«Organizações»** (`/admin/organizacoes`) seja inequivocamente **exclusiva de superadmin**, incluindo quando o URL é acedido directamente.
2. Permitir que o superadmin **opere membros** de qualquer organização da plataforma: consultar, adicionar vínculos, criar utilizador com vínculo, alterar papel e metadados de membership, remover vínculo — sem apagar conta global no MVP.
3. Proteger a operação com **regra de negócio** que impeça remover ou rebaixar o **último administrador local** (`org_role = admin`) sem substituto na mesma organização.
4. Assegurar **rastreabilidade** (auditoria + logs correlacionáveis) em todas as mutações de membership iniciadas por superadmin.
5. Reduzir dependência de scripts SQL ou suporte técnico para correcções de acesso às organizações.

**Métrica de sucesso sugerida:** 100% das operações de adição/remoção/alteração de membros por superadmin realizáveis via produto, com eventos de auditoria gravados, durante o piloto definido pelo time.

---

## 2. Contexto e problema

O produto já dispõe de:

- item de navegação **«Organizações»** mostrado apenas quando `isSuperadmin` é obtido via `GET /api/v1/me` no cliente;
- página administrativa que bloqueia utilizadores não superadmin com mensagem de acesso negado;
- criação de organizações e listagem com **contagem de membros** (`memberCount`);
- modelo de dados `organization_memberships` com `org_role` (`user` \| `admin`, alinhado ao enum existente);
- tipos de auditoria em código: `membership_created`, `membership_removed`, `membership_role_changed` (`frontend/src/lib/audit.ts`).

**Lacunas:**

1. Não existe **gate no servidor** (ex.: `layout` sob `admin/`) que devolva **403** ou redireccione **antes** de hidratar a página para utilizadores autenticados sem superadmin.
2. Não existe **UI nem API pública v1** para CRUD de membros ao nível da **organização** na área superadmin; a operação depende de meios externos.

**Impacto:** maior carga em suporte, risco de inconsistência de acessos, e percepção de segurança mais fraca (URL conhecido + confiança só no cliente).

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| Âmbito de «membro» | Apenas **`organization_memberships`** (tenant). **Não** inclui `company_memberships` neste incremento. |
| Quem pode listar/mutar membros por organização | Apenas **`isSuperadmin === true`**. Admins locais continuam com fluxos próprios (futuro ou PRD de login) sem ampliar escopo aqui. |
| «Remover membro» / «Excluir» | Significa **eliminar vínculo** (linha de membership). **Não** elimina a linha `user` global no MVP. |
| «Criar membro» | Criar **conta de utilizador** (mecanismo Better Auth / convite já adoptado no projecto) **e** membership na organização alvo, **ou** vincular utilizador existente por identificador estável (`userId` / email conforme API). |
| Último admin | **Proibido** remover membership do último `org_role = admin` **e** proibido alterar o seu papel para `user` se não existir outro admin na mesma organização (**FR108**). |
| Criação de organização sem admin local | Permanece permitida (FR50); este incremento **facilita** correcção posterior via gestão de membros. |
| Paginação da lista de membros | Obrigatória se o número de membros exceder limiar definido por `@architect` (default sugerido: 50 por página). |

---

## 4. Fora de âmbito (este incremento)

- RBAC fino além de `user` / `admin` ao nível da organização.
- Gestão de membros por **empresa fiscal** (`company_memberships`) e rotas `/empresas/:id/usuarios` como extensão deste PRD.
- **Eliminação permanente de conta global** (LGPD / offboarding completo).
- Alteração de flag **`is_superadmin`** via esta UI (mantém-se processo operacional ou UI dedicada futura).
- Notificações por e-mail transaccional **ricas** (se a infra não existir, o fluxo de criação deve degradar com mensagem clara — alinhado a `docs/prd-atualizacao-login-empresas-roles.md`).

---

## 5. Personas e impactos

| Persona | Necessidade | Resultado esperado |
| ------- | ----------- | ------------------ |
| Superadmin operacional | Corrigir acessos e papéis sem BD | Usa `/admin/organizacoes`, abre membros, adiciona/remove/ajusta |
| Admin local da organização | Não perder controlo inadvertidamente | Regra do último admin impede lockout acidental |
| Utilizador final | Previsibilidade de conta | Conta global permanece ao remover vínculo; pode voltar a ser convidado |
| Auditoria / compliance | Rastrear quem alterou o quê | Eventos com actor, target, `organization_id`, metadata segura |

---

## 6. Escopo funcional detalhado

### 6.1 Navegação e gate de rota

- Manter o item **«Organizações»** visível **somente** para superadmin no `DashboardShell` (comportamento actual preservado).
- Introduzir **verificação no servidor** para todas as rotas sob `/admin/*` (ou pelo menos `/admin/organizacoes` e sub-rotas): sessão válida + `isSuperadmin`; caso negativo: **403** ou redirecção para `/dashboard` com política de produto única documentada na story de implementação.

### 6.2 Listagem de membros

- A partir do contexto de uma organização seleccionada na UI admin, o superadmin vê **lista paginada** de membros com: identificação do utilizador (nome e email conforme política de privacidade já usada no produto), `org_role`, campos opcionais de membership (`job_title`, `department`, `phone`), datas relevantes.
- Campo de **busca** por texto (nome/email) quando a API suportar.

### 6.3 Adicionar membro existente

- Fluxo: indicar **email** ou **userId** (o que o contrato API fixar), escolher `org_role`, confirmar.
- Conflito: utilizador já membro da organização → **409** com mensagem clara.

### 6.4 Criar utilizador e adicionar

- Fluxo: dados mínimos de criação de utilizador + `org_role` + opcionais de membership.
- Erro de email duplicado → **409** ou **400** conforme padrão do projecto, com copy compreensível.

### 6.5 Editar membership

- Alterar `org_role` e/ou metadados (`job_title`, `department`, `phone`).
- Aplicar a mesma regra **FR108** ao rebaixar admin.

### 6.6 Remover vínculo

- Confirmação modal obrigatória na UI.
- Após sucesso, o utilizador deixa de ver a organização na lista de contextos (salvo superadmin global).

---

## 7. Requisitos funcionais (incremento)

| ID | Descrição |
| -- | --------- |
| **FR100** | O sistema deve manter o item de navegação **«Organizações»** oculto para utilizadores sem `isSuperadmin` (paridade desktop e navegação móvel do shell). |
| **FR101** | Pedidos **GET** à rota de página `/admin/organizacoes` (e sub-rotas administrativas de membros, se existirem) devem ser **autorizados no servidor** para superadmin apenas; utilizador autenticado sem superadmin deve receber **403** ou ser **redireccionado** para `/dashboard` conforme decisão única registada na story de implementação. |
| **FR102** | O sistema deve expor operação **listar membros** de uma organização por `organizationId`, restrita a `isSuperadmin`, com **paginação** e resposta estável documentada em OpenAPI. |
| **FR103** | O superadmin deve poder **adicionar** um vínculo (`organization_memberships`) para um utilizador **existente** (por email ou `userId` canónico), com `org_role` válido; utilizador já vinculado → **409**. |
| **FR104** | O superadmin deve poder **criar** um novo utilizador na plataforma e **criar** o membership na organização num fluxo único ou orquestrado documentado; falhas de validação → **400**; conflito de identidade → **409** quando aplicável. |
| **FR105** | O superadmin deve poder **atualizar** `org_role` e campos opcionais de membership (`job_title`, `department`, `phone`) para um `membershipId` pertencente à `organizationId` indicada. |
| **FR106** | O superadmin deve poder **remover** um vínculo (`DELETE` lógico ou físico da linha de membership) **sem** apagar o registo global `user`. |
| **FR107** | Utilizador sem `isSuperadmin` que invoque as operações **FR102–FR106** deve receber **403** em todas as tentativas. |
| **FR108** | O sistema deve **recusar** remoção de membership e **recusar** alteração de `org_role` de `admin` para `user` quando essa operação deixaria a organização **sem** pelo menos um membership com `org_role = admin` (código **409** ou **400** com código de erro estável para a UI). |
| **FR109** | Para cada mutação bem-sucedida em membership (**criar**, **remover**, **alterar papel**), o sistema deve registar evento na trilha de auditoria com `actor_user_id`, `target_user_id` quando aplicável, `organization_id`, `event_type` alinhado a `membership_*`, e **metadata** mínima (ex.: `membershipId`, `previousRole`, `nextRole`, `source`). |
| **FR110** | A UI administrativa deve permitir abrir a gestão de membros a partir da **lista de organizações** (painel, modal, ou página de detalhe `/admin/organizacoes/[id]`) com estados de carregamento, erro recuperável e confirmação explícita para remoções. |

---

## 8. Requisitos não funcionais

| ID | Descrição |
| -- | --------- |
| **NFR30** | Todas as decisões de autorização para **FR101–FR107** devem ser **replicadas no servidor**; o cliente não é fonte de verdade para privilégio. |
| **NFR31** | Logs estruturados das operações **FR102–FR106** devem incluir correlacionação com auditoria (request id, actor id, organization id). |
| **NFR32** | Testes automatizados devem cobrir caminhos **feliz**, **403** (não superadmin), **FR108** (último admin), e **409** (duplicidade de membership). |
| **NFR33** | Mensagens de erro devem ser **legíveis para operação** e **sem** stack trace ou detalhes internos de infraestrutura em respostas HTTP. |
| **NFR34** | O incremento deve manter **compatibilidade** com listagem de organizações acessíveis e fluxos **SORG** existentes (`POST /organizations`, `active-organization`, etc.). |
| **NFR35** | **Acessibilidade (WCAG AA alvo):** tabela ou lista de membros com cabeçalhos associados; modais com foco preso e retorno de foco; botões destrutivos com confirmação e rótulo claro («Remover vínculo», não apenas «Eliminar»). |

---

## 9. Objectivos de UX / UI (visão)

| Área | Orientação |
| ---- | ------------ |
| **Visão geral** | Fluxo operacional rápido: poucos cliques desde a lista de organizações até à acção sobre um membro. |
| **Paradigma** | Lista + painel lateral ou modal; confirmação para acções destrutivas; feedback inline para erros de API. |
| **Ecrãs principais** | Lista de organizações (existente) + **superfície de membros** (nova); opcional página de detalhe da organização dedicada ao superadmin. |
| **Branding** | Reutilizar tokens e padrões do `DashboardShell` (realce emerald, tipografia `text-sm`). |

---

## 10. Pressupostos técnicos (para `@architect`)

- Monorepo actual com `frontend` (Next.js App Router), APIs em `/api/v1`, Drizzle/`@repo/db`, Better Auth para identidade.
- Tabelas `organizations`, `organization_memberships`, `user` já existentes; enum de papel compatível com `org_role`.
- Documentação OpenAPI em `docs/api/openapi-v1-organizations-session.yaml` (ou ficheiro agregador adoptado pelo repositório) deve ser **actualizada** com os novos paths.

---

## 11. Fluxos principais

### 11.1 Fluxo feliz — adicionar membro existente

1. Superadmin abre **Organizações**.
2. Selecciona **Membros** numa organização.
3. Escolhe **Adicionar membro existente**, informa email, escolhe papel, confirma.
4. API cria membership, audita, devolve **201**.
5. Lista actualiza com o novo membro.

### 11.2 Fluxo feliz — criar utilizador e vincular

1. Superadmin escolhe **Criar utilizador e adicionar**.
2. Preenche dados mínimos e papel.
3. API cria utilizador + membership (ou convite + membership, conforme arquitectura).
4. UI confirma sucesso; lista actualiza.

### 11.3 Fluxo bloqueado — último admin

1. Superadmin tenta remover o único admin ou rebaixá-lo.
2. API responde **409** (ou **400** com código estável).
3. UI mostra mensagem explicando a necessidade de promover outro admin primeiro.

### 11.4 Fluxo de acesso indevido

1. Utilizador sem superadmin navega para `/admin/organizacoes`.
2. Servidor responde **403** ou redirecciona para `/dashboard`.
3. Nenhum dado de organizações ou membros é renderizado em HTML inicial.

---

## 12. Contratos de API (referência de produto)

> Caminhos finais podem ser ajustados por `@architect` mantendo a semântica e os códigos HTTP.

| Método | Caminho (exemplo) | Permissão | Notas |
| ------ | ----------------- | ----------- | ----- |
| `GET` | `/api/v1/organizations/{organizationId}/members` | Superadmin | Query: `page`, `pageSize`, `q` |
| `POST` | `/api/v1/organizations/{organizationId}/members` | Superadmin | Corpo: convite/ email+password policy / `userId` — definir schema Zod partilhado |
| `PATCH` | `/api/v1/organizations/{organizationId}/members/{membershipId}` | Superadmin | Corpo parcial: role + metadados |
| `DELETE` | `/api/v1/organizations/{organizationId}/members/{membershipId}` | Superadmin | Aplicar **FR108** |

**Erros comuns:** `400`, `401`, `403`, `404` (organização ou membership inexistente), `409` (duplicidade, último admin).

---

## 13. Modelo de dados e auditoria (nível produto)

**Entidades:** `organization_memberships`, `user`, `organizations`; leituras auxiliares para validação de unicidade e papel.

**Eventos (`event_type`):** `membership_created`, `membership_removed`, `membership_role_changed` — com `organizationId` preenchido e **sem** PII desnecessária em metadata (preferir ids e papéis).

---

## 14. Regras de segurança

1. `isSuperadmin` avaliado **apenas** no servidor para **FR101–FR107**.
2. UI não substitui controlos de API.
3. Respostas **403** vs **404**: seguir política já adoptada no projecto para ocultação entre tenants; para membros de organização acessível só a superadmin, **404** pode ser aceitável para IDs inválidos.
4. Todas as mutações geram **FR109**.
5. Não expor listagem global de utilizadores da plataforma fora do âmbito da pesquisa necessária à operação (evitar «dump»).

---

## 15. Critérios de aceite globais

1. Utilizador não superadmin **não** recebe HTML com dados de membros ao aceder a `/admin/organizacoes` (gate servidor).
2. Superadmin completa **listar, adicionar, criar+vincular, editar, remover** sem SQL manual.
3. **FR108** coberto por teste automatizado.
4. Eventos de auditoria presentes em todas as mutações bem-sucedidas.
5. OpenAPI actualizada; regressão SORG (criação de org, listagem acessível) verde em CI.

---

## 16. Epics sugeridos (alto nível)

1. **Epic A — Gate servidor `/admin`:** layout ou guard Next + testes de rota.
2. **Epic B — API de membros:** `GET/POST/PATCH/DELETE` com validação, auditoria, FR108.
3. **Epic C — UI de membros:** integração na área Organizações, modais, erros, a11y **NFR35**.
4. **Epic D — Qualidade e documentação:** testes de integração, OpenAPI, smoke E2E opcional.

*(Epics podem ser fundidos em menos entregas se o time preferir «vertical slice» único — validar com `@sm`.)*

---

## 17. Histórias sugeridas (para `@sm` detalhar)

1. **SMEM-01** — Layout servidor `/admin` + redirecionamento/403 + testes mínimos.
2. **SMEM-02** — `GET .../members` paginado + `403` + OpenAPI.
3. **SMEM-03** — `POST .../members` (vincular existente) + auditoria + testes 409 duplicidade.
4. **SMEM-04** — `POST .../members` (criar utilizador + vínculo) + tratamento de conflitos.
5. **SMEM-05** — `PATCH .../members` + regra último admin + auditoria `membership_role_changed`.
6. **SMEM-06** — `DELETE .../members` + regra último admin + auditoria `membership_removed`.
7. **SMEM-07** — UI: listagem, busca, modais, cópias PT-BR, estados de erro.
8. **SMEM-08** — E2E smoke superadmin (opcional) ou suíte de integração consolidada.

---

## 18. Riscos e mitigações

| Risco | Mitigação |
| ----- | --------- |
| Lockout por remoção incorrecta de admins | **FR108** + mensagens claras + preferência por «promover antes de remover» na UI |
| Criação de contas duplicadas | Validação de email único + **409** |
| Fuga de listagem global de emails | Limitar pesquisa ao contexto da organização; rate limit (`@architect`) |
| Divergência OpenAPI vs implementação | PR checklist com diff OpenAPI |

---

## 19. Dependências e alinhamentos

- `@architect` — contratos finais, transacções (user+membership), política 403/404.
- `@sm` — histórias SMEM-* com DoD e estimativa.
- `@dev` — implementação e CI.
- `@qa` — matriz de testes de autorização e auditoria.

---

## 20. Próximos passos (AIOS)

1. **`@architect`** — documento de arquitectura técnica do incremento (endpoints, queries FR108, idempotência).
2. **`@sm`** — gerar ficheiro em `docs/stories/` com SMEM-* e rastreio a FR100–FR110.
3. **`@dev`** — implementação após aprovação do PRD.
4. **`@pm`** — na próxima revisão de `docs/prd.md`, incorporar FR100–FR110 / NFR30–NFR35 ou manter como addendum oficial por referência cruzada.

---

## 21. Checklist de saída (PM)

- [x] Objetivos e fora de âmbito explícitos.
- [x] Requisitos numerados e testáveis.
- [x] Fluxos e critérios de aceite globais.
- [x] Encaminhamento para arquitectura e histórias.

---

## 22. Prompts de handoff (opcional)

**Arquitecto:** «Com base em `docs/prd-superadmin-aba-organizacoes-gestao-membros.md`, define contratos HTTP finais, schemas Zod partilhados, política 403/404, implementação de FR108 com queries e transacções para POST criar utilizador+membership.»

**SM:** «Decompõe SMEM-01 a SMEM-08 em histórias com AC testáveis, dependências e ordem de entrega; alinha com testes NFR32.»

---

— Morgan (PM) — AIOS; PRD derivado de `docs/briefing-superadmin-aba-organizacoes-gestao-membros.md` e PRDs incrementais existentes.
