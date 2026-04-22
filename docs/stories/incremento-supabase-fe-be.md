# User stories — Incremento: Supabase, ambiente e separação frontend / backend

**Produto:** Portal de Automação de Notas Fiscais (por empresa)  
**Fontes:** [prd-atualizacao-supabase-separacao-fe-be.md](../prd-atualizacao-supabase-separacao-fe-be.md), [front-end-spec-supabase-fe-be.md](../front-end-spec-supabase-fe-be.md), [architecture-supabase-fe-be.md](../architecture-supabase-fe-be.md), [briefing-atualizacao-supabase-separacao-fe-be.md](../briefing-atualizacao-supabase-separacao-fe-be.md)  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-22 · **Versão doc:** 1.3 (refinamento pós-reavaliação PO **9,5/10**)  
**Estado do conjunto:** **Ready for dev** — histórias SB-01…SB-04 refinadas e acionáveis; **Gate PO:** assinatura **humana** (titular do papel PO) no **Registo de aprovação PO** — validar **v1.3** antes de merge do incremento.

**Sprint atual:** SB-01 → SB-02 → SB-03 → SB-04. **SB-05 fora do sprint** até decisão explícita de Nível B (PRD §7.1).

---

## Índice

| ID | Título resumido | Dependências principais | Estimativa (orientativa) |
| --- | ---------------- | ------------------------ | ------------------------- |
| **SB-01** | Ambiente Supabase: `DATABASE_URL`, `.env.example`, onboarding e migrações | Acesso ao projeto Supabase (credenciais fora do repo); nenhuma dependência de código além do existente | S |
| **SB-02** | Health: liveness público + readiness com check à DB (sem vazar secrets) | SB-01 ou `DATABASE_URL` válida no ambiente alvo | S |
| **SB-03** | Disciplina FE/BE: auditoria de imports + barreira ESLint opcional | Nenhuma; pode paralelizar com SB-01 após branch criada | M |
| **SB-04** | UX de falhas de API: padrão de erro, retry e a11y (spec UX) | Nenhuma obrigatória; alinha com contratos `api/v1` existentes (FR6) | M |
| **SB-05** | *(Opcional / spike)* Cliente `@supabase/supabase-js` no browser (FR8) | **Decisão PO explícita** + políticas RLS (@data-engineer) **antes** de merge | *não estimado — fora do sprint* |

**Ordem sugerida:** SB-01 → SB-02 → SB-03 e SB-04 (SB-04 pode ir em paralelo a SB-02). **SB-05** só após decisão PRD §7 (Nível B).

### Refinamento v1.1 (critérios PO)

- Estado do conjunto alinhado com **Ready for dev** por fatia; gate de assinatura PO separado.  
- **SB-01 AC3** tornado observável (env ausente / falha explícita).  
- **SB-03** delimita âmbito **cliente** (`"use client"`, hooks, components) vs servidor (`app/api/**`, `lib/db.ts`).  
- **SB-04** fixa **duas superfícies nomeadas** no repositório.  
- **SB-05** marcada como fora do sprint no cabeçalho; estimativas T-shirt para SB-01…04.

### Refinamento v1.2 (reavaliação PO — fechar 9→10)

- **SB-03 AC2:** uma frase normativa para **todo** `apps/web/src/app/**` exceto `app/api/**` (RSC e páginas).  
- **SB-04:** tabela de **copy PT mínima** por cenário (5xx/rede/401/403); desvios só com **uma linha** de justificativa no PR aprovada por @ux-design-expert ou PO.

### Refinamento v1.3 (reavaliação PO **9,5/10** → fechar último meio-ponto)

- **SB-04:** **AC7** — nome acessível explícito no controlo de **retry** (`aria-label` em PT ou texto visível já suficiente; proibido só ícone sem nome).  
- **Gate PO:** nota de que a **assinatura** no registo não pode ser preenchida pelo SM nem pelo agente — apenas pelo PO humano.

---

## CodeRabbit / quality gate (todas as histórias)

