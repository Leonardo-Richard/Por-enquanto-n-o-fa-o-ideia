# User stories — Incremento: melhorias de confiabilidade, escala, segurança e operação

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** `docs/prd-implementacao-melhorias-sistema.md`, `docs/architecture-implementacao-melhorias-sistema.md`, `docs/front-end-spec-implementacao-melhorias-sistema.md`  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-28  
**Versão do conjunto:** 1.4  
**Estado do conjunto:** Draft
**Sign-off @po:** pendente (modelo: `Aprovado para sprint — AAAA-MM-DD — @po`)

---

## Histórico de avaliações PO (artefato)

| Data | Rev. doc | Nota | Decisão | Observação |
| ---- | -------- | ---- | ------- | ---------- |
| 2026-04-28 | v1.0 | 8,4 | Condicional | Necessário tornar ACs mais objetivos e reforçar evidências/rollback. |
| 2026-04-28 | v1.1 | 9,3 | Condicional | Refino quase completo; pendente consolidação formal de governança e rastreio de aceite. |
| 2026-04-28 | v1.2 | 9,8 | Aprovável para sprint (sign-off pendente) | Critérios PO atendidos; falta registrar aprovação formal no cabeçalho. |
| 2026-04-28 | v1.3 | 9,9 | Aprovável para sprint (sign-off pendente) | Artefato pronto; falta apenas formalização final do aceite PO. |
| 2026-04-28 | v1.4 | — | Atualização documental (SM) | Executor assignment por story; CodeRabbit alinhado ao `core-config`; rollback MSYS-02 corrigido. |
| 2026-04-28 | v1.4 | 9,9 | Aprovável para sprint (sign-off pendente) | Avaliação PO: critérios de clareza, testabilidade, dependências, NFRs mensuráveis e governança de qualidade atendidos; **10,0** após `Sign-off @po` + estado `Approved/Ready`. |

---

## Índice

| ID | Título resumido | Dependências principais |
| -- | ---------------- | ----------------------- |
| **MSYS-01** | CI integração obrigatória para fluxo superadmin | Ambiente de teste com DB real |
| **MSYS-02** | Smoke E2E superadmin com validação FR50 | **MSYS-01** |
| **MSYS-03** | Membros: busca server-side com debounce e paginação | Contrato API `system-users` alinhado |
| **MSYS-04** | ADN: polling adaptativo e redução de chamadas redundantes | Endpoints `adn/sync` já operacionais |
| **MSYS-05** | Cofre de certificado: proteção criptográfica e segredo | Fluxo atual de upload/revogação disponível |
| **MSYS-06** | Rate limit distribuído para sync/upload | **MSYS-04**, **MSYS-05** |
| **MSYS-07** | Dashboard operacional e alertas críticos ADN/certificado | Métricas mínimas instrumentadas |

**Ordem sugerida:** MSYS-01 -> MSYS-02 -> MSYS-03 -> MSYS-04 -> MSYS-05 -> MSYS-06 -> MSYS-07.

---

## Rastreio PRD -> stories

| Story | FR / NFR cobertos (principal) |
| ----- | ------------------------------ |
| MSYS-01 | FR121, FR123, NFR42 |
| MSYS-02 | FR122, FR123, NFR42 |
| MSYS-03 | FR124, FR125, NFR43, NFR49 |
| MSYS-04 | FR126, FR127, NFR44 |
| MSYS-05 | FR128, NFR45 |
| MSYS-06 | FR129, NFR46 |
| MSYS-07 | FR130, FR131, NFR47, NFR48 |

---

## CodeRabbit / quality gate (todas as stories)

- **executor:** `@dev`  
- **revisão sugerida:** `@architect` em MSYS-04..MSYS-07; `@github-devops` em MSYS-01..MSYS-02 (CI/gates)  
- **foco:** contratos HTTP estáveis (sem breaking change), autorização server-side, ausência de segredo em logs, rollback seguro de configuração crítica.

### CodeRabbit CLI (`.aios-core/core-config.yaml`)

