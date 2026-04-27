# PRD — Incremento: superadmin cria organizações e acessa toda a base

**Documento:** requisitos do incremento descrito em `docs/briefing-superadmin-cadastro-organizacoes-acesso-global.md`, alinhado ao **project brief** (`docs/brief.md`) e aos incrementos de **organizações/memberships** já documentados.  
**Normativa integrada:** `docs/prd.md` (núcleo de produto), `docs/prd-atualizacao-login-empresas-roles.md` (autenticação e papéis) e `docs/prd-atualizacao-dois-niveis-organizacao-vs-empresas-fiscais.md` (organização vs. empresa monitorada).  
**Em caso de conflito:** prevalece a matriz de segurança mais restritiva até harmonização na próxima versão consolidada do PRD principal.

**Change log (este incremento):**

| Data       | Versão | Descrição |
| ---------- | ------ | --------- |
| 2026-04-27 | 1.0    | PRD inicial do incremento: criação de organizações por superadmin, acesso global e auditoria obrigatória. |

---

## 1. Objetivos de produto

1. Eliminar dependência de intervenção técnica/manual para onboarding de novas organizações.
2. Permitir que `superadmin` crie organizações pelo produto com validação e feedback operacional.
3. Garantir acesso global de `superadmin` a todas as organizações (incluindo recém-criadas), preservando isolamento para `admin/user`.
4. Fortalecer governança com trilha de auditoria para ações administrativas cross-org.
5. Reduzir lead time de ativação de clientes sem aumentar risco de escalonamento indevido de privilégio.

**Métrica de sucesso primária:** 100% das novas organizações de onboarding criadas por fluxo de produto (UI/API), sem SQL manual, durante janela piloto definida pelo time.

---

## 2. Contexto e problema

O produto já possui:

- listagem de organizações acessíveis;
- seleção de organização ativa em sessão;
- diferenciação entre `superadmin` e memberships locais.

Lacuna atual:

- não há fluxo formal completo para `superadmin` **cadastrar organização** com padrões de validação, auditoria e pós-criação;
- operação de onboarding permanece parcialmente manual e suscetível a inconsistências.

Impacto:

- atraso na ativação;
- maior risco de erro operacional;
- dificuldade de rastrear “quem criou qual organização e quando”.

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| Quem pode criar organização | Apenas `isSuperadmin = true`. |
| Escopo de visualização do superadmin | `superadmin` visualiza todas as organizações da plataforma. |
| Acesso imediato após criação | Organização criada fica imediatamente elegível para seleção como organização ativa. |
| Admin local obrigatório no ato | Não obrigatório no MVP; permitido criar organização sem admin local, com alerta operacional. |
| Duplicidade de identificador fiscal | Se `taxIdDigits` for informado e regra de unicidade estiver ativa, criação conflitando retorna `409`. |
| Auditoria | Criação e seleção ativa por superadmin exigem evento auditável com metadata mínima. |

---

## 4. Fora de âmbito (este incremento)

- gerenciamento comercial de planos/limites por organização;
- deleção global de organização com cascata de dados;
- fluxo completo de convite por e-mail (quando infraestrutura de convite não estiver pronta);
- concessão automática de permissão de negócio fiscal ao superadmin sem membership local (continua governado pelas regras já vigentes).

---

## 5. Personas e impactos

| Persona | Necessidade | Resultado esperado |
| ------- | ----------- | ------------------ |
| Superadmin operacional | Criar nova organização rapidamente | Cadastra via UI, recebe confirmação, acessa organização criada na mesma sessão |
| Admin de organização | Isolamento de tenant | Não consegue criar organizações de plataforma |
| Equipe de suporte/auditoria | Rastreabilidade de ações críticas | Consegue identificar criador, organização alvo e horário da operação |

---

## 6. Escopo funcional detalhado

### 6.1 Criação de organização

- entrada administrativa exclusiva para superadmin;
- formulário com campos mínimos:
  - `name` obrigatório;
  - `tradeName` opcional;
  - `taxIdDigits` opcional no MVP (14 dígitos se informado);