- **executor:** `@dev`  
- **Revisão sugerida:** CodeRabbit em PR; `@architect` em **SB-01** (env, pooler, health), **SB-02** (superfície de readiness); `@data-engineer` se SB-05 tocar em RLS/schema.  
- **Foco:** ausência de secrets em git; `GET /api/health` continua leve; readiness não expõe `DATABASE_URL`; imports `getDb` fora de servidor.

---

## Definition of Done (por fatia) — critérios PO

### SB-01

- `.env.example` e documentação (README ou `docs/`) descrevem pooler, `DATABASE_URL`, variáveis públicas Supabase e o que **não** pode ir para `NEXT_PUBLIC_*` (FR2, FR7).  
- Migrações aplicáveis ao projeto Supabase documentadas (comando ou link runbook); smoke: login + uma rota `api/v1` de leitura com base cloud (evidência no PR).  
- NFR1: revisão manual de diff sem passwords/keys em ficheiros versionados.

### SB-02

- Liveness permanece rápido e sem DB (compatível com probes atuais).  
- Readiness executa `SELECT 1` (ou equivalente) via `getDb()`, protegido por segredo/header acordado; resposta **sem** strings de ligação (arquitetura §6, NFR4).  
- Teste manual ou integração mínima documentada para `ok` / `degraded`.

### SB-03

- Lista de ficheiros auditados anexada ao PR (ou script `grep`/relatório); **zero** imports proibidos no âmbito **AC1–AC2** da história (cliente + RSC UI vs exclusões servidor) (FR4, FR5).  
- Se ESLint boundary for adotado: regra ativa e CI verde; caso contrário, evidência de revisão + checklist no PR.

### SB-04

- **Duas** superfícies fixas: `apps/web/src/app/(dashboard)/empresas/page.tsx` e `apps/web/src/hooks/use-accessible-companies.ts` com estados de erro conforme [front-end-spec-supabase-fe-be.md](../front-end-spec-supabase-fe-be.md) §4.2 e **tabela de copy PT** da história (5xx/rede/401/403 + retry; `messageFromApiJson` quando AC4).  
- `role="alert"` ou `aria-live` onde a spec exige; sem texto com URLs internas ou secrets.  
- **AC7:** controlo de retry com **nome acessível** (`aria-label` em PT ou rótulo textual visível); evidência no PR (nota de teste ou captura da árvore de acessibilidade).

### SB-05 (opcional)

- Aprovação PO escrita + RLS mergeada em branch separada; testes de segurança mínimos documentados (NFR2).

### Conjunto (pós SB-04, sem SB-05)

- Métricas PRD §6: deploy com `DATABASE_URL` Supabase sem erros críticos em auth + empresas; zero novos imports cliente→`getDb`.

---

## PO — Decisão de âmbito vinculativa

Em conformidade com [prd-atualizacao-supabase-separacao-fe-be.md](../prd-atualizacao-supabase-separacao-fe-be.md) §5 — **fora deste incremento:** migração para Supabase Auth (Nível C); RLS completa em todas as tabelas se não houver cliente browser; novo repositório separado do web app.

**SB-05** só entra no sprint se o PO fechar explicitamente o **Nível B** (PRD §7.1).

---

## Registo de aprovação PO

| Data | Versão doc | Aprovador | Notas |
| --- | --- | --- | --- |
| *pendente* | 1.3 |  | PO **humano**: assinar após `*validate-story-draft` sobre **v1.3** (inclui AC7 a11y retry) |
| 2026-04-22 | 1.0 | — | Versão inicial (autoria SM); sem gate PO |

---

## SB-01 — Story: Fundação Supabase — env, documentação e migrações

**Status:** Ready for dev  

**Dependências (DoR):** URI **Transaction pooler** do projeto Supabase e password (fora do chat/repo); confirmação de que `NEXT_PUBLIC_SUPABASE_URL` corresponde ao **mesmo** projeto que `DATABASE_URL` (FR1).

**Referências (DoR):** PRD FR1, FR2, FR3, FR7; arquitetura §§3–4, 9; briefing §3.