Neste repositório **não** existe chave `coderabbit_integration.enabled` no `core-config.yaml`. Seguir o **skip notice** do template de story: revisão de qualidade por **PR + revisores humanos/agents** indicados na tabela abaixo; se no futuro CodeRabbit for ativado, repetir gates equivalentes na CLI.

**Gate mínimo para merge por story:**

1. testes da própria story a verde em CI;
2. nenhum CRITICAL aberto no review automatizado (quando existir) ou resolvido na revisão obrigatória da story;
3. evidência de cobertura dos ACs no corpo do PR (matriz AC -> teste/checklist).

### Revisão especializada por story (tipo e foco)

| Story | Tipo primário | Revisores / gate sugeridos | Foco |
| ----- | ------------- | -------------------------- | ---- |
| MSYS-01 | Deployment / CI | `@dev`, `@github-devops`, `@qa` | workflows, segredos só em secrets do CI, flakes, branch protection |
| MSYS-02 | Deployment / E2E | `@dev`, `@github-devops`, `@qa` | estabilidade smoke, artefatos, dados de teste |
| MSYS-03 | Full-stack (API + UI) | `@dev`, `@architect` | contrato `system-users`, debounce, p95, feature flag |
| MSYS-04 | Frontend + integração | `@dev`, `@architect` | polling, idempotência, métrica NFR44, UX |
| MSYS-05 | Security | `@dev`, `@architect` | cofre, logs, rotação de segredo, compatibilidade |
| MSYS-06 | API / infra distribuída | `@dev`, `@architect` | Redis/limite distribuído, `Retry-After`, concorrência |
| MSYS-07 | Observabilidade / produto interno | `@dev`, `@architect` | authz em `ops/*`, limiares, runbook, ruído de alertas |

---

## Definition of Done (macro)

- Gates obrigatórios de CI (integração + smoke E2E) ativos e bloqueando merge no incremento alvo.
- Busca de membros com server-side query, debounce e paginação sem regressão de ações por linha, com `p95 <= 1200ms` (ou valor formalmente revisado por `@po` + `@architect`).
- Polling ADN adaptativo em produção com redução >= 30% de chamadas por sessão ativa sem queda da taxa de sucesso de jobs (NFR44).
- Certificado com proteção criptográfica, sem material sensível exposto em logs/payloads.
- Rate limit de operações sensíveis funcionando de forma consistente em múltiplas instâncias.
- Dashboard operacional e alertas críticos ativos com runbook versionado em `docs/qa` e validado por teste de mesa.

---

## Critérios PO obrigatórios para aceite

Para qualquer story deste pacote sair de `Draft` para `Approved/Ready` no fluxo PO:

1. ACs com validação objetiva (pass/fail), sem termos subjetivos soltos.
2. PR com matriz `AC -> teste/checklist -> evidência` (link de job, screenshot ou log).
3. Critérios de rollback explícitos quando a story altera CI, segurança, limitação de taxa ou observabilidade.
4. NFRs com número-alvo documentado no PR quando o PRD exigir limite acordado pelo time.
5. Campo `Sign-off @po` no cabeçalho preenchido ao aprovar entrada em sprint.
6. Secção **CodeRabbit / quality gate** e tabela **Revisão especializada por story** respeitadas (CodeRabbit CLI opcional conforme `core-config`).

---

## MSYS-01 — Story: CI integração obrigatória para fluxos superadmin

**Status:** Draft  
**Dependências (DoR):** ambiente de integração com DB real determinístico.  
**Referências:** PRD §6.1, §7 (FR121, FR123), §8 (NFR42); Arquitetura §3.1, §8.

**Executor assignment:** executor `@dev` · quality gate `@github-devops` + `@qa` (CI/gates).

### Story

**As a** engenharia de plataforma,  
**I want** executar suíte de integração superadmin em CI com base real e gate obrigatório,  
**so that** regressões críticas de criação de organização sejam bloqueadas antes do merge.

### Acceptance Criteria

1. Pipeline CI inclui job de integração superadmin com DB real para cenários `201`, `400`, `401`, `403` e `409` de `POST /api/v1/organizations`.
2. Job roda de forma determinística (seed/fixtures estáveis), sem depender de execução manual local.
3. Branch protection exige sucesso deste job para permitir merge no incremento alvo.
4. Falha do job bloqueia merge com sinal claro no status check.
5. Evidência obrigatória no PR: nome do job, link da execução verde e print/log do branch protection com regra ativa.
6. Reprodutibilidade comprovada com 3 execuções consecutivas verdes no mesmo commit de validação.