- validação server-side obrigatória;
- persistência em `organizations`;
- resposta com `organizationId` e dados básicos da entidade criada.

### 6.2 Acesso global do superadmin

- organização nova aparece na listagem sem reprocessamento manual;
- superadmin consegue definir a organização como ativa;
- navegação para contexto da organização disponível no pós-criação.

### 6.3 Pós-criação assistido (progressivo)

- ação recomendada: vincular admin local existente;
- se não houver vinculação inicial, registrar pendência operacional para acompanhamento;
- não bloquear criação por ausência de admin local no MVP.

---

## 7. Requisitos funcionais (incremento)

**Numeração proposta:** continuidade após FR40 do PRD de dois níveis.

| ID | Descrição |
| -- | --------- |
| **FR41** | O sistema deve expor operação de criação de organização para `superadmin`, com payload mínimo válido (`name` obrigatório). |
| **FR42** | A operação de criação deve validar formato de `taxIdDigits` (14 dígitos) quando informado. |
| **FR43** | A operação de criação deve bloquear usuários sem `isSuperadmin` e retornar `403`. |
| **FR44** | Em caso de conflito de unicidade de identificador fiscal configurado, a operação deve retornar `409` com mensagem clara ao operador. |
| **FR45** | Ao criar organização com sucesso, o sistema deve retornar `organizationId` e disponibilizar a entidade imediatamente na listagem de organizações acessíveis do superadmin. |
| **FR46** | O superadmin deve poder definir qualquer organização (incluindo recém-criada) como organização ativa na sessão sem membership local. |
| **FR47** | O fluxo de UI deve oferecer ação pós-sucesso para “Acessar agora” (trocar organização ativa e navegar para contexto). |
| **FR48** | O sistema deve registrar auditoria de criação de organização com `actor_user_id`, `organization_id`, `event_type`, timestamp e metadata de origem da requisição. |
| **FR49** | O sistema deve manter isolamento de tenant para não-superadmin: `admin/user` continuam sem permissão de criar organização e sem listagem global. |
| **FR50** | O sistema deve permitir criação sem admin local inicial no MVP, exibindo aviso operacional para vinculação posterior. |

---

## 8. Requisitos não funcionais

| ID | Descrição |
| -- | --------- |
| **NFR19** | Operações administrativas globais devem gerar logs estruturados correlacionáveis com auditoria (request id, actor id, organization id). |
| **NFR20** | Fluxo de criação deve ter UX resiliente: loading, erro recuperável e confirmação explícita de sucesso. |
| **NFR21** | Testes automatizados devem cobrir autorização positiva/negativa para criação e seleção ativa de organização. |
| **NFR22** | O incremento deve manter compatibilidade com APIs existentes de organizações acessíveis e organização ativa. |
| **NFR23** | Mensagens de erro devem ser legíveis para operação (sem expor detalhes sensíveis de infraestrutura). |

---

## 9. Fluxos principais

### 9.1 Fluxo feliz (superadmin cria e acessa)

1. Superadmin abre módulo `Organizações`.
2. Clica em `Nova organização`.
3. Preenche campos mínimos e envia.
4. API valida, cria e audita.
5. UI mostra confirmação e opção `Acessar agora`.
6. Superadmin ativa organização e entra no contexto da nova organização.

### 9.2 Fluxo sem permissão

1. Admin/User tenta chamar endpoint de criação (UI não deve expor ação, mas API permanece protegida).
2. API retorna `403`.
3. UI apresenta mensagem genérica de ausência de permissão.

### 9.3 Fluxo de conflito

1. Superadmin informa `taxIdDigits` já existente sob regra de unicidade.
2. API retorna `409`.
3. UI destaca conflito e permite ajuste/reenvio.

---

## 10. Contratos e comportamento de API (referência de produto)

> Endpoints finais podem variar por decisão arquitetural, mantendo semântica.

- `POST /api/v1/organizations`
  - Auth: obrigatório
  - Permissão: `superadmin`
  - Entrada: `{ name: string, tradeName?: string | null, taxIdDigits?: string | null }`
  - Saída (201): `{ id, name, tradeName, taxIdMasked?, createdAt }`
  - Erros: `400`, `401`, `403`, `409`, `500`

