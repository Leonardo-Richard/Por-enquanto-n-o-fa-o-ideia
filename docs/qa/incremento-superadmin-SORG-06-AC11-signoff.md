# SORG-06 — AC10 / AC11 (`localAdminLinked` ramo `true`)

## Estratégia adoptada no código

- **AC11 (substituição ao HTTP do AC10):** o ramo `localAdminLinked === true` é validado pela **mesma função de domínio** que o handler (`hasOrganizationLocalAdmin`), com fixture de `organization_memberships` (`org_role = admin`), em  
  `frontend/src/app/api/v1/organizations-create.integration.test.ts` (bloco `hasOrganizationLocalAdmin (domínio — SORG-06 AC10/11)`).

## Texto para colar na descrição do PR (aprovações)

> **SORG-06 / AC11:** Confirmamos que o ramo HTTP `201` com `localAdminLinked: true` não é reprodutível de forma estável sem acoplamento ao timing do handler; a suíte cobre o ramo `true` via teste de domínio partilhado com o handler (`hasOrganizationLocalAdmin`), conforme opção AC11 da story (SM v5).  
> **Aprovações obrigatórias (story):**  
> - [ ] **@architect** — aprova uso de AC11 em substituição ao AC10 HTTP  
> - [ ] **@po** — aprova uso de AC11 em substituição ao AC10 HTTP  

*(Marque as caixas no GitHub após comentário explícito dos papéis.)*

## Referência rápida

| Item | Valor |
|------|--------|
| Definição canónica `localAdminLinked` | `docs/architecture-superadmin-cadastro-organizacoes-acesso-global.md` §5.1.1 |
| Handler | `frontend/src/server/api/v1/handlers/organizations-create.ts` |
| Domínio | `frontend/src/server/api/v1/lib/organization-local-admin.ts` |