### Tasks / Subtasks

- [x] Configurar job `integration-superadmin` no workflow de CI.
- [x] Garantir bootstrap de DB/seed isolado para execução repetível.
- [x] Validar matriz de status HTTP exigida e publicar relatório no output de testes.
- [x] Atualizar documentação de pipeline (como reproduzir localmente e no CI).

### Evidências obrigatórias no PR

- Link do workflow `integration-superadmin`.
- Log com cenários `201/400/401/403/409`.
- Captura da proteção de branch exigindo o check.

### Risco e rollback

- **Risco:** falso bloqueio de merge por instabilidade de ambiente.
- **Rollback:** reverter apenas alteração de gate obrigatório mediante aprovação de `@po` + `@qa`, mantendo job disponível como informativo.

---

## MSYS-02 — Story: smoke E2E superadmin com validação de alerta FR50

**Status:** Draft  
**Dependências (DoR):** MSYS-01 concluída.  
**Referências:** PRD §6.1, §7 (FR122, FR123); Arquitetura §3.1, §8.

**Executor assignment:** executor `@dev` · quality gate `@github-devops` + `@qa` (E2E/gates).

### Story

**As a** QA/engenharia,  
**I want** um smoke E2E obrigatório do fluxo administrativo de criação de organização com "Acessar agora",  
**so that** comportamento crítico de ponta a ponta seja validado em CI antes do merge.

### Acceptance Criteria

1. Pipeline CI inclui job `e2e-superadmin-smoke` cobrindo criação de organização + ação "Acessar agora".
2. Cenário valida aviso operacional quando `localAdminLinked === false` em fluxo real.
3. Branch protection exige sucesso do smoke E2E junto com a integração da MSYS-01.
4. Falha do smoke bloqueia merge e expõe logs/artefatos suficientes para diagnóstico.
5. Cenário é executável de forma estável no ambiente de CI definido (3 execuções consecutivas verdes no mesmo commit).
6. Evidência obrigatória no PR: artefato de execução (log e screenshot/video quando disponível) e referência do job no branch protection.

### Tasks / Subtasks

- [x] Implementar/ajustar spec E2E de smoke superadmin.
- [x] Publicar artefatos de execução (log, screenshot/video quando aplicável).
- [x] Integrar job no workflow principal de merge.
- [x] Documentar pré-condições e dados de teste usados no smoke.

### Evidências obrigatórias no PR

- Link do workflow `e2e-superadmin-smoke`.
- Artefatos do cenário "Acessar agora" + validação do aviso FR50.
- Captura da regra de bloqueio de merge incluindo MSYS-01 + MSYS-02.

### Risco e rollback

- **Risco:** flakiness em ambiente E2E.
- **Rollback:** tornar o job E2E temporariamente **não obrigatório** no branch protection (com waivo `@po` + `@qa`, issue linkada e data de reativação do gate) até o smoke ficar estável.

---

## MSYS-03 — Story: membros com busca server-side, debounce e paginação

**Status:** Draft  
**Dependências (DoR):** contrato de `GET .../system-users` disponível para `q`, `page`, `pageSize`.  
**Referências:** PRD §6.2, §7 (FR124, FR125), §8 (NFR43, NFR49); Arquitetura §3.2, §4, §8; Front-end spec §4.1, §5.1.

**Executor assignment:** executor `@dev` · quality gate `@architect` (contrato API + UX).

### Story

**As a** superadmin operacional,  
**I want** filtrar membros por nome/e-mail via busca server-side com debounce,  
**so that** eu opere catálogos grandes com boa responsividade e sem carregar tudo no browser.

### Acceptance Criteria

