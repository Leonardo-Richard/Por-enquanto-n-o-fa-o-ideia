# PRD — Implementação das melhorias prioritárias de confiabilidade, escala e operação

**Documento:** requisitos de produto para execução do ciclo de melhorias descrito em `docs/briefing-implementacao-melhorias-sistema.md`.  
**Normativa integrada:** `docs/prd.md`, `docs/prd-superadmin-cadastro-organizacoes-acesso-global.md`, `docs/prd-membros-catalogo-utilizadores-filtro-dinamico.md`, `docs/prd-upload-certificado-browser-edicao-empresa-monitorada.md`, `docs/prd-integracao-nfse-dist-adn.md`.  
**Contexto operacional observado:** fluxo ativo em dev com recorrência de chamadas em endpoints ADN e pendências de gate de qualidade do incremento superadmin.

**Change log:**

| Data       | Versão | Descrição | Autor |
| ---------- | ------ | --------- | ----- |
| 2026-04-28 | 1.0    | PRD inicial do ciclo de melhorias: qualidade de release, escalabilidade de membros, otimização ADN, segurança de certificados e observabilidade operacional. | PM (Morgan / AIOS) |

**Numeração:** este PRD inicia em **FR121** e **NFR42**, preservando continuidade com incrementos anteriores.

---

## 1. Objetivos de produto

1. Aumentar a previsibilidade de release com gate de qualidade robusto (integração + E2E).
2. Melhorar escalabilidade da experiência de gestão de membros em bases de utilizadores maiores.
3. Reduzir custo operacional e carga de API no fluxo ADN sem perda de feedback ao utilizador.
4. Reforçar segurança de armazenamento de certificado com padrão adequado para produção.
5. Tornar operação orientada por sinais (métricas e alertas) para reduzir tempo de resposta a incidentes.

**Métrica de sucesso primária:** reduzir regressões pós-release em fluxos administrativos críticos para próximo de zero no ciclo trimestral seguinte, com cobertura de integração/E2E executada em CI.

---

## 2. Contexto e problema

### 2.1 Situação atual

O produto já cobre fluxos críticos de:

- cadastro de organização por superadmin;
- gestão de membros com catálogo global;
- sincronização ADN e upload/estado de certificado.

### 2.2 Dor operacional

1. Parte do gate de qualidade ainda depende de execução/condição de ambiente.
2. A listagem global de membros, no modelo atual, tende a degradar com crescimento de volume.
3. O fluxo ADN apresenta padrão de polling que pode elevar carga e custo de backend.
4. O cofre de certificados precisa de hardening para cenários de compliance mais exigentes.
5. Falta padronização mínima de dashboards/alertas orientados a negócio e operação.

### 2.3 Resultado esperado

Um ciclo de melhorias incremental (30 dias) que fortaleça confiabilidade, performance, segurança e observabilidade sem interromper fluxos já entregues.

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| Gate de release | Integração crítica e smoke E2E tornam-se requisitos de merge para o incremento alvo. |
| Escala de membros | Evoluir de filtro local completo para busca server-side com debounce e paginação eficiente. |
| ADN status updates | Priorizar polling adaptativo com backoff; SSE/WebSocket fica como evolução incremental controlada. |
| Certificados | Endurecer armazenamento com proteção criptográfica e gestão explícita de segredo/chave. |
| Observabilidade | Definir baseline obrigatório de métricas, dashboard operacional e alertas de alta severidade. |

---

## 4. Fora de âmbito (este ciclo)

1. Reescrita completa de interface administrativa.
2. Migração arquitetural total para paradigma orientado a eventos em toda a plataforma.
3. Revisão global de todos os papéis/permissões fora dos módulos envolvidos neste PRD.
4. Refatoração abrangente de todos os endpoints legados não relacionados aos objetivos do ciclo.

---

## 5. Personas e impacto

