# PRD — Incremento: organização cliente (tenant) vs. empresas monitoradas (automação fiscal)

**Documento:** requisitos do incremento descrito em `docs/briefing-atualizacao-dois-niveis-organizacao-vs-empresas-fiscais.md`, alinhado ao **project brief** (`docs/brief.md`), ao **PRD principal** (`docs/prd.md`) e ao incremento **login / memberships** (`docs/prd-atualizacao-login-empresas-roles.md`).

**Normativa integrada:** `docs/prd.md` — FR1–FR18 (cadastro, jobs, pastas), FR19–FR24 (Supabase / fronteira FE-BE) onde aplicável. O incremento de **login e papéis** introduz memberships e “empresa ativa” na sessão; **este PRD clarifica semanticamente** que a “empresa” do picker de login corresponde, no domínio de produto, à **organização cliente**, e **não** a cada CNPJ da automação.

**Em caso de conflito** entre textos (“empresa” genérica vs. dois níveis), **prevalece este documento** para glossário e âmbito de dados até harmonização numa versão consolidada do `docs/prd.md`.

**Change log (este incremento):**

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-22 | 1.0    | PRD inicial: glossário fechado, FR33–FR40, NFR16–NFR18, impacto no incremento de login e épicos 2–4. |

---

## 1. Objetivos de produto

1. Eliminar ambiguidade entre **quem utiliza o portal** (cliente B2B / workspace) e **quais CNPJs** entram na **coleta e organização de notas fiscais**.
2. Garantir **isolamento multi-tenant** por **organização cliente**: cadastros fiscais, jobs e auditoria nunca “vazam” entre organizações.
3. Alinhar **copy de UI**, **documentação** (`docs/brief.md`, PRD principal) e **contratos de API** aos termos canónicos abaixo.
4. Permitir **rastreio** operacional e de suporte: para cada execução, identificar **organização cliente** e **empresa monitorada**.
5. **Métrica de sucesso:** em testes com utilizadores internos, nenhum ecrã crítico é interpretado como “CNPJ da NF” quando o contexto é “workspace”; questionários de claridade (opcional) ou revisão UX registam **0** ocorrências de confusão não resolvida por tooltip ou título de página.

---

## 2. Decisões de produto fechadas (ex-briefing)

| Tema | Decisão |
| ---- | ------- |
| **Nome canónico — nível 1** | **Organização** (rótulo curto na UI). Sinónimos permitidos em copy longa: “organização cliente”, “sua organização”. **Não** usar “empresa” sozinha para este nível sem qualificador. |
| **Nome canónico — nível 2** | **Empresa monitorada** (rótulo de produto). Na UI secundária: “CNPJ na automação”, “empresa na automação”. Dados: CNPJ normalizado (14 dígitos), código do sistema, agendamento, ativo, histórico de jobs — alinhado a FR3–FR18 do PRD principal. |
| **Relação cardinal** | Uma **organização** tem **N ≥ 0** empresas monitoradas. Uma **empresa monitorada** pertence a **exatamente uma** organização. |
| **Sessão / contexto ativo** | O contexto escolhido no fluxo pós-login (picker) é **sempre** `organização ativa` (conceito de produto). O incremento de login pode manter nome técnico `active_company_id` temporariamente; a **intenção de produto** é `active_organization_id` ou equivalente documentado pelo `@architect`. |
| **Memberships e papéis** | **FR20–FR30** do incremento de login aplicam-se à **organização** (tenant), não à empresa monitorada: Admin/User gerem membros **da organização**; permissões sobre **empresas monitoradas** seguem o mesmo âmbito (não cruzar organizações). |
| **Unicidade de cadastro fiscal** | Manter a regra de negócio do PRD principal: **não** duplicar o mesmo par **CNPJ (14 dígitos) + código do sistema** **dentro da mesma organização** (evolução de FR4: de “por conta” para “por organização”). |
| **Superadmin** | **Listar organizações** da plataforma é distinto de **abrir lista de empresas monitoradas** dentro de uma organização. Superadmin segue matriz do PRD de login; mutações em dados fiscais sem papel `admin` na organização continuam **proibidas** no MVP (regra já no incremento de login). |

---

## 3. Fora de âmbito (confirmado neste incremento)