1. `GET /api/v1/organizations/{organizationId}/system-users` suporta `q`, `page`, `pageSize` e retorna `items`, `page`, `pageSize`, `total`.
2. Frontend aplica debounce no input de busca (300ms recomendado) e cancela requests obsoletas.
3. Tabela preserva ações por linha (`Editar`, `Remover vínculo`, `Adicionar à organização`) sem regressão funcional.
4. UI exibe estado de consulta discreto (`A procurar...`) sem bloquear a página inteira.
5. Ao alterar `q`, paginação reinicia para página 1.
6. Alvo-base de aceite para esta story: `p95 <= 1200ms` em staging para a consulta principal de membros; se o time ajustar o alvo na planning, o novo valor deve ser registrado no PR com aprovação `@po` + `@architect`.
7. Feature flag `MEMBERS_SERVER_SEARCH_ENABLED` controla rollout incremental e permite fallback para comportamento anterior.

### Tasks / Subtasks

- [x] Implementar filtro e paginação server-side no endpoint de membros.
- [x] Atualizar hook/serviço de frontend para query com debounce + cancelamento.
- [x] Ajustar estados de loading/erro/vazio conforme spec UX.
- [ ] Cobrir integração e E2E para busca + ações por linha.

### Evidências obrigatórias no PR

- Matriz `AC -> teste` cobrindo busca, paginação, debounce e ações por linha.
- Medição de p95 com valor alvo declarado.
- Evidência da feature flag ligada/desligada.

### Risco e rollback

- **Risco:** degradação de latência no endpoint `system-users`.
- **Rollback:** desligar `MEMBERS_SERVER_SEARCH_ENABLED` e retornar ao fluxo anterior até ajuste de consulta/índice.

---

## MSYS-04 — Story: ADN com polling adaptativo e redução de chamadas

**Status:** Draft  
**Dependências (DoR):** endpoints `GET/POST .../adn/sync` estáveis e idempotência vigente.  
**Referências:** PRD §6.3, §7 (FR126, FR127), §8 (NFR44); Arquitetura §3.3, §4, §8; Front-end spec §4.2, §5.2.

**Executor assignment:** executor `@dev` · quality gate `@architect` (polling + contratos ADN).

### Story

**As a** utilizador do painel ADN,  
**I want** acompanhar sincronização com polling adaptativo em vez de polling fixo,  
**so that** receba feedback claro com menos carga de API e menor custo operacional.

### Acceptance Criteria

1. Frontend utiliza polling adaptativo por estado do job (`queued`, `running`, terminal), com parada em estados finais.
2. Um único loop de polling fica ativo por organização/empresa no contexto da tela.
3. Requisições redundantes de status/readiness/certificate são reduzidas sem perda de feedback de progresso.
4. `POST .../adn/sync` mantém idempotência e semântica de `202`, `403`, `429`.
5. Toasters/mensagens evitam repetição para o mesmo `jobId + status`.
6. Métrica de requests por sessão ativa é comparada com baseline do ciclo anterior e comprova redução >= 30% (NFR44), sem queda da taxa de sucesso dos jobs.
7. Feature flag `ADN_ADAPTIVE_POLLING_ENABLED` controla rollout e fallback rápido.

### Tasks / Subtasks

- [x] Implementar hook de polling adaptativo com backoff e estado terminal.
- [ ] Consolidar chamadas concorrentes redundantes no fluxo ADN.
- [ ] Ajustar UX de status (linha única de estado + timestamp + atualização manual).
- [ ] Criar testes de integração/componente para estados e semântica HTTP.

### Evidências obrigatórias no PR

- Baseline de chamadas/sessão vs resultado pós-mudança (com percentual).
- Evidência de manutenção de taxa de sucesso de jobs.
- Evidência da feature flag habilitada/desabilitada.

### Risco e rollback

- **Risco:** backoff agressivo degradar percepção de atualização.
- **Rollback:** desativar `ADN_ADAPTIVE_POLLING_ENABLED` e restaurar polling anterior enquanto recalibra intervalos.

---

## MSYS-05 — Story: cofre de certificado com proteção criptográfica

**Status:** Draft  
**Dependências (DoR):** fluxo atual de upload/revogação em produção.  
**Referências:** PRD §6.4, §7 (FR128), §8 (NFR45); Arquitetura §3.4, §5; Front-end spec §4.3, §5.3.

