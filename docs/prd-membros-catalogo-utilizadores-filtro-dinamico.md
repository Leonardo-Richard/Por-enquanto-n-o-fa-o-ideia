# PRD — Catálogo global de utilizadores na gestão de membros e filtro dinâmico

**Documento:** requisitos do incremento descrito em `docs/briefing-membros-catalogo-utilizadores-filtro-dinamico.md`.  
**Normativa integrada:** `docs/prd.md` (quando aplicável), `docs/prd-superadmin-aba-organizacoes-gestao-membros.md` (**FR100–FR110**, **NFR30–NFR35**), `docs/prd-atualizacao-login-empresas-roles.md` (identidade e vínculos).  
**Relação com SMEM:** este documento **estende** a superfície «Membros» já definida em SMEM; não revoga operações `POST` / `PATCH` / `DELETE` em `.../members`.  
**Em caso de conflito:** prevalece a matriz de segurança mais restritiva; a listagem alargada a **todos** os utilizadores da plataforma é **permitida apenas** a `isSuperadmin` no contexto explícito da secção Membros (ver **FR111** e secção 14).

**Change log:**

| Data       | Versão | Descrição | Autor |
| ---------- | ------ | --------- | ----- |
| 2026-04-27 | 1.0    | PRD inicial: API `system-users`, UI de catálogo, filtro local, acções por linha, NFR de escala e documentação. | PM (Morgan / AIOS) |

**Numeração:** **FR111+** e **NFR36+** neste documento, para não colidir com **FR100–FR110** / **NFR30–NFR35** do PRD de gestão de membros.

---

## 1. Objetivos de produto

1. Permitir que o superadmin **veja, num único ecrã**, o conjunto de **todos os utilizadores registados** na plataforma, **contextualizado** pela organização seleccionada (indicador de quem já é membro e com que papel).
2. Reduzir fricção operacional: **filtrar a lista enquanto escreve**, sem clique em «Buscar» nem ciclo de submissão explícito.
3. Acelerar o vínculo de utilizadores ainda não membros: **acção directa** «Adicionar à organização» com **e-mail pré-preenchido** no modal existente de «Adicionar membro existente».
4. Manter **paridade de capacidades** para quem já é membro: **Editar** e **Remover vínculo** inalterados em semântica relativamente ao PRD SMEM.
5. Preparar evolução documentada para **grandes volumes** de utilizadores (pesquisa no servidor, virtualização) sem bloquear o MVP actual.

**Métrica de sucesso sugerida:** o superadmin consegue localizar um utilizador por nome ou e-mail em **menos de 5 segundos** de interacção percetível (digitação + renderização) em catálogos até **500** utilizadores carregados; taxa de erros de autorização **0** para utilizadores não superadmin em `GET .../system-users`.

---

## 2. Contexto e problema

### 2.1 Estado anterior (pós-SMEM)

A listagem em **Membros** expunha apenas utilizadores com **membership** na organização corrente. Para convidar ou vincular alguém que já existia na plataforma mas noutro contexto, o operador dependia de **conhecer o e-mail** e do fluxo manual do modal, sem visão global.

### 2.2 Problema de negócio

- **Descoberta fraca:** não havia «directório» da plataforma na área de operações por organização.  
- **Pesquisa lenta:** dependência de botão «Buscar» e de parâmetro `q` no endpoint de membros, com rate limit quando `q` presente (**NFR31** no ecossistema `.../members`).  
- **Onboarding operacional:** equipas de suporte e superadmins precisam de **confirmar existência de conta** e papel global (`isSuperadmin`) antes de vincular.

### 2.3 O que este incremento resolve

Catálogo **read-only** agregado (utilizador + opcional membership na org) com filtro **local** instantâneo e ligação aos fluxos de mutação já definidos em `.../members`.

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| Quem vê o catálogo global | Apenas **`isSuperadmin === true`**, mesma política que **FR102–FR107**. |
| Dados mostrados por linha | Identidade mínima (`userId`, nome, e-mail), **`isSuperadmin`**, e bloco **`member`** (estrutura alinhada a `OrganizationMemberListItem`) ou `null`. |
| Filtro no MVP | **Apenas no cliente**, sobre o conjunto já carregado; comparação **case-insensitive** em nome e e-mail. |
| Botão «Buscar» | **Removido** na lista principal; o campo de texto actua como **filtro contínuo**. |
| Paginação | **Servidor:** `page` / `pageSize` (máx. 100) no `GET .../system-users`. **Cliente:** percorre páginas até cobrir `total` (teto de segurança documentado no briefing). **UI:** paginação adicional sobre o **subconjunto filtrado** (ex.: 50 linhas por página de vista). |
| Mutações | Continuam a usar **`POST` / `PATCH` / `DELETE`** em `.../members`; após sucesso, o catálogo deve **actualizar-se** (re-fetch ou invalidação definida na story). |
| Privacidade | A listagem global **não** está disponível a admins locais nem a utilizadores sem superadmin (**FR107** estendido por **FR111**). |