**Riscos (DoR):** Credenciais expostas em PR; schema remoto desalinhado de `db/migrations/` (mitigação: aplicar migrações antes de smoke).

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`  
- **quality_gate_tools:** revisão de diff por padrões `service_role`, `postgres:.*@`

### Story

**As a** responsável de deploy,  
**I want** variáveis documentadas e um `DATABASE_URL` válido para o Postgres Supabase do projeto,  
**so that** a aplicação arranque de forma previsível em staging/prod sem ambiguidade entre browser e servidor.

### Acceptance Criteria

1. `.env.example` lista `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (placeholder vazio ou texto explicativo), segredos Better Auth existentes, com comentários FR2 (o que pode ir ao browser vs servidor apenas).  
2. Documentação operacional (README ou `docs/`) com passos: Dashboard Supabase → connection string **Transaction** → `.env.local` / secrets de deploy → aplicar migrações em `db/migrations/` ao projeto remoto (FR7, CR2).  
3. **FR3 observável:** com `DATABASE_URL` **ausente** (ficheiro env sem a variável), ao chamar uma rota que use `getDb()` (ex.: `GET /api/v1/me` com sessão válida ou fluxo documentado no PR), o resultado **não** é `200` com corpo de sucesso falso: deve ocorrer **erro HTTP 5xx** com JSON que inclua `message` legível **ou** erro explícito no servidor ao instanciar DB — **uma** das abordagens escolhida e descrita no PR (evitar “falha silenciosa”). Com `DATABASE_URL` **válido**, a mesma rota retorna sucesso esperado.  
4. Nenhum valor real de password ou `service_role` commitado (NFR1).

### Tasks / Subtasks

- [x] Atualizar `.env.example` e secção de env na documentação escolhida (AC1–2).  
- [x] Validar smoke local/staging: health liveness + login + `GET /api/v1/me` ou equivalente (AC3).  
- [x] Checklist de PR: grep por padrões sensíveis (AC4).

### Dev Notes

- URI típica pooler: porta **6543**, `sslmode=require` conforme dashboard.  
- Não alterar contratos JSON das rotas `api/v1/*` (FR6).

### Testing

- Smoke manual documentado; integração existente (`companies-api.integration.test.ts`) verde em CI com `DATABASE_URL` local ou secret de CI.

---

## SB-02 — Story: Observabilidade — liveness vs readiness (Postgres)

**Status:** Ready for dev  

**Dependências (DoR):** SB-01 concluído **ou** ambiente com DB acessível; variável opcional `READINESS_SECRET` (nome pode ser ajustado no PR) definida em deploy.

**Referências (DoR):** Arquitetura §6; PRD NFR4; UX spec §4.3 (health interno, sem dados sensíveis na UI pública).

**Riscos (DoR):** Readiness público sem proteção → vetor de informação / carga; mitigação: header secreto ou rota não documentada para utilizadores.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** operador de plataforma,  
**I want** distinguir “app viva” de “app pronta com base de dados”,  
**so that** alertas e rollouts não assumam falso positivo quando o Postgres está indisponível.

### Acceptance Criteria

1. `GET /api/health` (ou rota pública acordada) continua a responder **sem** consultar a base, com corpo mínimo adequado a probes (liveness).  
2. Existe rota ou modo **readiness** (ex.: `GET /api/health/ready` ou query `?deep=1`) que executa verificação leve à DB via `getDb()` e devolve JSON com `status: "ok" | "degraded"` **sem** incluir host, user ou password da URI (arquitetura §6).  
3. O readiness exige autenticação mecanica acordada (ex.: header `Authorization: Bearer <READINESS_SECRET>`) **ou** está desativado quando o segredo não está configurado (comportamento documentado).  
4. Respostas 5xx da DB não vazam stack trace ao cliente em produção.

### Tasks / Subtasks

- [x] Implementar liveness + readiness conforme ACs.  
- [x] Documentar variável de segredo e uso em runbook/README (SB-01 doc pode referenciar).  
- [x] Teste manual: com DB pausado ou URL errada, readiness ≠ ok; liveness continua ok.