**Executor assignment:** executor `@dev` · quality gate `@architect` (segurança / cofre).

### Story

**As a** responsável por segurança/compliance,  
**I want** que payload de certificado seja armazenado com proteção criptográfica e segredo gerenciado,  
**so that** dados sensíveis não fiquem expostos em banco, logs ou respostas públicas.

### Acceptance Criteria

1. Payload de certificado é armazenado em cofre/objeto privado com proteção criptográfica gerenciada.
2. Banco de negócio mantém apenas metadados operacionais e referência opaca ao artefato.
3. Upload/revogação mantém compatibilidade funcional com o fluxo existente.
4. Logs e erros não expõem conteúdo sensível, senha ou segredo do certificado.
5. Runbook mínimo de rotação/gestão de segredo é versionado em `docs/qa` com passos de rotação e validação pós-rotação.
6. Suite de teste/log scan valida ausência de material sensível em logs e respostas públicas dos endpoints de certificado.

### Tasks / Subtasks

- [x] Ajustar camada de armazenamento de certificado para referência opaca.
- [x] Sanitizar logs/erros de endpoints de certificado.
- [x] Validar compatibilidade de contratos com frontend atual.
- [x] Documentar operação de segredo/chave (rotação e fallback).

### Evidências obrigatórias no PR

- Link do runbook com política de rotação.
- Testes de compatibilidade upload/revogação.
- Evidência de sanitização (teste automatizado ou log scan reproduzível).

### Risco e rollback

- **Risco:** indisponibilidade por erro de chave/segredo na rotação.
- **Rollback:** procedimento documentado de retornar chave anterior + validação funcional imediata do endpoint.

---

## MSYS-06 — Story: rate limit distribuído para sync/upload

**Status:** Draft  
**Dependências (DoR):** MSYS-04 e MSYS-05 com fluxos estabilizados.  
**Referências:** PRD §6.4, §7 (FR129), §8 (NFR46); Arquitetura §3.4.

**Executor assignment:** executor `@dev` · quality gate `@architect` (rate limit distribuído).

### Story

**As a** engenharia de plataforma,  
**I want** aplicar rate limit distribuído para operações sensíveis de sync/upload,  
**so that** proteção contra abuso seja consistente entre múltiplas instâncias de aplicação.

### Acceptance Criteria

1. Limitação de taxa deixa de depender apenas de estado local do processo.
2. Chave de limitação considera ação + contexto (`userId`, `organizationId`, `companyId`) conforme arquitetura.
3. Respostas de limite incluem comportamento consistente e `Retry-After` utilizável.
4. Operações de sync/upload mantêm contratos existentes (`202`, `403`, `429`) sem breaking change.
5. Testes de concorrência entre instâncias validam consistência do limite.
6. Evidência obrigatória no PR mostra comportamento equivalente do limite em pelo menos 2 instâncias de aplicação.

### Tasks / Subtasks

- [x] Integrar backend distribuído de rate limit para rotas sensíveis.
- [x] Aplicar política comum entre sync e certificado.
- [x] Instrumentar métrica de taxa de `429` por ação/contexto.
- [ ] Criar suíte de teste para cenários concorrentes multi-instância.

### Evidências obrigatórias no PR

- Teste de concorrência multi-instância com `Retry-After`.
- Métrica de `429` por ação/contexto antes e depois.
- Registro do backend distribuído adotado e estratégia de fallback.

### Risco e rollback

- **Risco:** inconsistência de limite em falha parcial do backend distribuído.
- **Rollback:** chave de feature para voltar a limitação local temporária, com aviso operacional e janela curta até correção.

---

## MSYS-07 — Story: dashboard operacional e alertas críticos ADN/certificado

**Status:** Draft  
**Dependências (DoR):** MSYS-04..MSYS-06 com métricas emitidas.  
**Referências:** PRD §6.5, §7 (FR130, FR131), §8 (NFR47, NFR48); Arquitetura §3.4, §6; Front-end spec §4.4, §5.4.

**Executor assignment:** executor `@dev` · quality gate `@architect` (ops dashboard + alertas).

### Story