- **Planos comerciais** e limites por organização (número máximo de empresas monitoradas) — apenas mencionar extensibilidade em mensagens de erro genéricas se ainda não existir produto comercial.
- **Partilha de um mesmo CNPJ monitorado** entre duas organizações (multi-inquilino complexo) — explícito como **não suportado** salvo épico futuro.
- **Renomeação mecânica de todas as rotas** (`/empresas` → `/organizacoes`) — opcional; o PRD exige **clareza semântica**, não um slug específico (decisão de routing com `@architect` / UX).

---

## 4. Impacto em personas e fluxos

| Persona / fluxo | Antes (risco) | Depois (esperado) |
| ---------------- | ------------- | ----------------- |
| Operador fiscal | “Empresa” no menu mistura workspace e CNPJ. | Menu e títulos distinguem **Organização** (contexto) vs **Empresas monitoradas** (lista de CNPJs). |
| Admin de escritório | Convida membros pensando em CNPJ. | Convida membros para a **organização**; CNPJs são cadastrados em **Empresas monitoradas** dentro dessa organização. |
| Superadmin | Lista “todas as empresas” sem granularidade. | Lista **organizações**; ao entrar numa organização, vê **empresas monitoradas** como sub-recurso. |

---

## 5. Requisitos funcionais (incremento)

Identificadores novos para rastreio (**FR33–FR40**). Integração futura no `docs/prd.md` principal recomendada na próxima revisão major.

| ID | Descrição |
| -- | ----------- |
| **FR33** | O sistema deve persistir e expor o conceito de **organização** como entidade de primeiro nível para agrupamento de utilizadores (memberships), políticas de acesso e **âmbito** de todas as operações sobre empresas monitoradas e jobs. |
| **FR34** | Toda **empresa monitorada** deve referenciar obrigatoriamente **uma** organização (`organization_id` ou nome acordado na arquitetura). Não é permitido criar empresa monitorada sem organização válida e acessível ao criador. |
| **FR35** | **CRUD de empresas monitoradas** (criar, listar, editar, desativar — alinhado a FR3, FR16–FR18 do PRD principal) ocorre **somente** no contexto da **organização ativa** na sessão; APIs rejeitam `organization_id` incoerente com a sessão (**403**). |
| **FR36** | **Jobs de coleta** (imediato e mensal — FR9, FR10, Epic 4) devem estar associados à **empresa monitorada** e, para consultas administrativas e auditoria, **derivar** a organização dona (persistido ou join estável — decisão `@architect`). |
| **FR37** | **Logs e eventos de auditoria** relevantes (NFR4) devem incluir, quando aplicável, **`organization_id`** e **`monitored_company_id`** (ou nomes equivalentes) para permitir resposta à pergunta: “quem (org) fez o quê sobre qual CNPJ?”. |
| **FR38** | A **UI** do dashboard de cadastros fiscais deve usar título ou breadcrumb que identifique **Empresas monitoradas** (ou equivalente aprovado), **não** apenas “Empresas”, salvo que um **subtítulo/tooltip** explique explicitamente o glossário (aceite mínimo). |
| **FR39** | O **picker pós-login** (incremento de login) deve comunicar que a escolha é da **organização** onde o utilizador vai trabalhar; copy padrão recomendada: **“Escolha sua organização”** (variantes permitidas desde que o help text amarre ao glossário da secção 2). |
| **FR40** | **Migração brownfield:** dados existentes em que `companies` (ou tabela homóloga) representava simultaneamente “conta + CNPJ” devem ser **mapeados** para o modelo de dois níveis sem perda de vínculo utilizador–CNPJ; utilizadores que tinham acesso devem receber membership na **organização** correta (script/backfill — critérios com `@architect` e `@data-engineer`). |

---

## 6. Requisitos não funcionais (incremento)

| ID | Descrição |
| -- | ----------- |
| **NFR16** | **Consistência de nomenclatura:** strings de UI revisadas nos fluxos autenticados (login → picker → dashboard → cadastro → detalhe job) conforme glossário; exceções documentadas num ficheiro de copy ou story única. |
| **NFR17** | **Observabilidade:** métricas e logs estruturados passam a incluir **organization_id** onde já existia apenas `user_id` / `account_id` (alinhamento a NFR8 do PRD principal). |
| **NFR18** | **Testes de integração:** casos que provam **isolamento** — utilizador A com membership na org 1 **não** lista nem altera empresas monitoradas da org 2 (403/404 conforme política de segurança). |

---

## 7. UX (sumário executivo)