---

## 4. Fora de âmbito (este incremento)

- Alterar **quem** é superadmin ou UI de gestão global de `isSuperadmin`.  
- Listagem ou filtro para **empresa fiscal** (`company_memberships`).  
- **Exportação** (CSV/Excel) do catálogo.  
- **Pesquisa avançada** no servidor (debounce + `q` em `system-users`) — prevista como evolução (**NFR38**).  
- **Notificações** ao utilizador quando é adicionado a uma organização (mantém-se política existente).  
- Harmonização global de todos os FRs em `docs/prd.md` (tarefa transversal de PM).

---

## 5. Personas e impactos

| Persona | Necessidade | Resultado esperado |
| ------- | ----------- | ------------------ |
| Superadmin operacional | Ver quem existe na plataforma e quem já está na org | Uma tabela com todas as linhas de `user` relevantes + coluna de membro |
| Superadmin / suporte | Encontrar rapidamente por nome ou e-mail | Filtro ao digitar |
| Auditoria / segurança | Evitar fuga de dados a não privilegiados | Só superadmin; sem novos endpoints públicos |
| Arquitectura | Escalabilidade futura | Contrato paginado + limites documentados |

---

## 6. Escopo funcional detalhado

### 6.1 API — directório de utilizadores com contexto de organização

- Novo recurso: **`GET /api/v1/organizations/{organizationId}/system-users`**.  
- Resposta: `{ items, page, pageSize, total }` onde cada item segue o tipo **`OrganizationDirectoryUserItem`** (partilhado em `@repo/shared`).  
- Implementação de referência: `LEFT JOIN` entre `user` e `organization_memberships` filtrado por `organization_id` do path.  
- Ordenação por defeito: **criação do utilizador** descendente (alinhado ao briefing; alterações documentais na story se o produto preferir ordem alfabética).

### 6.2 UI — lista principal

- Substituir a lista **apenas de membros** pela vista de **catálogo global** com colunas acordadas no briefing (incl. **Superadmin**, **Nesta organização**, papel, metadados de membership quando existirem).  
- Campo **«Filtrar por nome ou e-mail»** com placeholder orientado a filtro contínuo.  
- Estados: carregamento, vazio global, vazio por filtro, erro recuperável.

### 6.3 UI — acções

- Membro (`member != null`): **Editar**, **Remover vínculo** (comportamentos e códigos alinhados a **FR105**, **FR106**, **FR108**).  
- Não membro: **Adicionar à organização** → abre modal de membro existente com **e-mail pré-preenchido**; submissão continua a usar **FR103**.

### 6.4 Sincronização após mutação

- Após **adicionar**, **criar+vincular**, **editar** ou **remover**, a vista deve reflectir o estado actual (re-carregar catálogo ou equivalente).

---

## 7. Requisitos funcionais

| ID | Descrição |
| -- | --------- |
| **FR111** | O sistema deve expor **`GET /api/v1/organizations/{organizationId}/system-users`** restrito a **`isSuperadmin`**, com paginação (`page` ≥ 1, `pageSize` entre 1 e 100), devolvendo **todos** os utilizadores da tabela `user` e, para cada um, **`member`** preenchido conforme `OrganizationMemberListItem` quando existir vínculo na `organizationId` do path, ou **`null`** caso contrário. |
| **FR112** | Utilizador **sem** `isSuperadmin` que invoque **FR111** deve receber **403** em todas as tentativas (paridade com **FR107**). |
| **FR113** | A UI da página **Membros** (`/admin/organizacoes/[organizationId]/membros`) deve apresentar o **catálogo global** conforme **FR111**, com colunas de produto acordadas (utilizador, superadmin, membro nesta organização, papel e metadados de membership, contato, acções). |
| **FR114** | A UI deve aplicar **filtro dinâmico** ao texto introduzido pelo utilizador, **sem** acção de «Buscar», filtrando por **nome** e **e-mail** de forma **case-insensitive** sobre os dados já carregados no cliente. |
| **FR115** | Para linhas **sem** membership na organização, a UI deve oferecer **«Adicionar à organização»**, abrindo o fluxo de **adicionar membro existente** com o **e-mail** da linha **pré-preenchido** (o utilizador pode alterar antes de confirmar). |
| **FR116** | Após qualquer mutação bem-sucedida em `.../members` iniciada a partir desta página (incluindo modais existentes), a lista visível deve **actualizar** para reflectir membros e não membros correctamente. |