**As a** equipa de suporte/engenharia,  
**I want** um dashboard operacional mínimo com alertas ativos de ADN/certificado,  
**so that** eu reduza tempo de detecção e resposta a falhas críticas.

### Acceptance Criteria

1. Dashboard expõe indicadores mínimos: fila, sucesso/falha, latência p95 e taxa de `429`.
2. Endpoints de leitura agregada para operações (`ops/metrics`, `ops/alerts`) protegidos por autorização server-side.
3. Alertas críticos são gerados para falha de sync, pico de `429` e falhas recorrentes de certificado.
4. Logs/métricas permitem correlação por `organizationId`, `companyId`, `userId`, `jobId`.
5. Runbook mínimo define canal, severidade e ação inicial para alertas críticos.
6. Interface permite drill-down para contexto de organização/empresa no diagnóstico.
7. PR define limiares explícitos para cada alerta crítico e demonstra teste/simulação de disparo.

### Tasks / Subtasks

- [x] Implementar endpoints agregados de métricas e alertas com filtros por janela temporal.
- [x] Construir dashboard com KPIs, tendências e lista de alertas ativos.
- [ ] Configurar regras de alerta e integração com canal operacional.
- [x] Documentar runbook e validar fluxo de resposta em teste de mesa.

### Evidências obrigatórias no PR

- Screenshot/registro do dashboard com KPIs mínimos.
- Configuração de alerta com limiares e severidades.
- Link do runbook e resultado do teste de mesa.

### Risco e rollback

- **Risco:** excesso de alertas ruidosos e fadiga operacional.
- **Rollback:** ajustar limiares para modo conservador e manter apenas alertas críticos enquanto calibra sinal.

---

## Matriz consolidada de aceite (PO)

| Story | AC crítico de aceite | Evidência mínima obrigatória | Dono principal | Gate |
| ----- | --------------------- | ---------------------------- | -------------- | ---- |
| MSYS-01 | Gate integração obrigatório e determinístico | Job verde + branch protection + 3 execuções consecutivas | `@dev` | `@po` + `@qa` |
| MSYS-02 | Smoke E2E obrigatório com validação FR50 | Artefato E2E + regra required + 3 execuções consecutivas | `@dev` | `@po` + `@qa` |
| MSYS-03 | Busca server-side sem regressão + p95 dentro do alvo | Matriz AC->teste + medição p95 + evidência de flag | `@dev` | `@po` + `@architect` |
| MSYS-04 | Redução >= 30% de chamadas/sessão sem perda de sucesso | Baseline vs pós + taxa de sucesso + evidência de flag | `@dev` | `@po` + `@architect` |
| MSYS-05 | Proteção criptográfica e sanitização de sensíveis | Runbook + testes de compatibilidade + log scan | `@dev` | `@po` + `@architect` |
| MSYS-06 | Rate limit distribuído consistente multi-instância | Teste concorrente + `Retry-After` + métrica `429` | `@dev` | `@po` + `@architect` |
| MSYS-07 | Dashboard/alertas com limiares explícitos e teste de disparo | Screenshot + config de alertas + runbook + teste de mesa | `@dev` | `@po` + `@architect` |

---

## Fechamento PO (checklist de aprovação final)

Para mover o pacote para `Approved/Ready`:

- [ ] `Sign-off @po` preenchido no cabeçalho com data e responsável.
- [ ] Linha final adicionada no Histórico de avaliações PO com decisão "Aprovado para sprint".
- [ ] Matriz `AC -> teste/checklist -> evidência` anexada no PR da story em execução (MSYS-01 inicialmente).
- [ ] Confirmação de backlog/sprint com ordem de execução mantida ou ajuste formalmente registrado.

---

## Modelo pronto de aprovação PO

Usar este bloco ao finalizar o aceite formal:

1. Cabeçalho:
   - `Sign-off @po: Aprovado para sprint — AAAA-MM-DD — @po`

2. Nova linha no histórico:

| Data | Rev. doc | Nota | Decisão | Observação |
| ---- | -------- | ---- | ------- | ---------- |
| AAAA-MM-DD | v1.4 | 10,0 | Aprovado para sprint | Sign-off formal registrado; pacote liberado para execução MSYS-01 -> MSYS-07. |

