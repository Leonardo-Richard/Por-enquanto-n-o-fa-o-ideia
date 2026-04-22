# Briefing: login, seleção de empresa e papéis (Superadmin / Admin / User)

**Tipo:** atualização de produto + UX  
**Data:** 2026-04-22  
**Público:** PM (`@pm`), arquitetura (`@architect`), SM (`@sm`) — base para PRD e histórias  
**Referência visual:** telas de “Escolha sua Empresa” (grid de cards + busca) e “Usuários” (tabela administrativa por empresa).

---

## 1. Contexto

O portal já prevê autenticação e multi-empresa no **brief** e na **arquitetura** (`docs/brief.md`, `docs/architecture.md`). Na implementação atual do app web, o login é **simulado** (`PortalProvider`: email + persistência em `localStorage`), sem vínculo real a organizações nem autorização por papel.

Este briefing descreve a **evolução desejada**: fluxo de login credencial (ou futuro SSO), **escolha explícita da empresa** após autenticação (quando houver mais de uma), e **três níveis de papel** com impacto direto na UI e nas APIs.

---

## 2. Objetivo da atualização

1. **Identidade:** o utilizador autentica-se de forma segura (sessão/cookies ou equivalente alinhado ao stack escolhido no PRD).
2. **Contexto de empresa:** após o login, o utilizador opera sempre no âmbito de **uma empresa selecionada** (tenant), com possibilidade de trocar sem novo login.
3. **Autorização:** papéis **Superadmin**, **Admin** e **User** definem o que vê e o que pode fazer **por empresa** (e, no caso Superadmin, capacidades globais a fechar no PRD).

Sucesso: paridade de experiência com os exemplos fornecidos — **lista de empresas pesquisável**, cards com estado e ações coerentes com o papel; **área de gestão de utilizadores** acessível apenas a quem tem permissão administrativa naquela empresa (e regras especiais para Superadmin).

---

## 3. Referência de UX (alvo visual)

### 3.1 Tela “Escolha sua Empresa”

- Fundo escuro (ex.: `#020617`), grid de cards responsivo.
- Título central: **“Escolha sua Empresa”**.
- Campo de busca com ícone: placeholder **“Buscar empresas…”**.
- **Card por empresa:** avatar/iniciais, nome (truncável), opcional chevron para detalhes; linha com **número de membros** + badge **ATIVA** (verde); ações:
  - **Admin** (secundário, ícone engrenagem) — visível só para quem pode administrar *aquela* empresa.
  - **Acessar** (primário azul, ex. `#00a3ff`) — entrar no workspace da empresa.

### 3.2 Tela “Usuários” (por empresa)

- Cabeçalho: título **“Usuários”**, subtítulo com nome da empresa.
- Ações: **Vincular utilizador**, **Criar utilizador**, contador **“Total: N utilizadores”**.
- Busca: **“Buscar por nome ou email…”**.
- Tabela: colunas **Utilizador** (avatar, nome, email), **Cargo**, **Departamento**, **Contato**, **Criado em**, **Ações** (editar, remover vínculo ou utilizador conforme política).
- Estética: dark mode consistente com a seleção de empresas.

*(Implementação: seguir tokens do design system existente ou `docs/front-end-spec.md`; as cores acima são referência dos mockups.)*

---

## 4. Definição dos papéis

| Papel | Escopo | Empresas listadas | Botão Admin no card | Gestão de utilizadores (tela Usuários) | Notas |
|--------|--------|-------------------|---------------------|----------------------------------------|--------|
| **User** | Por empresa | Apenas empresas das quais é membro | Não | Não (só consumo do portal da empresa) | Pode **Acessar** empresas onde tem conta. |
| **Admin** | Por empresa | Empresas onde tem papel Admin (ou membro com direitos admin) | Sim, nas empresas que administra | Sim, **dentro dessa empresa** | Criar/vincular/editar/remover membros e cargos *locais* da empresa (detalhe no PRD). |
| **Superadmin** | Plataforma | **Todas** as empresas (ou conjunto definido pela operação) | Sim (em todas as que a política permitir) | Sim; **Vincular utilizador** pode incluir utilizadores já existentes na plataforma | Requer definição explícita no PRD: auditoria, limite de Superadmins, e se “remover” é só vínculo ou apaga conta global. |

**Decisão pendente para o PRD:** Superadmin é um **flag global na conta** (`users.is_superadmin`), um **papel numa empresa fictória “sistema”**, ou ambos? O briefing recomenda **flag global + memberships por empresa** para manter o modelo de tenant simples.

---

## 5. Fluxos principais