- `GET /api/v1/organizations/accessible`
  - Deve refletir organização recém-criada para superadmin sem atraso manual.

- `POST /api/v1/session/active-organization`
  - Deve aceitar organização recém-criada para superadmin.

---

## 11. UX e conteúdo

- menu administrativo visível apenas para superadmin com entrada `Organizações`;
- listagem com busca e CTA primária `Nova organização`;
- formulário de criação com validação em linha para nome/CNPJ;
- pós-sucesso com:
  - feedback positivo;
  - botão `Acessar agora`;
  - aviso de “admin local não vinculado” quando aplicável.

Copy base sugerida:

- sucesso: `Organização criada com sucesso.`
- conflito: `Já existe uma organização com este identificador fiscal.`
- sem permissão: `Você não tem permissão para esta operação.`

---

## 12. Modelo de dados e auditoria (nível produto)

Entidades impactadas:

- `organizations` (criação);
- `session.activeOrganizationId` (ativação imediata);
- `audit_events` (ou equivalente já usado no projeto).

Evento mínimo recomendado:

- `event_type`: `organization_created_by_superadmin`
- `actor_user_id`
- `organization_id`
- `metadata`: `{ source: "admin_ui" | "api", taxIdProvided: boolean }`

---

## 13. Regras de segurança

1. Checagem de `isSuperadmin` exclusivamente no servidor.
2. UI não substitui controle de acesso da API.
3. Sanitização e validação de payload antes de persistir.
4. Auditoria obrigatória para ações globais.
5. Sem bypass de isolamento para usuários não-superadmin.

---

## 14. Critérios de aceite globais

1. Superadmin cria organização sem SQL manual, via UI/API.
2. Usuário sem `isSuperadmin` recebe `403` ao tentar criar organização.
3. Organização criada aparece na listagem acessível do superadmin imediatamente.
4. Superadmin consegue definir a organização criada como ativa na sessão.
5. Evento de auditoria é gravado para cada criação.
6. Regressão de isolamento de tenant permanece protegida em testes negativos.

---

## 15. Estratégia de entrega e histórias sugeridas

1. **Story A — API de criação de organização**
   - payload/validação/autorização/erros.
2. **Story B — UI administrativa de organizações**
   - listagem, ação `Nova organização`, formulário e feedback.
3. **Story C — pós-criação e ativação de contexto**
   - CTA `Acessar agora` + integração sessão ativa.
4. **Story D — auditoria e observabilidade**
   - evento dedicado + logs correlacionáveis.
5. **Story E — testes de autorização e regressão**
   - integração e smoke de cenário positivo/negativo.

---

## 16. Riscos e mitigações

| Risco | Mitigação |
| ----- | --------- |
| Organização criada sem responsável local | Aviso obrigatório pós-criação e tarefa operacional de vinculação de admin local. |
| Erro de entendimento entre acesso global e mutações de negócio | Reforçar matriz de permissão no PRD e em testes de autorização. |
| Falha de auditoria em ação sensível | Tornar gravação de evento parte do caminho crítico com monitoramento. |

---

## 17. Dependências e alinhamentos

- alinhamento com `@architect` para contrato final e validações de unicidade;
- alinhamento com `@sm` para fatiamento de histórias e AC por story;
- alinhamento com `@qa` para suíte de autorização e auditoria;
- atualização de OpenAPI (`docs/api/openapi-v1-organizations-session.yaml`) após implementação.

---

## 18. Próximos passos (AIOS)

1. **`@architect`** — detalhar design técnico do endpoint e estratégia de auditoria.
2. **`@sm`** — quebrar seção 15 em histórias com critérios testáveis.
3. **`@qa`** — elaborar cenários de teste de permissão e rastreabilidade.
4. **`@pm`** — harmonizar FR41–FR50 e NFR19–NFR23 na próxima versão consolidada de `docs/prd.md`.

---

— Morgan (PM) — AIOS; baseado em `docs/brief.md`, `docs/briefing-superadmin-cadastro-organizacoes-acesso-global.md` e PRDs incrementais de autenticação/organizações.