---

## Próximos passos (AIOS)

1. `@po`: executar `*validate-story-draft` deste pacote e priorizar ordem de sprint.
2. `@dev`: iniciar implementação por MSYS-01 (redução imediata de risco de release).
3. `@qa`: preparar matriz de teste por story, com foco em gates CI e regressão de contratos.
4. `@architect`: fechar pendências da arquitetura (rate limit distribuído, fonte agregada do dashboard, retenção de certificado).
5. `@po`: ao aprovar para sprint, preencher `Sign-off @po` e adicionar nova linha no histórico de avaliações com decisão final.

---

## Dev Agent Record

### Change Log

- 2026-04-28 — Resposta a QA (CONCERNS): job `quality` deixa de duplicar `organizations-create.integration.test.ts`; `ops/*` com `windowMinutes`/`partial`/`schemaVersion`; dashboard MVP `/admin/operacao`; telemetria `__portalAdnSyncGetCount`; logs JSON `rate_limit_429` em ADN upload e certificado; dedupe toast 429; documentação de flags, p95, NFR44, evidência Upstash; testes `ops-aggregates-window`, `company-certificate-log-hygiene`.

### File List

- `.github/workflows/ci.yml`
- `frontend/package.json`
- `frontend/src/lib/adn-sync-client.ts`, `adn-sync-telemetry.ts`
- `frontend/src/hooks/use-adn-sync-for-company.ts`
- `frontend/src/server/api/v1/handlers/ops-aggregates.ts`, `adn-sync.ts`, `company-certificate.ts`
- `frontend/src/components/admin/admin-ops-dashboard.tsx`, `organizations-admin-page.tsx`
- `frontend/src/app/(dashboard)/admin/operacao/page.tsx`
- `frontend/src/server/api/v1/handlers/ops-aggregates-window.test.ts`, `frontend/src/lib/company-certificate-log-hygiene.test.ts`
- `docs/qa/feature-flags-incremento-msys.md`, `nfr-members-search-p95.md`, `adn-nfr44-baseline-procedure.md`, `rate-limit-distributed-evidence.md`
- `docs/qa/ci-pipeline-reproducao.md`, `docs/qa/ops-alerts-runbook.md`

---

## QA Results

**Revisão:** Quinn (QA) — 2026-04-28  
**Âmbito:** implementação no repositório (workflow CI, handlers, hooks, `docs/qa` associados) face aos ACs e DoD macro do conjunto **MSYS-01..MSYS-07**.  
**Decisão de gate:** **CONCERNS** (base sólida em CI, API e limites; **DoD macro e vários ACs ainda não comprováveis** só com o código/artefactos atuais).

### Rastreio por story

