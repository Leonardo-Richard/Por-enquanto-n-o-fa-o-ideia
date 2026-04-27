# Briefing — Aba «Organizações» (superadmin) e gestão de membros

**Produto:** Portal de Automação de Notas Fiscais  
**Data:** 2026-04-27  
**Pedido:** (1) Garantir que a aba administrativa de organizações seja **apenas** para superadmin; (2) Permitir que superadmins **editem** o contexto das «empresas» (organizações) **via membros**: adicionar/remover vínculos, criar novos utilizadores e remover membros conforme política; (3) Este documento serve de **briefing** para alinhar PM, arquitetura e desenvolvimento.

---

## 1. Âmbito e glossário

| Termo no pedido | Significado canónico neste briefing | Tabela / conceito |
| ---------------- | ------------------------------------- | ------------------- |
| **Aba** | Entrada de navegação **«Organizações»** → `/admin/organizacoes` | Shell lateral + rota admin |
| **Empresa** (no pedido do utilizador) | **Organização (tenant)** gerida na área superadmin, salvo decisão explícita em contrário | `organizations` + `organization_memberships` |
| **Membro** | Utilizador com vínculo à organização e papel (`org_role`) | `organization_memberships` |

**Nota de desambiguação:** No modelo de dados existem também `companies` e `company_memberships` (empresa fiscal / filial dentro do tenant). Se o negócio pretender gestão de membros **por empresa fiscal** e não só por organização, trate-se como **incremento separado** (rotas, autorização e UI distintas). O presente briefing assume **membros ao nível da organização**, alinhado à aba `/admin/organizacoes` e à listagem já exibida com «X membro(s)».

---

## 2. Estado actual (baseline de código)

### 2.1 Navegação — visibilidade da aba

- Em `frontend/src/components/dashboard-shell.tsx`, o item **«Organizações»** só é renderizado quando `isSuperadmin` é `true` após `GET /api/v1/me` no cliente (`useEffect` + estado `isSuperadmin`).
- A página `OrganizationsAdminPage` chama o mesmo `/api/v1/me` e, se `!me?.isSuperadmin`, mostra **«Acesso negado»** (sem listar dados).

**Lacuna:** Quem conhece o URL pode abrir `/admin/organizacoes` sem ver o link; a página já bloqueia conteúdo sensível, mas **não há** (neste repositório, à data do briefing) um `layout.tsx` dedicado sob `admin/` que faça redireccionamento **no servidor** antes de hidratar a UI. APIs de listagem/criação de organizações devem continuar a exigir `isSuperadmin` no servidor (já alinhado com histórias SORG).

### 2.2 Gestão de membros

- A UI de organizações lista cards com `memberCount`, mas **não** oferece acções para ver, adicionar, remover ou criar membros.
- Não foi encontrado endpoint público v1 dedicado a CRUD de `organization_memberships` no âmbito deste briefing (além da lógica interna de criação de org / admin local).

---

## 3. Objectivos de produto

1. **Confiança de acesso:** Qualquer utilizador não superadmin não deve ter **atalho visível** nem percepção de funcionalidade de plataforma; reforçar com **política consistente no servidor** (rotas de página e APIs).
2. **Operação:** Superadmin consegue, por organização, **listar membros**, **alterar papel** (ex.: `user` / `admin` conforme enum existente), **adicionar** utilizador existente ou **criar convite / utilizador** novo, **remover vínculo** (membership) na organização.
3. **Segurança e auditoria:** Todas as mutações validadas com `isSuperadmin`; eventos de auditoria reutilizando ou estendendo tipos já previstos em `docs/architecture-login-empresas-roles.md` / `frontend/src/lib/audit.ts` (ex.: `membership_created`, `membership_removed`, `membership_role_changed`).

---

## 4. Requisitos funcionais (proposta)