---

## 8. Requisitos não funcionais

| ID | Descrição |
| -- | --------- |
| **NFR36** | A autorização de **FR111** deve ser avaliada **apenas no servidor**; o cliente não é fonte de verdade para privilégio (alinhado a **NFR30**). |
| **NFR37** | O carregamento completo do catálogo no cliente deve respeitar um **teto de segurança** de páginas consecutivas (ex.: máximo de **100** requisições de **100** linhas) para evitar loops infinitos; comportamento acima do teto deve ser **definido na story** (mensagem ao operador ou truncamento explícito). |
| **NFR38** | Para **grandes volumes** de utilizadores (ordem de **múltiplos milhares**), o produto deve poder evoluir para **pesquisa com debounce no servidor** e/ou **listagem virtualizada**, sem quebrar o contrato mínimo de **FR111** para clientes que paginem. |
| **NFR39** | Mensagens de erro em **FR111** devem ser **operacionais** e **sem** detalhes internos de stack (alinhado a **NFR33**). |
| **NFR40** | **Acessibilidade (WCAG AA alvo):** campo de filtro com **label** associado; tabela com **cabeçalhos**; modais mantêm foco e tecla **Escape** conforme padrão já usado na página de membros (**NFR35**). |
| **NFR41** | O ficheiro **OpenAPI** (`docs/api/openapi-v1-organizations-session.yaml` ou agregador adoptado) deve ser **actualizado** com o path `system-users` na mesma janela de entrega que **FR111**, salvo excepção registada no sprint. |

---

## 9. Objectivos de UX / UI

| Área | Orientação |
| ---- | ------------ |
| **Visão geral** | Uma única tabela «fonte de verdade operacional» para «quem existe» e «quem já está nesta org». |
| **Paradigma** | **Filter-as-you-type**; paginação da vista sobre resultado filtrado; modais reutilizados. |
| **Ecrã principal** | **Membros** por organização, com toolbar existente (Adicionar existente, Criar utilizador). |
| **Feedback** | Empty states distintos: **sem utilizadores no sistema** vs **nenhum resultado do filtro**. |
| **Branding** | Manter tokens e padrões do shell admin (realce emerald, tipografia). |

---

## 10. Pressupostos técnicos (para `@architect`)

- Monorepo com `frontend` (Next.js), rotas `app/api/v1`, Drizzle, `@repo/shared` para schemas e tipos.  
- Tabelas `user`, `organization_memberships`, `organizations` já existentes.  
- O endpoint **`GET .../members`** permanece disponível para outros consumidores ou regressões; o catálogo usa **`.../system-users`**.

---

## 11. Fluxos principais

### 11.1 Consultar e filtrar

1. Superadmin abre **Organizações** → **Membros** de uma organização.  
2. O sistema carrega o catálogo (uma ou mais páginas **FR111**).  
3. O superadmin escreve no campo de filtro.  
4. A tabela mostra apenas linhas que correspondem a **FR114**.

### 11.2 Adicionar não membro a partir da linha

1. Superadmin localiza utilizador com coluna de membro vazia.  
2. Clica **Adicionar à organização**.  
3. Modal abre com e-mail pré-preenchido (**FR115**); escolhe papel e confirma.  
4. **FR103** aplica-se; em sucesso **FR116** actualiza a vista.

### 11.3 Editar ou remover membro

1. Superadmin actua sobre linha com `member` preenchido.  
2. Mesmos fluxos e regras **FR105**, **FR106**, **FR108**; **FR116** após sucesso.

### 11.4 Acesso indevido

1. Utilizador sem superadmin tenta **GET .../system-users**.  
2. Resposta **403** (**FR112**).

---

## 12. Contratos de API (referência de produto)

| Método | Caminho | Permissão | Notas |
| ------ | ------- | ----------- | ----- |
| `GET` | `/api/v1/organizations/{organizationId}/system-users` | Superadmin | Query: `page`, `pageSize`; resposta **FR111** |
| `GET` | `/api/v1/organizations/{organizationId}/members` | Superadmin | Mantido (**FR102**); sem obrigatoriedade de uso pela nova UI |
| `POST` / `PATCH` / `DELETE` | `.../members` / `.../members/{membershipId}` | Superadmin | Inalterados em semântica |