| Story | Gate | Síntese |
| ----- | ---- | -------- |
| **MSYS-01** | **CONCERNS** | Job `integration-superadmin` com Postgres, migrações e `test:integration-superadmin` alinha-se aos ACs 1, 2 e 4. **AC 3, 5, 6** dependem de **configuração GitHub** (branch protection, checks obrigatórios) e de **evidência no PR** (print, 3 runs) — fora do repo. Risco: job `quality` ainda executa suíte completa `pnpm test` (pode incluir integração além do job dedicado); não é bloqueante se o gate obrigatório for só `integration-superadmin`. |
| **MSYS-02** | **CONCERNS** | Job `e2e-superadmin-smoke` com `needs: [quality, integration-superadmin]`, Playwright e upload de artefactos cumpre AC 1, 3 (estruturalmente) e 4. **AC 2** (FR50 / `localAdminLinked === false`) coberto no spec existente, mas exige **verificação em execução CI** e evidência. **AC 5–6** e branch protection: idem MSYS-01. |
| **MSYS-03** | **CONCERNS** | `q` + `ilike` no handler, teste de integração com `q`, debounce 300ms + `AbortSignal`, texto “A procurar…”, flag **`NEXT_PUBLIC_MEMBERS_SERVER_SEARCH_ENABLED`** (sem prefixo no AC textual — documentar no PR). **AC 6 (p95)** e **E2E/ações por linha** (task aberta) **não evidenciados**. |
| **MSYS-04** | **CONCERNS** | Polling adaptável por estado, `refresh({ silent })`, flag **`NEXT_PUBLIC_ADN_ADAPTIVE_POLLING_ENABLED`**. **AC 3–6** (consolidar chamadas redundantes, toasters por `jobId+status`, **baseline −30%**, métrica NFR44) **por demonstrar**. Tasks UX/consolidação/testes ainda parciais na story. |
| **MSYS-05** | **CONCERNS** | Runbook em `docs/qa/certificate-vault-rotation.md`; modelo cofre/`vault_ref` já alinhado ao AC de referência opaca. **AC 6** (suite de log scan reproduzível dedicada a certificado) **não verificado** nesta revisão estática. |
| **MSYS-06** | **CONCERNS** | `consumeDistributedOrLocalRateLimit` + Upstash quando env presente; `Retry-After` mantido nos fluxos já existentes. **AC 1** só plenamente verdadeiro **com Redis em produção**; sem credenciais permanece fallback memória (documentado via `RATE_LIMIT_LOCAL_ONLY`). **AC 5–6** e métrica **429** por contexto: **tasks abertas**; falta evidência multi-instância. |
| **MSYS-07** | **CONCERNS** | `GET /api/v1/ops/metrics` e `/ops/alerts` com **superadmin** — OK para autorização base. Resposta **MVP com valores `null`**, sem agregação real; **sem filtros de janela temporal na query** apesar da task marcada; **AC 1, 3, 4, 6, 7** do dashboard/alertas **não cumpridos**. Runbook `docs/qa/ops-alerts-runbook.md` existe; **teste de mesa** e **dashboard UI** pendentes. |

### Definition of Done (macro)

| Item DoD | Estado |
| -------- | ------ |
| CI integração + smoke E2E **bloqueando merge** | **Parcial** — workflows prontos; **branch protection** é ação manual org/repo. |
| Busca membros + p95 ≤ 1200 ms | **Parcial** — funcionalidade + flag; **sem medição p95** reportada. |
| ADN −30% chamadas/sessão | **Não comprovado** — falta baseline/evidência. |
| Certificado sem exposição em logs | **Parcial** — runbook + padrões existentes; **scan dedicado** opcional. |
| Rate limit multi-instância | **Parcial** — código distribuído; **testes/evidência** em falta. |
| Dashboard + alertas + runbook + teste mesa | **Parcial** — APIs stub + runbook; **sem dashboard nem alertas reais**. |

### Riscos destacados

1. **Duplicação de custo CI:** `quality` corre todos os testes; `integration-superadmin` duplica DB + parte da matriz — aceitável para gate nomeado, mas monitorizar tempo de pipeline.
2. **Feature flags:** nomes env (`NEXT_PUBLIC_*`) vs PRD (`MEMBERS_SERVER_SEARCH_ENABLED`, `ADN_ADAPTIVE_POLLING_ENABLED`) — alinhar na documentação do PR para operações.
3. **MSYS-07:** endpoints stub podem ser confundidos com “pronto para produção”; recomenda-se contrato estável (`null` vs omitir) até ligar fontes reais.

### Recomendações para `@dev` (prioridade)

1. Fechar tasks abertas na story: MSYS-03 E2E membros; MSYS-04 consolidação + métrica NFR44; MSYS-06 métrica 429 + teste concorrência (ou documentar waivo); MSYS-07 dashboard + alertas ou baixar escopo formal no doc.
2. Anexar ao PR matriz **AC → teste/evidência** e, para NFRs, números ou waivo `@po`/`@architect`.
3. Coordenar com `@github-devops`: branch protection nos checks `integration-superadmin` e `e2e-superadmin-smoke`.

### Nota sobre CodeRabbit

Conforme cabeçalho do artefacto: **sem** `coderabbit_integration` no `core-config.yaml` — revisão humana/agentes mantém-se obrigatória; quando existir PR, repetir verificações de segurança em rotas `ops/*` e handlers sensíveis.

---

— River (SM) — AIOS; stories MSYS-01..MSYS-07 derivadas de PRD, arquitetura e spec de front-end do ciclo de melhorias.
