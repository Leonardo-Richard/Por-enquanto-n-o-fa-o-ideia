# Briefing de Implementação — Melhorias Prioritárias do Sistema

## 1) Contexto

O sistema evoluiu bem nos fluxos de:

- gestão de organizações por superadmin;
- catálogo global de utilizadores em membros;
- sincronização ADN e registo de certificado.

O próximo ciclo deve reduzir risco operacional, melhorar escalabilidade e aumentar previsibilidade de entrega em produção.

---

## 2) Objetivo deste briefing

Definir um plano executável para implementar melhorias de maior impacto em:

1. qualidade e confiabilidade (testes e CI);
2. performance e custo operacional (polling, carga API, escala de listagens);
3. segurança e observabilidade (cofre de certificados, métricas e alertas).

---

## 3) Escopo (in)

1. Fecho do gate de qualidade do incremento de organizações (integração + E2E).
2. Escalabilidade do ecrã de membros (filtro/paginação server-side).
3. Otimização do ciclo ADN (polling adaptativo e menor volume de chamadas).
4. Fortalecimento de segurança no armazenamento de certificado.
5. Observabilidade orientada a negócio e operação.

## 4) Fora de escopo (neste ciclo)

1. Redesenho completo da UI administrativa.
2. Migração total de arquitetura para event sourcing.
3. Revisão geral de permissões fora dos fluxos já citados.

---

## 5) Plano por fases (30 dias)

## Fase 1 — Confiabilidade de release (Semana 1)

### Entregas

1. Remover dependência de execução local com `skip` nos testes críticos de integração.
2. Garantir job de CI com banco real para suíte de integração de organizações.
3. Adicionar/estabilizar smoke E2E superadmin:
   - criar organização;
   - usar "Acessar agora";
   - validar aviso FR50 quando `localAdminLinked === false`.

### Critérios de aceite

1. Pipeline executa integração sem `skip` nos cenários críticos.
2. E2E smoke passa em CI de forma consistente.
3. Gate de merge bloqueia quando integração/E2E falham.

---

## Fase 2 — Escala de membros e UX responsiva (Semana 2)

### Entregas

1. Introduzir busca server-side com debounce no módulo de membros.
2. Ajustar endpoint para suportar query textual e paginação eficiente.
3. Reduzir carga de memória no browser (não carregar catálogo completo por padrão).

### Critérios de aceite

1. Listagem mantém tempo de resposta estável em bases grandes.
2. Digitação no filtro não gera burst excessivo (debounce ativo).
3. Funcionalidade de "Adicionar à organização" permanece intacta.

---

## Fase 3 — ADN: eficiência e previsibilidade (Semana 3)

### Entregas

1. Substituir polling fixo por polling adaptativo (backoff progressivo).
2. Consolidar chamadas redundantes relacionadas a readiness/certificate/sync.
3. Definir estratégia opcional para atualização por evento (SSE) em etapa incremental.

### Critérios de aceite

1. Redução mensurável no número médio de requests por sessão ativa.
2. Sem regressão de feedback ao utilizador no estado do job.
3. Menor incidência de picos de carga nos endpoints ADN.

---

## Fase 4 — Segurança e observabilidade operacional (Semana 4)

### Entregas

1. Reforçar proteção do payload de certificado em cofre (cifra e gestão de segredo).
2. Revisar rate limit para cenário distribuído (multi-instância).
3. Implementar dashboard com métricas de negócio/operação:
   - jobs ADN (queued/running/succeeded/failed);
   - latência por endpoint crítico;
   - taxa de `429`;
   - sucesso/falha em upload de certificado.

### Critérios de aceite

1. Segredos não ficam expostos em formato reversível sem chave de proteção.
2. Limites de taxa funcionam de forma consistente entre instâncias.
3. Alertas mínimos configurados para falha de sync/certificado.

---

## 6) Backlog técnico priorizado (ordem sugerida)

1. CI com integração obrigatória + E2E smoke superadmin.
2. Busca server-side no módulo de membros (com debounce).
3. Backoff de polling no painel ADN.
4. Rate limit distribuído.
5. Hardening do cofre de certificados.
6. Dashboards e alertas operacionais.

---

## 7) Métricas de sucesso

1. Taxa de sucesso da pipeline (integração + E2E) acima de 95%.
2. Redução do volume de requests ADN por sessão em pelo menos 30%.
3. Tempo de resposta p95 da listagem de membros estável com base ampliada.
4. Queda na taxa de erro operacional (`429`/`5xx`) em endpoints críticos.
5. Tempo médio de deteção de incidente reduzido com alertas ativos.

---

## 8) Riscos e mitigação

1. **Risco:** instabilidade de teste por ambiente.
   **Mitigação:** ambiente CI padronizado com fixtures e seed deterministicos.

2. **Risco:** regressão em UX ao mover filtro para server-side.
   **Mitigação:** rollout incremental com comparação de comportamento e fallback.

3. **Risco:** aumento de complexidade na gestão de segredos.
   **Mitigação:** documentação operacional + runbook de rotação.

4. **Risco:** custo inicial de observabilidade.
   **Mitigação:** começar com dashboard mínimo e alertas de alta severidade.

---

## 9) Dependências

1. Disponibilidade de infraestrutura de CI com base de dados para integração.
2. Definição de ferramenta padrão para métricas/alertas (stack atual do projeto).
3. Alinhamento entre produto, engenharia e QA para critérios de gate.

---

## 10) Próximos passos imediatos

1. Validar este briefing com PO/QA/Arquitetura.
2. Quebrar cada fase em stories técnicas pequenas (2-3 dias cada).
3. Iniciar Fase 1 imediatamente para reduzir risco de release.

---

Documento de referência para execução do próximo ciclo de melhorias.