1. **Login** → validação de credenciais → sessão.
2. **Resolução de destino:**
   - 0 empresas → tela vazia orientada a pedir convite/cadastro (copy a definir).
   - 1 empresa → pode ir direto ao dashboard **ou** passar pela confirmação (produto decide; mock mostra escolha explícita).
   - N empresas → **Escolha sua Empresa** (com busca).
3. **Acessar** → grava **empresa ativa** na sessão (cookie/header) e navega para o dashboard da empresa.
4. **Admin** (card ou menu) → rotas `/empresas/:id/admin/...` (ex.: **Usuários**) com guard de autorização server-side.
5. **Trocar empresa** → voltar à lista ou seletor compacto no shell (fora do escopo visual do mock; PRD deve especificar).

---

## 6. Requisitos funcionais (alto nível)

- **RF-A1:** Listar empresas acessíveis ao utilizador autenticado, com nome, estado (ativa/inativa), contagem de membros.
- **RF-A2:** Filtrar empresas por texto (nome fantasia / razão / CNPJ parcial, conforme dados disponíveis).
- **RF-A3:** Definir **empresa ativa** na sessão após “Acessar”; todas as operações de dados respeitam `company_id`.
- **RF-A4:** Ocultar ou desativar **Admin** quando o utilizador não tiver permissão administrativa na empresa.
- **RF-B1:** Tela **Usuários** apenas para Admin/Superadmin com permissão na empresa selecionada.
- **RF-B2:** CRUD ou operações equivalentes: criar utilizador (convite?), vincular existente, editar cargo/departamento/contato, desvincular — **com regras distintas** para Superadmin vs Admin (ex.: Admin não remove conta global).
- **RF-C1:** Todas as decisões de autorização **duplicadas no servidor** (não confiar só na UI).

---

## 7. Modelo de dados (sugestão para PRD/arquitetura)

Conceitos mínimos:

- **User** — identidade global (email, nome, avatar, datas).
- **Company** — já existente no domínio do produto; manter `active` e metadados fiscais fora deste briefing.
- **Membership** (ou `company_users`) — `user_id`, `company_id`, **papel na empresa** (`user` | `admin`), departamento, cargo exibível, telefone, `created_at`. Unique `(user_id, company_id)`.
- **Superadmin** — atributo global em `User` **ou** tabela `platform_roles`; operações cross-empresa auditadas.

Campos da tabela de utilizadores da UI (**Cargo**, **Departamento**, **Contato**) mapeiam para colunas de membership (não necessariamente “role” de RBAC de sistema — pode haver “cargo legível” + `system_role` interno).

---

## 8. Fora de escopo imediato (sugerido)

- SSO corporativo (pode ser fase 2).
- Convites por email com token (pode ser incluído se o PRD priorizar “Criar utilizador” como convite).
- Permissões granulares além dos três papéis (ex.: “só leitura fiscal”).

---

## 9. Critérios de aceite (macro)

- Utilizador **User** nunca vê rotas/admin nem botão Admin em empresas onde é apenas membro comum.
- Utilizador **Admin** gere utilizadores só da(s) empresa(s) onde é admin; não lista empresas de terceiros.
- **Superadmin** lista todas as empresas (ou conforme política) e consegue abrir Admin em qualquer uma, com eventos auditáveis.
- Fluxo **login → escolha → dashboard** funciona com rede lenta (estados de carregamento/erro).
- Acessibilidade: foco visível, nomes acessíveis nos botões, busca com `label` (alinhado a `docs/front-end-spec.md`).

---

## 10. Relação com o código atual

- `apps/web/src/context/portal-provider.tsx` — login mock; evoluir para sessão real + endpoint de memberships.
- `apps/web/src/components/auth-gate.tsx` — hoje redireciona só por “user existe”; incluir checagens de **empresa ativa** quando o produto exigir contexto obrigatório.
- Nova rota sugerida: `/empresas` ou `/selecionar-empresa` para o ecrã de escolha; `/empresas/:id/usuarios` para a gestão.

---

## 11. Próximos passos (AIOS)

1. **`@pm`** — converter este briefing em incremento do **PRD** (requisitos, edge cases Superadmin, política de remoção).
2. **`@architect`** — desenho de sessão, modelo DB (migrations), contratos API e matriz de autorização.
3. **`@sm`** — fatiar em histórias (ex.: “Auth real + lista de empresas”, “Memberships + guards”, “UI seleção de empresa”, “UI + API usuários por empresa”).

Comandos úteis no analista: `*brainstorm {topic}` para edge cases de Superadmin; `*create-project-brief` se quiser reformatar tudo no template oficial do repositório.

---

*Documento gerado como briefing de descoberta/atualização; não substitui PRD nem contratos técnicos.*