### Dev Notes

- Implementar em Route Handler **Node** (arquitetura §10); não usar Edge para este check se `postgres` não for suportado.  
- Timeout curto na query de readiness para não bloquear workers de LB.

### Testing

- Teste de integração opcional com mock de falha DB; mínimo: evidência manual no PR.

---

## SB-03 — Story: Disciplina frontend / backend — imports e fronteira de pacotes

**Status:** Ready for dev  

**Dependências (DoR):** Nenhuma (brownfield).

**Referências (DoR):** PRD FR4, FR5, NFR5; arquitetura §2, §11; briefing §5.

**Riscos (DoR):** Falso positivo ESLint em Server Components em `app/` — ajustar globs para permitir apenas caminhos servidor onde for legítimo.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@architect`

### Story

**As a** maintainer do monorepo,  
**I want** garantir que UI e hooks cliente não importam a camada de base de dados,  
**so that** futuras features não exponham `DATABASE_URL` ou queries ao bundle do browser.

### Acceptance Criteria

1. **Âmbito cliente (FR4):** nenhum ficheiro em `apps/web/src/components/**`, `apps/web/src/hooks/**`, nem em `apps/web/src/app/**/*.tsx` que contenha a diretiva `"use client"` importa `getDb`, `createDb`, `@repo/db` ou `@/lib/db`. **Exclusões explícitas** (servidor, permitido): `apps/web/src/app/api/**`, `apps/web/src/lib/db.ts`, ficheiros de teste só servidor.  
2. **RSC e páginas App Router (FR5):** em **todo** o glob `apps/web/src/app/**` **exceto** `apps/web/src/app/api/**`, nenhum ficheiro importa `getDb`, `createDb` ou `@repo/db` (inclui `app/(dashboard)/**`, `app/login/**`, `app/registo/**`, `app/recuperar/**`, layouts raiz, etc.). Dados de negócio entram via `fetch` a `/api/...`, props de servidor, ou handlers sob `app/api/**`.  
3. *(Opcional mas recomendado)* Regra ESLint `no-restricted-imports` (ou equivalente) com globs alinhados ao AC1 (apenas bundles cliente / caminhos acordados), **ou** documentação no CONTRIBUTING + script em CI que reproduza o `grep` do AC1 (arquitetura §11).

### Tasks / Subtasks

- [x] `grep` / relatório de auditoria no PR (AC1–2).  
- [x] Adicionar ESLint ou script CI se aprovado pela equipa (AC3).  
- [x] Corrigir qualquer violação encontrada.

### Dev Notes

- `packages/db` pode continuar a ser importado em `apps/web/src/lib/db.ts`, rotas API e testes servidor.

### Testing

- `pnpm lint` / `npm run lint` verde; CI.

---

## SB-04 — Story: UX — erros de API, retry e acessibilidade

**Status:** Ready for dev  

**Dependências (DoR):** Nenhuma obrigatória.

**Referências (DoR):** [front-end-spec-supabase-fe-be.md](../front-end-spec-supabase-fe-be.md) §§4.2, 6, 8; PRD FR6 (contratos).

**Riscos (DoR):** Regressão de copy ou fluxo; mitigação: âmbito **fixo** às duas superfícies dos AC1–2; generalização fica para história futura.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@ux-design-expert` ou `@qa` (a11y)

### Story

**As a** operador fiscal,  
**I want** ver mensagens claras quando o serviço falha e poder tentar de novo,  
**so that** perceba se é rede, sessão ou permissão sem ver detalhes técnicos.

### Acceptance Criteria

1. **Superfície A —** `apps/web/src/app/(dashboard)/empresas/page.tsx` (`"use client"`): em resposta **5xx** ou falha de rede aos `fetch` de `/api/v1/me` ou dados dependentes da lista, o utilizador vê mensagem amigável e **Tentar novamente** (reload/refetch) conforme [front-end-spec-supabase-fe-be.md](../front-end-spec-supabase-fe-be.md) §4.2.  
2. **Superfície B —** `apps/web/src/hooks/use-accessible-companies.ts`: mesmo padrão para falha ao obter `/api/v1/companies/accessible` (mensagem + retry exposto ao consumidor do hook, ex.: `reload`).  
3. **401** redireciona ou navega para fluxo de login com mensagem breve; **403** mostra mensagem de permissão sem detalhes internos (em qualquer uma das duas superfícies onde ocorra).  
4. Mensagens utilizam `messageFromApiJson` quando o corpo JSON trouxer `message` (spec §4.2 tabela).  
5. Região de erro com `role="alert"` ou `aria-live="polite"` conforme spec §8; foco gerível no retry quando aplicável.  
6. **Copy PT:** as strings visíveis ao utilizador seguem a tabela **“Copy mínima (PT)”** abaixo, salvo desvio de **uma linha** no PR com ok de @ux-design-expert ou PO.  
7. **Nome acessível no retry (WCAG):** em **ambas** as superfícies, o controlo que dispara o refetch/reload tem nome acessível inequívoco: ou o **texto visível** «Tentar novamente» no botão, ou `aria-label` em PT (ex.: `aria-label="Tentar novamente a carregar os dados"`). **Proibido** botão só com ícone sem `aria-label`/texto.

#### Copy mínima (PT) — referência SB-04

| Cenário | Texto sugerido (utilizador) | Botão / ação | Nome acessível (retry) |
|--------|------------------------------|--------------|-------------------------|
| HTTP **5xx** ou serviço indisponível | «Não foi possível ligar ao serviço. Tente novamente dentro de instantes.» | «Tentar novamente» (refetch / reload) | Texto visível **ou** `aria-label="Tentar novamente a carregar os dados"` |
| Falha de **rede** / timeout (quando distinguível no cliente) | «Verifique a sua ligação à internet e tente novamente.» | «Tentar novamente» | Idem (pode reutilizar o mesmo `aria-label` se o botão for partilhado) |
| **401** / sessão | «Sessão expirada. Inicie sessão novamente.» | Navegação para login | N/A no retry; link/botão para login com texto ou `aria-label` em PT |
| **403** | «Não tem permissão para esta operação.» | Fechar ou voltar | Texto visível **ou** `aria-label` em PT na ação primária |

- **Prioridade de mensagem:** se o JSON tiver `message` utilizável, `messageFromApiJson` **pode** sobrepor o texto genérico da tabela (AC4), desde que não viole NFR1 (sem URLs internas nem secrets).

### Tasks / Subtasks

- [x] Implementar padrão nas duas superfícies fixas (AC1–2) com copy da tabela ou AC4 (AC6) + **AC7** (nome acessível retry); componente partilhado opcional `ApiErrorBanner`.  
- [x] Garantir que nenhuma mensagem expõe `DATABASE_URL`, pooler ou stack (PRD NFR1, UX §4.2).  
- [x] Smoke manual + nota de a11y no PR (incl. **AC7**: teclado até ao retry + nome na árvore de acessibilidade).

### Dev Notes

- Preferir composição com `Alert`, `Button`, toasts existentes (spec §6).  
- Não alterar shapes JSON da API (FR6).

### Testing

- Smoke manual documentado; teste de componente opcional se existir harness.  
- Verificação **AC7:** Tab até ao botão/link de retry; nome anunciado corresponde ao texto visível ou ao `aria-label` acordado (registar no PR).

---

## SB-05 — Story: *(Opcional)* Cliente Supabase no browser (Nível B / FR8)

**Status:** Blocked — aguarda decisão PO (PRD §7.1) + desenho RLS (@data-engineer).

**Dependências (DoR):** Aprovação escrita do PO para FR8; políticas RLS e lista de tabelas expostas; chave anon apenas com superfície mínima.

**Referências (DoR):** PRD FR8, NFR2; arquitetura §§4, 7; UX spec §4.4.

**Executor Assignment**

- **executor:** `@dev`  
- **quality_gate:** `@data-engineer` + `@architect`

### Story

**As a** produto,  
**I want** usar capacidades Supabase no browser (ex.: Realtime) onde fizer sentido,  
**so that** a experiência em tempo real seja suportada sem comprometer dados entre contas.

### Acceptance Criteria

1. Dependência `@supabase/supabase-js` adicionada **apenas** se PO aprovar; módulo dedicado (ex.: `lib/supabase-browser.ts`) sem inicialização na `layout` raiz sem necessidade (arquitetura §7).  
2. RLS ativa e testada nas tabelas expostas à anon key (NFR2); nenhum dado administrativo via anon.  
3. Cleanup de subscrições ao desmontar componentes (UX §4.4).

### Tasks / Subtasks

- *Não preencher até desbloqueio PO.*

### Testing

- Testes de segurança / smoke documentados com utilizador de teste multi-tenant.

---

## QA Results

**Revisão:** Quinn (QA) · **Data:** 2026-04-22 · **Âmbito:** implementação no repositório vs SB-01…SB-04 (v1.3). SB-05 fora de âmbito.

### Decisão de gate

**CONCERNS** — A implementação cobre de forma sólida os ACs técnicos principais; há lacunas de **evidência de processo** (smoke/PR, lint CI, gate PO humano) e alguns **ajustes menores de UX/comportamento** documentados abaixo. Não bloqueio merge por risco funcional crítico nos critérios revistos, desde que o PO feche o gate formal e o CI esteja verde no ambiente da equipa.

### Rastreio SB-01 (fundação env / FR3)

| Critério | Resultado | Notas |
| --- | --- | --- |
| AC1 `.env.example` + FR2 | **PASS** | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_*`, Better Auth, `READINESS_SECRET`; comentários FR2 claros. |
| AC2 README + migrações | **PASS** | README com pooler Transaction, alinhamento FR1, `db/migrations/`, smoke sugerido. |
| AC3 `DATABASE_URL` ausente → não 200 falso em rota com `getDb()` | **PASS** | `lib/auth.ts` com inicialização lazy do Better Auth; `toPublicApiError` mapeia falha de config para **503** + `message`; `GET /api/v1/me` coberto. |
| AC4 NFR1 sem secrets no diff | **CONCERNS** | `.env.example` só com placeholders; **revisão manual no PR** ainda obrigatória (DoD). |
| Tasks / smoke documentado | **CONCERNS** | Checkboxes das tasks na story continuam `[ ]`; evidência de smoke no PR não está no doc (esperado no fluxo @dev). |

### Rastreio SB-02 (liveness / readiness)

| Critério | Resultado | Notas |
| --- | --- | --- |
| AC1 liveness sem DB | **PASS** | `GET /api/health` inalterado no espírito (JSON mínimo). |
| AC2 readiness + `getDb()` + sem URI na resposta | **PASS** | `GET /api/health/ready`, `runtime = "nodejs"`, `sql\`select 1\``, timeout 2,5s; corpo só `status`. |
| AC3 segredo ou desativado | **PASS** | Sem `READINESS_SECRET` → **503** + `message`/`disabled`; com segredo → `Authorization: Bearer …`. README alinhado. |
| AC4 sem stack em produção | **PASS** | `toPublicApiError` genérico em `NODE_ENV=production`; readiness em falha DB devolve `degraded`, sem stack. |
| DoD teste manual ok/degraded | **CONCERNS** | Evidência manual/PR não anexada na story (processo). |
| Segurança menor | **CONCERNS** | Resposta **401** quando comprimentos token/segredo diferem **antes** de `timingSafeEqual` — pode vazar comprimento do segredo por comparação de tamanho (baixo risco; endurecer com fluxo constant-time opcional). |

### Rastreio SB-03 (fronteira FE/BE)

| Critério | Resultado | Notas |
| --- | --- | --- |
| AC1 cliente (components, hooks, `use client` em app) | **PASS** | Verificação por grep: sem `getDb`/`@repo/db`/`@/lib/db` em `hooks/` e `components/`; `app/**/*.tsx` sem imports proibidos fora de `api/`. |
| AC2 RSC `app/**` exceto `api/**` | **PASS** | ESLint `no-restricted-imports` em `src/app/**/*.{ts,tsx}` com `ignores: src/app/api/**` — alinha com FR5 (mais estrito que só `"use client"`). |
| AC3 ESLint ou script CI | **PASS (ESLint)** | Regra ativa; **CONCERNS**: `npm run lint` falhou num ambiente por dependência `eslint`/`is-regex` — validar CI/local após `pnpm install`. |
| Tasks grep no PR | **CONCERNS** | Relatório/grep explícito no PR ainda responsabilidade do autor do PR. |

### Rastreio SB-04 (UX / a11y)

| Critério | Resultado | Notas |
| --- | --- | --- |
| AC1 página empresas | **PASS** | Erro unificado `me` + lista; 5xx/rede; retry refetch; `role="alert"` + `aria-live="polite"`. |
| AC2 hook `use-accessible-companies` | **PASS** | `issue` + `reload`; `messageFromFailedResponse` + `messageFromApiJson` (via `fe-api-error`). |
| AC3 401 / 403 | **PASS** | 401 → `router.replace` para `/login?next=…`; 403 → copy tabela + link «Voltar ao painel». |
| AC4 `messageFromApiJson` | **PASS** | `fe-api-error.ts` com sanitização básica (URIs/pooler). |
| AC5 `aria-live` / foco retry | **CONCERNS** | `aria-live`/`alert` OK; **foco explícito** no botão «Tentar novamente» após erro (spec «quando aplicável») não implementado — sugerido `ref` + `focus()` ou padrão de design system. |
| AC6 copy PT | **PASS** | Constantes alinhadas à tabela (5xx, rede, 401, 403). |
| AC7 nome acessível retry | **PASS** | Botão com texto visível «Tentar novamente» (suficiente per AC7); `FE_API_COPY.retryAriaLabel` exportado para reutilização. |
| Superfície B só lógica (sem UI) | **OK** | O hook não renderiza controlo; consumidores devem respeitar AC7 ao expor retry (documentar se necessário). |

### Gate PO e qualidade transversal

- **Registo de aprovação PO (v1.3):** ainda **pendente** — critério de release do próprio doc; fora do controlo da revisão de código.
- **CodeRabbit / @architect:** conforme story; não executado nesta revisão.
- **`companies-api.integration.test.ts`:** permanece válido em desenho (mock de sessão); **CONCERNS**: execução em CI exige `DATABASE_URL` (já `skipIf` sem DB).

### Resumo para @dev

1. Marcar tasks/checklists na story ou referenciar PR com evidências (smoke, grep SB-03).  
2. Opcional: endurecer readiness (401 constante sem vazar comprimento de segredo).  
3. Opcional SB-04: foco programático no retry após erro.  
4. Garantir **lint verde** no pipeline após dependências resolvidas.

---

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-04-22 | — | Follow-up QA: readiness sem fuga de comprimento do segredo (SHA-256 + `timingSafeEqual`); `fe-api-error` com ramo 4xx (`client`); foco + `aria-label` no retry (empresas); testes `fe-api-error.test.ts`; README checklist grep; `overrides` `is-regex` na raiz; tasks SB-01…04 marcadas. | Dev |
| 2026-04-22 | 1.3 | Feedback PO 9,5/10: SB-04 **AC7** + coluna nome acessível na tabela; gate PO explícito como assinatura humana; registo alvo v1.3 | SM |
| 2026-04-22 | 1.2 | Feedback PO 9/10: AC2 SB-03 com glob `app/**` exceto `api/**`; SB-04 copy PT mínima + AC6; registo PO alvo v1.2 | SM |
| 2026-04-22 | 1.1 | Refinamento PO: estado conjunto, AC3 SB-01 mensurável, ACs SB-03/SB-04 explícitos, estimativas, SB-05 fora do sprint no cabeçalho | SM |
| 2026-04-22 | 1.0 | Criação do conjunto SB-01…SB-05 | SM |

---

— River, removendo obstáculos
