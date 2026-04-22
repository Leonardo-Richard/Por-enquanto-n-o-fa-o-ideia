# PRD — Incremento: login, seleção de empresa e papéis (Superadmin / Admin / User)

**Documento:** requisitos do incremento descrito em `docs/briefing-atualizacao-login-empresas-roles.md`, alinhado ao **project brief** (`docs/brief.md`) e à visão multi-conta do **PRD principal**.  
**Normativa integrada:** `docs/prd.md` **v0.2** (2026-04-22) — este ficheiro **estende** FR1, FR2, FR16 e as áreas de UI/autenticação; em caso de conflito textual com requisitos já fechados no PRD principal, **prevalece `docs/prd.md`** até harmonização numa versão futura (ex.: v0.3).

**Change log (este incremento):**

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-22 | 1.0    | PRD inicial do incremento: memberships, papéis, telas de seleção e gestão de utilizadores. |

---

## 1. Objetivos de produto

1. Substituir autenticação **simulada** (ex.: `localStorage` apenas) por **sessão credencial** alinhada a **FR1** e **Story 1.2** do PRD principal, com autorização **no servidor**.
2. Introduzir **multi-empresa por utilizador** via **memberships** (N utilizadores por empresa; N empresas por utilizador), mantendo **isolamento de dados** coerente com **FR2**.
3. Exigir **contexto de empresa ativa** (`company_id`) para operações do domínio (cadastros, jobs, listagens), alinhando a UI ao paradigma “escolher empresa → trabalhar no workspace”.
4. Definir **três níveis de autorização**: **User**, **Admin** (por empresa) e **Superadmin** (plataforma), com UX conforme referência visual do briefing (cards + tabela de utilizadores).
5. **Métrica de sucesso:** um User comum nunca acede a rotas administrativas; um Admin não lista nem gere empresas onde não tem papel administrativo; ações sensíveis de Superadmin ficam **auditáveis** (alinhado a **NFR4**).

---

## 2. Decisões de produto fechadas (ex-briefing)

| Tema | Decisão |
| ---- | ------- |
| **Superadmin** | Atributo **global** na conta: `user.is_superadmin` (boolean). **Não** usar empresa fictícia como único mecanismo. |
| **Admin / User** | Modelados no **membership**: cada par `(user_id, company_id)` tem `company_role ∈ { user, admin }`. |
| **Superadmin + membership** | Superadmin **pode** ter memberships para uso “como membro” em empresas específicas; capacidades globais (listar todas as empresas, abrir admin em qualquer empresa) derivam do **flag**, não do membership sozinho. |
| **Listagem “todas as empresas”** | Reservada a `is_superadmin === true`. Operadores podem restringir via política técnica futura (fora do MVP deste incremento salvo requisito legal). |
| **Remover na tela Usuários** | **Admin:** apenas **remove vínculo** (membership) na empresa corrente; **não** apaga conta global. **Superadmin:** idem por omissão; **eliminação global de conta** fica **fora do escopo** deste incremento (fase posterior, com fluxo próprio e confirmações). |
| **Criar utilizador** | MVP deste incremento: **criar convite / utilizador** associado à empresa (email + dados de membership). Detalhe de e-mail transacional com token (**fora** se não houver infra de e-mail; nesse caso: criar utilizador com password definida por Admin num fluxo seguro **ou** “vincular” apenas utilizadores já registados — ver secção 6). |
| **Utilizador com 0 empresas** | Ecrã dedicado com estado vazio, copy orientando a solicitar convite à empresa ou contactar suporte; **sem** acesso ao dashboard de empresas até existir pelo menos um membership (exceto Superadmin, que pode ver lista vazia de “todas” com filtros administrativos — copy a definir). |
| **Utilizador com 1 empresa** | **Atalho:** após login, definir automaticamente essa empresa como **ativa** e redirecionar para o dashboard **sem** obrigar passo intermédio; manter acesso à **troca de empresa** via UI global (menu/header) para listar outras se no futuro existirem mais vínculos. |
| **Utilizador com N>1 empresas** | Obrigatório ecrã **“Escolha sua Empresa”** (com busca) antes do primeiro acesso ao workspace na sessão; após escolha, persistir empresa ativa na sessão. |
| **Trocar empresa** | A partir do shell autenticado: ação “Trocar empresa” leva ao ecrã de seleção **ou** reabre picker; **invalida** cache de dados do cliente onde aplicável (TanStack Query / navegação Next). |

---

## 3. Fora de âmbito (confirmado neste incremento)

- **SSO** corporativo (SAML/OIDC) — fase 2.
- **RBAC fino** além de `user` / `admin` por empresa (ex.: permissões por módulo fiscal).
- **Eliminação permanente de conta global** e **anonimização LGPD completa** — mantêm-se políticas do PRD principal; execução técnica faseada.
- **Limite máximo de Superadmins** — política operacional (não bloqueante para desenvolvimento); recomenda-se registo em auditoria e MFA pós-MVP.