| Persona | Necessidade | Resultado esperado |
| ------- | ----------- | ------------------ |
| Superadmin operacional | Fluxos estáveis para criação/acesso e gestão de utilizadores | Menos falhas em produção e menos retrabalho manual |
| Equipe de suporte/compliance | Diagnóstico rápido de incidentes e ações sensíveis | Métricas e trilhas operacionais consistentes |
| Engenharia | Menor risco de regressão e melhor eficiência de backend | CI confiável, menos chamadas redundantes, melhor previsibilidade |
| QA | Critérios objetivos de aceitação e bloqueio de release | Gate automatizado claro e repetível |

---

## 6. Escopo funcional detalhado

### 6.1 Qualidade de release (organizações/superadmin)

- consolidar execução de integração com base real em CI para cenários críticos;
- garantir smoke E2E cobrindo fluxo administrativo completo e alerta FR50 em fluxo real;
- transformar falhas desses cenários em bloqueio explícito de merge do incremento.

### 6.2 Escala da gestão de membros

- introduzir filtro com busca no servidor (com debounce no cliente);
- manter ações por linha (`Editar`, `Remover vínculo`, `Adicionar à organização`) sem regressão funcional;
- reduzir uso de memória no browser evitando carregamento total por padrão.

### 6.3 Eficiência do ADN

- substituir polling fixo por estratégia adaptativa com backoff;
- reduzir chamadas redundantes para endpoints de status/readiness/certificate;
- preservar clareza de estado no frontend durante execução de jobs.

### 6.4 Segurança e operação de certificado

- reforçar proteção de payload sensível no cofre;
- preparar comportamento consistente para limites de taxa em cenário distribuído;
- manter compatibilidade com fluxo atual de upload/revogação.

### 6.5 Observabilidade operacional

- disponibilizar métricas mínimas de negócio e operação;
- criar painel de acompanhamento para ADN/certificado;
- configurar alertas para falhas críticas e anomalias de taxa.

---

## 7. Requisitos funcionais

| ID | Descrição |
| -- | --------- |
| **FR121** | O sistema deve executar em CI uma suíte de integração com base de dados real para os cenários críticos de criação de organizações, incluindo validações de `201`, `400`, `401`, `403` e `409` definidos no incremento superadmin. |
| **FR122** | O sistema deve executar smoke E2E em CI para o fluxo administrativo de criação de organização com ação "Acessar agora", incluindo validação do aviso operacional quando `localAdminLinked === false` no fluxo real. |
| **FR123** | O sistema deve bloquear merge do incremento alvo quando jobs de integração ou smoke E2E obrigatórios falharem. |
| **FR124** | A área de membros deve oferecer filtragem por nome/e-mail com estratégia server-side, mantendo semântica de ações por linha para membro e não membro sem regressão dos contratos existentes. |
| **FR125** | O frontend deve aplicar debounce no input de filtro de membros para evitar bursts de requisições e reduzir carga de backend durante digitação. |
| **FR126** | O fluxo ADN deve usar atualização de estado com polling adaptativo (backoff) e reduzir chamadas redundantes aos endpoints de status sem perda de feedback de progresso para o utilizador. |
| **FR127** | O sistema deve manter idempotência e rastreabilidade no pedido de sincronização ADN, preservando semântica atual de `202`, `403`, `429` e erros operacionais. |
| **FR128** | O fluxo de upload de certificado deve armazenar o conteúdo com proteção criptográfica adequada e gestão de segredo/chave compatível com ambiente de produção. |
| **FR129** | Limites de taxa para operações sensíveis (sync/upload) devem funcionar de forma consistente em ambiente com múltiplas instâncias de aplicação. |
| **FR130** | O produto deve expor dashboard operacional mínimo para ADN/certificados com indicadores de fila, sucesso/falha, latência e taxa de limitação (`429`). |
| **FR131** | O sistema deve emitir alertas para falhas críticas de sincronização e certificado com sinal utilizável por suporte/engenharia em tempo operacional. |

---

## 8. Requisitos não funcionais