| ID | Requisito |
| -- | ---------- |
| RF-01 | Utilizador sem `is_superadmin` **não** vê o item «Organizações» no shell (mantém comportamento actual). |
| RF-02 | `GET` página `/admin/organizacoes`: utilizador autenticado sem superadmin recebe **403** ou redirecção para `/dashboard` **no servidor**, preferencialmente via `layout` ou guard equivalente no App Router. |
| RF-03 | Superadmin: **listar** membros de uma organização (id, email ou identificador seguro, `org_role`, metadados opcionais `job_title`, `department`, `phone`). |
| RF-04 | Superadmin: **adicionar** membro — ou convida por email, ou associa `user_id` existente — com escolha de `org_role`. |
| RF-05 | Superadmin: **remover** membro = **apagar linha** de `organization_memberships` (desvincular), **sem** apagar conta global `user` no MVP (alinhado a `docs/prd-atualizacao-login-empresas-roles.md`). |
| RF-06 | Superadmin: **criar** «novo membro» = criar utilizador na plataforma (fluxo Better Auth / convite) **e** criar membership na organização; erros de email duplicado tratados com mensagem clara. |
| RF-07 | Superadmin: **excluir** no sentido de produto = RF-05 (remover vínculo); **exclusão permanente de conta** fica fora do âmbito salvo decisão PM explícita. |
| RF-08 | Impedir que o último `org_role = admin` seja removido ou rebaixado **sem** outro admin na mesma organização (regra de salvaguarda; coerente com aviso `localAdminLinked` / FR50). |

---

## 5. API e modelo (alto nível)

- **Novas rotas sugeridas** (prefixo `/api/v1`, JSON, sessão cookie):
  - `GET /organizations/:organizationId/members` — superadmin only.
  - `POST /organizations/:organizationId/members` — corpo: email ou `userId`, `org_role`, campos opcionais; cria user se política permitir.
  - `PATCH /organizations/:organizationId/members/:membershipId` — alterar `org_role` e/ou metadados.
  - `DELETE /organizations/:organizationId/members/:membershipId` — remove vínculo; aplicar RF-08.

- **Autorização:** `isSuperadmin(session.user)` em todos os handlers; nunca confiar só no cliente.

- **OpenAPI:** Actualizar `docs/api/openapi-v1-organizations-session.yaml` (ou ficheiro agregador do projecto) com os novos paths.

---

## 6. UX (resumo)

- Na lista de organizações (ou detalhe `/admin/organizacoes/[id]` se for criada rota de detalhe): acção **«Membros»** ou secção expansível com tabela, busca e acções.
- Modais: **Adicionar membro**, **Criar utilizador e adicionar**, confirmação para **Remover vínculo**.
- Mensagens de erro mapeadas (`400`, `403`, `404`, `409` para duplicidade de membership).

---

## 7. Fora de âmbito (recomendado para MVP deste briefing)

- RBAC fino além de `user` / `admin` por organização.
- Gestão de membros ao nível `company_memberships` (sem história dedicada).
- Eliminação LGPD completa da conta global.

---

## 8. Rastreio com documentação existente

- `docs/prd-atualizacao-login-empresas-roles.md` — matriz Superadmin vs Admin e regra de «remover = vínculo».
- `docs/architecture-login-empresas-roles.md` — funções `canManageUsers`, auditoria.
- `docs/stories/incremento-superadmin-cadastro-organizacoes-acesso-global.md` — contexto SORG e criação de organizações.

---

## 9. Critérios de aceitação (macro)

- [ ] Não-superadmin: sem link + sem dados de membros; tentativas de API retornam `403`.
- [ ] Superadmin: CRUD de memberships conforme RF-03–RF-08 com testes de integração mínimos (feliz + 403 + regra do último admin).
- [ ] Eventos de auditoria registados nas mutações.
- [ ] Documentação OpenAPI e, se aplicável, story SM com IDs de tarefas.

---

## 10. Próximos passos sugeridos (AIOS)

1. **@pm** — Incorporar RF acima no PRD incremental ou confirmar desvio para `company_memberships`.  
2. **@architect** — Desenhar contrato exacto dos endpoints e regra RF-08 com queries.  
3. **@sm** — Quebrar em histórias (ex.: SORG-MEM-01 …) com DoD alinhado à secção 9.  
4. **@dev** — Implementar `layout` servidor para `/admin` + APIs + UI.

— Fim do briefing.