---

## 4. Personas e permissões (matriz)

| Capacidade | User (membership `user`) | Admin (membership `admin`) | Superadmin (`is_superadmin`) |
| ---------- | ------------------------- | --------------------------- | ------------------------------ |
| Ver ecrã seleção de empresas (N>1) | Sim (só empresas com membership) | Sim (idem) | Sim (**todas** as empresas da plataforma) |
| Botão **Acessar** no card | Sim (onde é membro) | Sim | Sim |
| Botão **Admin** no card | Não | Sim nas empresas onde `company_role=admin` | Sim em **qualquer** empresa |
| Rotas `/empresas/:id/...` dados operacionais | Sim, com `company_id` ativo e membership | Sim | Sim (sem membership: acesso administrativo apenas; **não** simular dados como “membro” sem regra explícita — ver nota) |
| Tela **Usuários** (listar, buscar) | Não | Sim, só `company_id` ativo com `admin` | Sim em qualquer empresa |
| **Vincular utilizador** existente | Não | Sim (utilizadores que já existem na plataforma e aceitam política de convite) | Sim |
| **Criar utilizador** (novo email) | Não | Sim (limitado à empresa) | Sim |
| **Editar** cargo/departamento/contato do membership | Não | Sim | Sim |
| **Remover vínculo** | Não | Sim | Sim |

**Nota (Superadmin sem membership):** operações de **dados fiscais** da empresa (NF, jobs) devem exigir, por defeito, que exista política explícita “modo suporte” ou membership de serviço; para o MVP deste incremento, o PRD exige que **gestão de utilizadores** e **abrir Admin** sejam permitidos ao Superadmin **sem** membership, mas **mutações em dados de negócio** (cadastro CNPJ, jobs) podem ser limitadas a empresas onde tenha membership **ou** a um modo auditado — **decisão de implementação** documentada pelo `@architect` (opção mínima: Superadmin só altera dados de negócio se também tiver membership `admin` nessa empresa; caso contrário, apenas leitura + gestão de utilizadores).

**Decisão MVP (mínima viável):** Superadmin **sem** membership na empresa X pode: listar empresa, abrir **Usuários**, criar/vincular/remover memberships. Superadmin **não** edita CNPJ/código/dispara jobs em X **a menos que** tenha `company_role=admin` em X **ou** flag de “suporte” futura. Isto reduz risco e simplifica testes.

---

## 5. Requisitos funcionais (incremento)

Identificadores novos para rastreio (integração futura no `docs/prd.md`):

| ID | Descrição |
| -- | ----------- |
| **FR19** | Autenticação real: registo, login, logout, recuperação de senha mínima, sessão com cookie HttpOnly (ou equivalente) e invalidação no logout; **proibido** confiar apenas em estado em `localStorage` para decisões de segurança. |
| **FR20** | Modelo **Membership**: `(user_id, company_id)` único; campos mínimos: `company_role` (`user` \| `admin`), `job_title` (cargo exibível), `department`, `phone`, `created_at`, `updated_at`; opcional `avatar_url` ao nível user. |
| **FR21** | Flag global **`is_superadmin`** na conta; apenas utilizadores já marcados por processo seguro (seed inicial + UI restrita ou script operacional) podem receber o flag. |
| **FR22** | API e UI: listar **empresas acessíveis** com nome, CNPJ (mascarado na UI), estado **ativa/inativa**, **contagem de membros**, respeitando matriz da secção 4. |
| **FR23** | Busca no ecrã de seleção: filtra por nome fantasia, razão social (se existir), CNPJ parcial (dígitos). |
| **FR24** | **Empresa ativa** armazenada na sessão do servidor ou em token assinado; cada pedido de API de domínio exige `company_id` coerente com sessão **ou** rota explicitamente “plataforma” (só Superadmin). |
| **FR25** | UI: botão **Admin** visível apenas quando `company_role=admin` **ou** `is_superadmin`; desativado com tooltip quando não aplicável. |
| **FR26** | Rota **Usuários** por empresa: cabeçalho com nome da empresa; tabela com colunas Utilizador (avatar, nome, email), Cargo, Departamento, Contato, Criado em, Ações; contador total; busca por nome/email. |
| **FR27** | **Vincular utilizador:** pesquisar por email; se utilizador não existir, mensagem clara; se existir, criar membership com `company_role` escolhido (default `user`). |
| **FR28** | **Criar utilizador:** fluxo que cria conta global + membership na empresa (ou convite — ver dependência e-mail); validação de email único. |
| **FR29** | **Editar:** atualizar campos de membership e, onde aplicável, nome do utilizador (Admin: só membros da sua empresa; Superadmin: mesma regra no MVP). |
| **FR30** | **Remover vínculo:** apaga apenas membership; utilizador global permanece; requisitos de confirmação na UI (modal). |
| **FR31** | **Guards:** middleware ou camada de API devolve **403** para rotas admin sem papel; **404** opcional para ocultar existência de recursos entre tenants (decisão de segurança — arquitetura). |
| **FR32** | **Auditoria:** eventos `superadmin_access_company`, `membership_created`, `membership_removed`, `membership_role_changed` com `actor_user_id`, `target_user_id`, `company_id`, timestamp (append-only ou tabela dedicada, alinhado **NFR4**). |