| ID | Descrição |
| -- | --------- |
| **NFR42** | O gate de qualidade deste ciclo deve operar de forma determinística em CI, sem depender de execução local manual para validar critérios de aceite críticos. |
| **NFR43** | O módulo de membros deve manter responsividade perceptível em catálogos grandes, com p95 de resposta monitorado e dentro de limite acordado pelo time. |
| **NFR44** | O fluxo ADN deve reduzir volume médio de chamadas por sessão ativa em pelo menos 30% comparado ao baseline do ciclo anterior, sem piorar taxa de sucesso de jobs. |
| **NFR45** | Dados sensíveis de certificado e respetivos segredos não devem ser expostos em logs, payloads públicos ou armazenamento sem proteção adequada. |
| **NFR46** | Estratégia de limitação de taxa deve ser compatível com execução distribuída e não depender de estado apenas local de processo em produção. |
| **NFR47** | Logs e métricas devem permitir correlação por `organization_id`, `company_id`, `user_id` e `job_id` nos fluxos críticos deste PRD. |
| **NFR48** | Alertas críticos devem possuir canal e severidade definidos, com documentação de resposta operacional (runbook mínimo). |
| **NFR49** | Alterações deste ciclo devem preservar compatibilidade dos contratos públicos já usados por clientes internos da aplicação. |

---

## 9. Objetivos de UX/UI

1. Preservar simplicidade operacional para superadmin, evitando aumento de fricção no fluxo de membros.
2. Melhorar percepção de velocidade no filtro de utilizadores durante digitação.
3. Exibir estados do ADN com clareza, sem oscilações excessivas de loading e sem ruído de mensagens redundantes.
4. Garantir mensagens de erro operacionais e acionáveis em falhas de sync/certificado.

---

## 10. Pressupostos técnicos (para alinhamento com `@architect`)

1. O repositório mantém padrão Next.js + APIs em `frontend/src/app/api/v1`.
2. Persistência e esquemas continuam com o stack atual (Drizzle/Postgres/Supabase).
3. Fluxos de membros e superadmin já existentes serão evoluídos sem quebra de contrato.
4. Estratégia de métrica/alerta será definida com a stack já adotada pelo projeto.
5. Hardening de cofre de certificado deve respeitar políticas de segredo existentes no ambiente.

---

## 11. Fluxos principais

### 11.1 Release gate (qualidade)

1. PR do incremento é aberto.
2. CI executa integração crítica com DB.
3. CI executa smoke E2E administrativo.
4. Merge só é permitido com ambos os gates aprovados.

### 11.2 Membros com filtro escalável

1. Superadmin abre tela de membros da organização.
2. Sistema carrega página inicial do catálogo.
3. Digitação aciona busca com debounce.
4. Tabela reflete resultados sem necessidade de carregar catálogo completo.

### 11.3 ADN com backoff

1. Utilizador solicita sincronização.
2. Job é aceite/enfileirado.
3. Frontend acompanha status com polling adaptativo.
4. Estado final é exibido com menos chamadas redundantes.

### 11.4 Certificado e observabilidade

1. Upload/revogação ocorre no fluxo atual com armazenamento reforçado.
2. Métricas e logs atualizam dashboard.
3. Alertas disparam em falhas críticas.
4. Suporte atua com base em runbook.

---

## 12. Contratos e comportamento de API (nível produto)

- Contratos existentes devem ser preservados para:
  - `POST /api/v1/organizations`;
  - `POST /api/v1/session/active-organization`;
  - `GET /api/v1/organizations/{organizationId}/system-users`;
  - `GET/POST /api/v1/organizations/{organizationId}/monitored-companies/{companyId}/adn/sync`;
  - `GET/POST/DELETE /api/v1/organizations/{organizationId}/monitored-companies/{companyId}/certificate`.

- Alterações deste ciclo devem priorizar comportamento interno (qualidade, eficiência, segurança, observabilidade), sem breaking change para UI atual.

---

## 13. Segurança e compliance

1. Controle de acesso continua validado no servidor para todos os fluxos críticos.
2. Segredos e dados sensíveis de certificado exigem proteção criptográfica e política de rotação.
3. Logs não podem expor material sensível em texto claro.
4. Eventos críticos devem permanecer auditáveis.

---

## 14. Critérios de aceite globais do PRD

