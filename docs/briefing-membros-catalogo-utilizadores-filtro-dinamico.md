# Briefing: Membros — catálogo global de utilizadores e filtro dinâmico

## Contexto

Na área **Organizações → Membros** (`/admin/organizacoes/[organizationId]/membros`), o superadmin gere vínculos entre utilizadores do sistema e a organização corrente. A lista passou a reflectir **todos os utilizadores registados na plataforma**, e não apenas os que já são membros da organização.

## Objectivos

1. **Visibilidade global:** apresentar todos os utilizadores do sistema numa única tabela contextualizada pela organização seleccionada.
2. **Filtro ao digitar:** o campo de texto filtra **localmente** por nome ou e-mail, sem botão «Buscar» e sem espera explícita por submissão.
3. **Acções por linha:** quem já é membro mantém **Editar** e **Remover vínculo**; quem não é membro vê **Adicionar à organização** (abre o mesmo fluxo do modal com e-mail pré-preenchido).

## API

### `GET /api/v1/organizations/{organizationId}/system-users`

- **Autorização:** apenas **superadmin** (igual ao resto da gestão de membros).
- **Query:** `page` (≥1, default 1), `pageSize` (1–100, default 100).
- **Resposta:** `{ items, page, pageSize, total }`.
- **Item (`OrganizationDirectoryUserItem`):**
  - `userId`, `email`, `displayName`, `isSuperadmin`
  - `member`: objecto alinhado a `OrganizationMemberListItem` quando existe vínculo na organização do path; caso contrário `null`.

Implementação: `LEFT JOIN` entre `user` e `organization_memberships` filtrado por `organization_id`, ordenação por `user.createdAt` descendente.

### Endpoints existentes (inalterados no contrato)

- `POST/PATCH/DELETE .../members` — continua a ser usado para criar vínculo, editar papel/dados e remover vínculo.

## Front-end

- **Carregamento:** o cliente percorre páginas de 100 registos até cobrir `total` (limite de segurança: 100 páginas, isto é, até 10 000 utilizadores por sessão de lista).
- **Filtro:** `useMemo` sobre o catálogo em memória, comparação case-insensitive em `displayName` e `email`.
- **Paginação da vista:** aplica-se ao **conjunto filtrado** (50 linhas por página na UI).
- **Copy:** label «Filtrar por nome ou e-mail», placeholder «Filtra à medida que escreve…»; colunas adicionais **Superadmin** e **Nesta organização** (Membro / —).

## Limitações e evolução

- **Escala:** o filtro instantâneo implica carregar o catálogo completo na memória do browser. Para bases muito grandes, considerar pesquisa **debounced** no servidor (com rate limit semelhante ao de `GET .../members?q=`) ou listas virtualizadas.
- **OpenAPI:** o ficheiro `docs/api/openapi-v1-organizations-session.yaml` pode ser alinhado numa tarefa de documentação API separada.

## Ficheiros principais

| Área        | Ficheiro |
|------------|----------|
| API        | `frontend/src/app/api/v1/organizations/[organizationId]/system-users/route.ts` |
| Handler    | `frontend/src/server/api/v1/handlers/organization-system-users.ts` |
| UI         | `frontend/src/components/admin/organization-members-page.tsx` |
| Tipos Zod  | `packages/shared/src/api-v1.ts` (schema + `OrganizationDirectoryUserItem`) |

---

*Documento de briefing para produto e desenvolvimento — Abril de 2026.*