**Erros comuns:** `400` (validação de query), `401`, `403`, `404` (organização inexistente).

---

## 13. Segurança e privacidade (clarificação)

O PRD `docs/prd-superadmin-aba-organizacoes-gestao-membros.md` (secção 14) desaconselha «dump» global de utilizadores **fora do âmbito necessário**. Este incremento **define explicitamente** que, para **superadmin** na rota **Membros**, a listagem de **todos** os `user` é **âmbito operacional legítimo**, sujeita a **FR111**, **FR112** e **NFR36**. Não amplia o acesso a outros papéis.

---

## 14. Critérios de aceite globais

1. **FR111–FR116** verificáveis em ambiente de integração ou E2E.  
2. Utilizador não superadmin recebe **403** em `GET .../system-users` sem corpo de dados sensível.  
3. Filtro **FR114** funciona **sem** botão de busca dedicado.  
4. **FR115** pré-preenche o e-mail no modal de adicionar existente.  
5. **FR116** validado após pelo menos um fluxo de **POST** e um de **PATCH** ou **DELETE**.  
6. **NFR41** cumprida ou excepção explícita no board com data de follow-up.

---

## 15. Epics sugeridos

1. **Epic S1 — API `system-users`:** handler, rota, tipos partilhados, testes de integração **403** / feliz / org inexistente.  
2. **Epic S2 — UI catálogo + filtro:** substituição da lista, paginação da vista filtrada, cópias PT-BR.  
3. **Epic S3 — Qualidade:** OpenAPI **NFR41**, revisão de performance **NFR37–NFR38** no backlog técnico.

*(S1+S2 podem ser entregues num único slice vertical se o time preferir.)*

---

## 16. Histórias sugeridas (para `@sm`)

| ID sugerido | Título (resumo) |
| ----------- | ---------------- |
| **SMEM-09** | `GET .../system-users` + testes de autorização e paginação |
| **SMEM-10** | UI: catálogo global, filtro ao digitar, paginação da vista |
| **SMEM-11** | Pré-preenchimento do modal + refresh pós-mutação (**FR115–FR116**) |
| **SMEM-12** | OpenAPI + nota de escala **NFR38** (opcional mesmo sprint) |

---

## 17. Riscos e mitigações

| Risco | Mitigação |
| ----- | --------- |
| Performance com muitos utilizadores | **NFR37** teto; roadmap **NFR38** |
| Divergência `members` vs `system-users` | **FR116** re-fetch; testes de integração |
| Percepção de «vazamento» de e-mails | Apenas superadmin; comunicar em notas de release internas |
| Carga no servidor ao abrir Membros | Paginação 100; considerar cache de curta duração apenas se **@architect** aprovar |

---

## 18. Dependências e alinhamentos

- **`@architect`** — índices em `user` se necessário; política 404 para org inválida.  
- **`@sm`** — SMEM-09 a SMEM-12 com DoD e estimativa.  
- **`@dev`** — implementação (parcialmente já alinhada ao briefing; PRD formaliza aceite).  
- **`@qa`** — matriz: superadmin vê todos; não superadmin 403; filtros e refresh.

---

## 19. Próximos passos (AIOS)

1. **`@sm`** — detalhar histórias SMEM-09–12 com AC testáveis.  
2. **`@dev`** — fechar **NFR41** e quaisquer gaps vs **FR111–FR116**.  
3. **`@pm`** — na revisão global de `docs/prd.md`, referenciar este addendum ou incorporar FR111+ / NFR36+.

---

## 20. Checklist de saída (PM)

- [x] Objetivos e fora de âmbito explícitos.  
- [x] Requisitos numerados e testáveis.  
- [x] Clarificação de segurança vs PRD SMEM secção 14.  
- [x] Fluxos, contratos API, critérios de aceite, histórias sugeridas.

---

## 21. Handoff opcional

**Arquitecto:** «Garantir que `GET .../system-users` usa `LEFT JOIN` correcto, performance aceitável em `count(*)` sobre `user`, e alinhamento de tipos `OrganizationDirectoryUserItem` com a UI.»

**SM:** «SMEM-09 a SMEM-12 com dependências a SMEM-02/SMEM-07 concluídas; AC para **FR116** com cenário PATCH de papel.»

---

— Morgan (PM) — AIOS; PRD baseado em `docs/briefing-membros-catalogo-utilizadores-filtro-dinamico.md` e extensão de `docs/prd-superadmin-aba-organizacoes-gestao-membros.md`.