1. CI bloqueia merge quando integração crítica ou smoke E2E obrigatórios falham.
2. Fluxo de membros mantém comportamento funcional e melhora escalabilidade perceptível.
3. Fluxo ADN apresenta redução de chamadas com manutenção de feedback de estado.
4. Armazenamento de certificado atende padrão reforçado de segurança definido pelo time.
5. Dashboard e alertas mínimos estão ativos para acompanhamento operacional de ADN/certificados.

---

## 15. Épicos sugeridos

1. **Epic M1 — Confiabilidade de release**
   - Integração com DB em CI, smoke E2E superadmin, gates de merge.

2. **Epic M2 — Escala de membros**
   - Busca server-side, debounce, paginação eficiente, validação de regressão funcional.

3. **Epic M3 — Eficiência do ADN**
   - Polling adaptativo, redução de chamadas redundantes, monitoramento de impacto.

4. **Epic M4 — Segurança e operação**
   - Hardening do cofre de certificado, rate limit distribuído, dashboard e alertas.

---

## 16. Histórias sugeridas (para `@sm`)

| ID sugerido | Título |
| ----------- | ------ |
| **MSYS-01** | CI integração obrigatória para fluxos superadmin |
| **MSYS-02** | Smoke E2E superadmin com validação de FR50 |
| **MSYS-03** | Membros: busca server-side com debounce e paginação |
| **MSYS-04** | ADN: polling adaptativo e redução de requisições redundantes |
| **MSYS-05** | Cofre de certificado: proteção criptográfica e política de segredo |
| **MSYS-06** | Rate limit distribuído para sync/upload |
| **MSYS-07** | Dashboard operacional e alertas críticos ADN/certificado |

---

## 17. Plano de entrega (30 dias)

| Semana | Foco | Entrega-chave |
| ------ | ---- | ------------- |
| 1 | Qualidade de release | Integração + E2E em CI com gate de merge |
| 2 | Escala de membros | Busca server-side com debounce |
| 3 | Eficiência ADN | Backoff e redução de chamadas |
| 4 | Segurança e observabilidade | Hardening de certificado, rate limit distribuído, dashboard/alertas |

---

## 18. Métricas e KPIs

1. Sucesso de pipeline (integração + E2E) >= 95%.
2. Redução >= 30% do volume médio de requests ADN por sessão ativa.
3. p95 estável para listagem/filtro de membros em base ampliada.
4. Redução de erros operacionais (`429`/`5xx`) em endpoints críticos.
5. Melhoria de MTTD/MTTR para incidentes de sync/certificado.

---

## 19. Riscos e mitigação

| Risco | Mitigação |
| ----- | --------- |
| Instabilidade de CI por ambiente de dados | Ambiente de testes padronizado com seed/fixtures determinísticos |
| Regressão de UX na migração para server-side filter | Entrega incremental com testes comparativos e fallback |
| Complexidade de gestão de segredo/chave | Runbook de operação e rotação com validação pré-produção |
| Aumento de custo de observabilidade | Começar com baseline mínimo e expandir por criticidade |

---

## 20. Dependências e alinhamentos

1. `@architect`: validar desenho técnico de backoff, cofre e rate limit distribuído.
2. `@sm`: quebrar épicos M1-M4 em stories com AC testáveis.
3. `@qa`: fechar matriz de testes de regressão e gates obrigatórios.
4. `@dev`: implementação incremental sem ruptura de contrato.
5. `@pm`: consolidar FR/NFR no `docs/prd.md` em revisão macro futura.

---

## 21. Próximos passos (AIOS)

1. Aprovar este PRD com produto, arquitetura, QA e engenharia.
2. Criar histórias MSYS-01 a MSYS-07 com estimativas e dependências.
3. Iniciar execução por M1 (semana 1), priorizando redução de risco de release.

---

## 22. Checklist de saída (PM)

- [x] Objetivos e escopo definidos.
- [x] Requisitos funcionais e não funcionais numerados.
- [x] Critérios globais de aceite explícitos.
- [x] Épicos, histórias e plano de entrega definidos.
- [x] Métricas, riscos, dependências e próximos passos documentados.

---

— Morgan (PM) — AIOS; PRD baseado em `docs/briefing-implementacao-melhorias-sistema.md` e alinhado aos PRDs incrementais ativos do projeto.