---

## 6. Requisitos não funcionais (incremento)

| ID | Descrição |
| -- | ----------- |
| **NFR11** | Todas as verificações de **FR19–FR31** repetidas no **servidor**; UI apenas reflete estado. |
| **NFR12** | **WCAG 2.2 AA** nos novos ecrãs (labels, foco, contraste, erros com `role="alert"` onde aplicável — ver `docs/front-end-spec.md`). |
| **NFR13** | Estados de carregamento e erro em listas e tabelas (skeleton/spinner + mensagem recuperável). |
| **NFR14** | Rate limiting em pesquisa de utilizadores para vincular e em login (detalhe na arquitetura). |

---

## 7. UX (sumário executivo)

- **Seleção de empresas:** layout em grid, fundo escuro, busca central, cards com avatar/iniciais, membros, badge ATIVA/INATIVA, ações **Admin** e **Acessar** conforme **FR25**; referência cromática no briefing (tokens finais: design system / `docs/front-end-spec.md`).
- **Usuários:** ações **Vincular utilizador**, **Criar utilizador**, badge de total; tabela responsiva (scroll horizontal em viewport estreita).
- **Navegação:** URLs sugeridas — `/empresas` (seleção), `/empresas/[id]/*` (workspace), `/empresas/[id]/usuarios` (gestão). Ajustáveis ao routing existente do monorepo.

---

## 8. Dependências e impacto no PRD principal

| Área | Impacto |
| ---- | ------- |
| **FR1 / FR2** | Passam a implicar **memberships** e empresa ativa; “dados por conta” evolui para “dados por **empresa** com ACL”. |
| **FR16** | Lista de empresas do dashboard pode unificar-se com picker ou manter duas vistas — produto prefere **uma fonte de verdade** na API `GET /companies?context=active` após harmonização. |
| **Story 1.2** | Deve ser **estendida** ou desdobrada em histórias que cubram FR19–FR24. |
| **Epic 2** | Criação de empresa deve associar criador como **membership `admin`** (ou política explícita se empresa for criada por Superadmin para terceiros). |

---

## 9. Critérios de aceite globais (incremento)

1. Fluxo e2e: registo → login → (N>1) seleção → dashboard com empresa correta no contexto.  
2. User puro: nunca vê **Admin** nem acede a `/empresas/:id/usuarios` (403 ou redirect).  
3. Admin: gere apenas membros da empresa ativa onde é `admin`; não lista outras empresas na API.  
4. Superadmin: lista todas; abre Usuários; não altera dados fiscais/jobs sem **admin** na empresa (regra secção 4, nota MVP).  
5. Auditoria: pelo menos um evento escrito por ação de FR32 em ambiente de staging.  
6. Testes automatizados: casos felizes + 403 para escalação de privilégio horizontal (user A não acede empresa B).

---

## 10. Histórias sugeridas (para @sm)

Desdobramento sugerido; numerar no backlog conforme convenção do repositório.

1. **Auth real + sessão** — substituir mock; cumprir FR19; testes Story 1.2.  
2. **Schema memberships + flag superadmin** — migrações; seeds dev.  
3. **API empresas acessíveis + empresa ativa** — FR22–FR24.  
4. **UI “Escolha sua Empresa”** — FR23, FR25 (parcial), estados 0/1/N.  
5. **Guards servidor e middleware** — FR31, NFR11.  
6. **Tela Usuários + API CRUD membership** — FR26–FR30.  
7. **Auditoria eventos** — FR32.  
8. **E2E smoke** — login → escolha → admin opcional.

---

## 11. Riscos e mitigações

| Risco | Mitigação |
| ----- | --------- |
| Complexidade de migração de dados mock/localStorage | Script one-off ou reset em dev; utilizadores reimportados. |
| Superadmin excessivo | MFA e auditoria; lista de emails permitidos em env (só staging/prod controlado). |
| Confusão “conta” vs “empresa” | Copy consistente no UI; glossário curto nas definições. |

---

## 12. Próximos passos (AIOS)

1. **`@architect`** — modelo relacional (`users`, `companies`, `memberships`, `audit_events`), contratos OpenAPI/REST, matriz 403/404, evolução de `account_id` vs `company`-centric (se o modelo atual usar conta, documentar mapeamento).  
2. **`@sm`** — criar histórias com AC detalhados a partir da secção 10.  
3. **`@pm`** (revisão) — após implementação parcial, propor **PRD v0.3** fundindo FR19+ no `docs/prd.md` principal.

---

— Morgan (PM) — AIOS; baseado em `docs/brief.md`, `docs/briefing-atualizacao-login-empresas-roles.md` e `docs/prd.md` v0.2.