- **Picker:** título preferencial **“Escolha sua organização”**; cards representam **organizações** (nome da organização, estado, n.º de membros — metadados já previstos no incremento de login, agora semântica explícita).
- **Workspace:** cabeçalho mostra **nome da organização ativa**; entrada de menu para CNPJs: **“Empresas monitoradas”** ou **“Automação fiscal”**.
- **Formulário de CNPJ:** subtítulo do tipo “Cadastro na automação” ou “Novo CNPJ monitorado” para reforçar o nível 2.
- **Superadmin:** vista global com separação visual **Organizações** vs drill-down **Empresas monitoradas** dentro da organização selecionada.

*(Tokens, cores e layout detalhado: `docs/front-end-spec.md` e specs do incremento de login.)*

---

## 8. Dependências e harmonização com outros documentos

| Documento | Relação |
| --------- | ------- |
| `docs/brief.md` | Atualizar numa passagem futura: “utilizador cadastra **empresas monitoradas** dentro da **organização**”. |
| `docs/prd.md` | FR2, FR4, FR16 referem “conta” / “empresa”; interpretação alvo: **dados isolados por organização**; unicidade **(organization_id, cnpj_digits, system_code)**. |
| `docs/prd-atualizacao-login-empresas-roles.md` | **FR22–FR24** (“empresas acessíveis”, “empresa ativa”) = **organizações acessíveis**, **organização ativa** em linguagem de produto; implementação pode manter nomes técnicos legados até refactor. |
| `docs/briefing-atualizacao-login-empresas-roles.md` | Revisão de copy das secções 3.1–3.2 para adotar “organização” em vez de “empresa” no picker, quando este incremento for implementado. |

---

## 9. Critérios de aceite globais (incremento)

1. Modelo de dados e APIs refletem **dois níveis** com FK explícita de empresa monitorada → organização.  
2. Fluxo e2e: login → escolher **organização** → listar **empresas monitoradas** → criar CNPJ → job associado à empresa monitorada **e** rastreável à organização.  
3. Nenhuma rota de domínio aceita `organization_id` de organização onde o utilizador não tem membership (exceto Superadmin nas capacidades já definidas no incremento de login).  
4. Documentação de desenvolvimento menciona o glossário (README ou `docs/architecture*.md` atualizado pelo `@architect`).  
5. Dados migrados: **0** empresas monitoradas sem organização após migração (validação SQL em CI ou checklist de release).

---

## 10. Histórias sugeridas (para @sm)

1. **Schema: tabela `organizations` + FK em empresas monitoradas** — migração, backfill, índices.  
2. **Sessão: organização ativa** — alinhar API `/session/active-organization` (ou evolução de rota existente) e middleware.  
3. **API CRUD empresas monitoradas** — scope por `organization_id` (FR35).  
4. **Jobs e fila** — persistir `organization_id` em `jobs` ou garantir join eficiente (FR36).  
5. **Auditoria** — estender eventos com `organization_id` (FR37).  
6. **UI: copy + breadcrumbs** — FR38, FR39, NFR16.  
7. **Testes de isolamento** — NFR18.  
8. **Smoke E2E** — regressão login + cadastro + listagem cross-org negativa.

---

## 11. Riscos e mitigações

| Risco | Mitigação |
| ----- | --------- |
| Refactor grande a meio do incremento de login | Entregar migração de dados + camada de serviço **antes** de trocar toda a copy; feature flag opcional. |
| Confusão residual em rotas `/empresas` | Redirects ou banners de “área de CNPJs monitorados” na primeira visita pós-release. |
| Performance em joins org → empresas → jobs | Índices compostos; paginação; revisão `@architect`. |

---

## 12. Próximos passos (AIOS)

1. **`@architect`** — diagrama ER, naming de colunas (`organizations`, renomeação de `companies` vs. nova tabela `monitored_companies`), RLS se aplicável, plano de migração de `account_id`.  
2. **`@sm`** — fatiar histórias da secção 10 com AC mensuráveis.  
3. **`@pm` (revisão)** — após implementação, propor **PRD principal v0.4+** fundindo FR33–FR40 e glossário em `docs/prd.md`.  
4. **`@po`** — validar copy em PT-BR com um utilizador beta (escritório contábil).

---

— Morgan (PM) — AIOS; baseado em `docs/brief.md`, `docs/briefing-atualizacao-dois-niveis-organizacao-vs-empresas-fiscais.md`, `docs/prd.md` e `docs/prd-atualizacao-login-empresas-roles.md`.
