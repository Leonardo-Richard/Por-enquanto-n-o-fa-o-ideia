# UI/UX — Implementação das melhorias prioritárias (confiabilidade, escala e operação)

**Produto:** Portal de Automação de Notas Fiscais (multi-organização).  
**Fonte de produto:** `docs/prd-implementacao-melhorias-sistema.md` (**FR121–FR131**, **NFR42–NFR49**).  
**Specs base relacionadas:** `docs/front-end-spec-superadmin-cadastro-organizacoes-acesso-global.md`, `docs/front-end-spec-membros-catalogo-utilizadores-filtro-dinamico.md`, `docs/front-end-spec-upload-certificado-browser-edicao-empresa-monitorada.md`, `docs/front-end-spec-integracao-nfse-dist-adn.md`.

Este documento define o **delta de front-end e UX** para o ciclo de melhorias.  
Não substitui specs anteriores; complementa e harmoniza comportamentos entre módulos.

---

## 1. Objetivo e âmbito

### 1.1 Objetivo

Definir interações, estados, copy, componentes e critérios de experiência para:

1. escalar a experiência de filtro de membros com busca server-side;
2. reduzir ruído visual e carga no fluxo ADN com polling adaptativo;
3. melhorar feedback operacional de certificado;
4. apresentar dashboard operacional mínimo para ADN/certificado;
5. suportar validação de release sem fricção adicional no uso diário.

### 1.2 Fora de âmbito (UX/UI deste ciclo)

1. redesign completo do dashboard administrativo;
2. nova arquitetura de navegação;
3. reescrita dos modais de membros e certificado além dos ajustes descritos;
4. interface completa de gestão de alertas (apenas visualização de estado e indicadores).

---

## 2. Princípios de UX do ciclo

1. **Clareza operacional:** estados de sistema e próximos passos sempre explícitos.
2. **Velocidade percebida:** respostas imediatas ao input de filtro e menos oscillação de loading.
3. **Consistência de feedback:** sucesso, aviso e erro com padrão único entre módulos.
4. **Progressive disclosure:** mostrar diagnóstico avançado só quando necessário.
5. **Acessibilidade AA:** navegação por teclado, foco visível e mensagens legíveis por leitor de tela.

---

## 3. Superfícies impactadas

| Área | Superfície | Tipo de alteração |
| ---- | ---------- | ----------------- |
| Membros | `/admin/organizacoes/[organizationId]/membros` | Filtro server-side com debounce e estados de consulta |
| Empresa monitorada (ADN) | Painel de sincronização ADN na ficha da empresa | Polling adaptativo + mensagens de status refinadas |
| Empresa monitorada (certificado) | Seção de certificado | Feedback de falhas mais acionável e alinhado a segurança |
| Operações | Novo dashboard operacional (admin interno/suporte) | KPIs, saúde de fila, latência, taxa de `429`, alertas |

---

## 4. Fluxos de utilizador

### 4.1 Fluxo A — Membros com busca escalável (**FR124**, **FR125**, **NFR43**)

1. Superadmin abre `Membros`.
2. Primeira página carrega rapidamente com indicadores de contagem.
3. Utilizador digita no filtro.
4. UI aguarda debounce (300 ms recomendado) e dispara busca no servidor.
5. Tabela atualiza sem bloquear a página inteira.
6. Utilizador executa ação de linha (`Editar`, `Remover vínculo`, `Adicionar à organização`) sem regressão.

### 4.2 Fluxo B — ADN com polling adaptativo (**FR126**, **FR127**, **NFR44**)

1. Utilizador solicita sincronização ADN.
2. UI confirma enfileiramento (`202`) com feedback claro.
3. Estado do job é acompanhado por polling adaptativo:
   - rápido no início;
   - mais espaçado em execução longa;
   - pausa ao atingir estado terminal.
4. Mensagens de status evitam repetição e exibem último update relevante.

### 4.3 Fluxo C — Certificado com feedback operacional (**FR128**, **FR129**, **NFR45**, **NFR46**)

1. Utilizador faz upload/revogação.
2. Em sucesso, UI confirma estado atualizado.
3. Em falha (`429`, erro de validação, indisponibilidade de armazenamento), UI mostra:
   - motivo amigável;
   - orientação de próxima ação (aguardar, tentar novamente, contatar suporte).

### 4.4 Fluxo D — Dashboard operacional (**FR130**, **FR131**, **NFR47**, **NFR48**)

1. Perfil autorizado abre painel operacional.
2. Vê cartões de saúde (fila, sucesso/falha, latência, `429`).
3. Identifica alertas ativos por severidade.
4. Navega para detalhes de organização/empresa para diagnóstico rápido.

---

## 5. Requisitos de interface por módulo

## 5.1 Membros — Filtro server-side

### Estrutura visual

- manter toolbar e ações já existentes;
- campo de filtro mantém label atual, com hint de busca dinâmica;
- adicionar estado de consulta discreto (ex.: `A procurar...`) sem spinner fullscreen;
- paginação baseada no resultado retornado do servidor.

### Estados

| Estado | Tratamento UX |
| ------ | -------------- |
| Initial loading | Skeleton da tabela |
| Refetch por filtro | Indicador discreto no topo da tabela (`aria-live="polite"`) |
| Vazio sem filtro | Mensagem: sem utilizadores para os critérios atuais |
| Vazio com filtro | Mensagem: nenhum resultado para o termo |
| Erro | Alert com CTA `Tentar novamente` |

### Microinterações

- debounce visualmente transparente (sem congelar digitação);
- reset para página 1 quando termo muda;
- manter foco no input após atualização.

---

## 5.2 ADN — Polling adaptativo e feedback de job

### Comportamento de atualização

- intervalo sugerido:
  - `running` inicial: 3-5s;
  - execução prolongada: 8-15s com backoff;
  - estado terminal: parar polling;
- botão manual `Atualizar agora` permanece disponível.

### Apresentação de status

- linha de estado única com:
  - status atual (`Em fila`, `Em execução`, `Concluído`, `Falhou`);
  - timestamp da última atualização;
  - resumo curto da fase.
- evitar múltiplos toasts repetidos para o mesmo evento.

### Tratamento de limitação

- para `429`, mostrar mensagem com tempo aproximado de tentativa (quando `Retry-After` disponível);
- desabilitar CTA temporariamente quando necessário.

---

## 5.3 Certificado — Feedback e confiança

### Ajustes de experiência

- mensagens de erro orientadas à ação:
  - arquivo inválido;
  - senha incorreta;
  - limite excedido;
  - indisponibilidade temporária;
- destacar que o processamento é seguro sem expor detalhes técnicos sensíveis.

### Estados recomendados

| Estado | UI |
| ------ | --- |
| Sem certificado | CTA de upload + texto orientativo |
| Ativo | Badge `Ativo` + validade |
| Pendente/verificação | Badge de atenção + orientação de acompanhamento |
| Revogado | Badge `Revogado` + opção de novo upload |

---

## 5.4 Dashboard operacional (novo)

### Informação mínima na visão geral

1. Jobs ADN (queued/running/succeeded/failed) no período selecionado.
2. Latência p95 dos endpoints críticos.
3. Taxa de `429` (sync/upload).
4. Taxa de sucesso/falha de upload de certificado.
5. Lista de alertas ativos por severidade.

### Estrutura de layout sugerida

- faixa superior: filtros globais (período, organização, empresa);
- linha 1: cartões de KPI;
- linha 2: gráficos de tendência (jobs e latência);
- linha 3: tabela de alertas/eventos recentes com drill-down.

### Ações principais

- `Ver detalhe da organização`;
- `Ver detalhe da empresa`;
- `Copiar contexto para suporte` (ID de correlação e janela temporal).

---

## 6. Acessibilidade (WCAG AA)

- [ ] Todos os campos com `label` explícito.
- [ ] Mudanças de estado relevantes anunciadas via `aria-live`.
- [ ] Foco preservado após refetch de tabela.
- [ ] Contraste AA em badges de status e alertas.
- [ ] Ações críticas acessíveis por teclado.
- [ ] Erros vinculados a campos (`aria-describedby`) quando aplicável.

---

## 7. Componentes (Atomic Design)

| Nível | Componentes novos/ajustados | Observação |
| ----- | --------------------------- | ---------- |
| Átomo | `StatusBadge`, `InlineSpinner`, `MetricCard` | Reuso transversal de estados |
| Molécula | `ServerSearchField`, `JobStatusLine`, `AlertRow` | Base para membros e operação |
| Organismo | `MembersDirectoryTable`, `AdnSyncPanel`, `OpsKpiBoard` | Evolução de componentes existentes |
| Template | `OperationsDashboardTemplate` | Novo template para painel operacional |
| Página | `OperationsDashboardPage` | Restrita a perfil autorizado |

---

## 8. Copy base (PT-BR)

| ID | Texto |
| -- | ----- |
| ux.members.search.placeholder | Buscar por nome ou e-mail |
| ux.members.search.loading | A procurar resultados... |
| ux.members.empty.filtered | Nenhum utilizador encontrado para este filtro. |
| ux.adn.sync.queued | Pedido enfileirado com sucesso. |
| ux.adn.sync.running | Sincronização em andamento. |
| ux.adn.sync.rateLimited | Muitos pedidos em sequência. Tente novamente em instantes. |
| ux.cert.error.storeUnavailable | Serviço de certificado indisponível no momento. Tente novamente. |
| ux.cert.error.rateLimited | Limite de tentativas atingido. Aguarde para novo envio. |
| ux.ops.kpi.failedJobs | Jobs com falha |
| ux.ops.alerts.active | Alertas ativos |

---

## 9. Telemetria de UX (front-end analytics)

Eventos recomendados:

1. `members_filter_changed` (termo, debounce_ms, results_count).
2. `members_filter_request_failed` (status_code).
3. `adn_sync_status_polled` (interval_ms, status).
4. `adn_sync_rate_limited_shown`.
5. `certificate_upload_failed_ui` (error_code).
6. `ops_dashboard_filter_changed`.

Objetivo: medir perceção de velocidade, fricção e confiabilidade por fluxo.

---

## 10. Rastreio PRD -> UX/UI

| Requisito | Cobertura |
| --------- | --------- |
| FR124 | §4.1, §5.1 |
| FR125 | §4.1, §5.1, §9 |
| FR126 | §4.2, §5.2 |
| FR127 | §4.2, §5.2 |
| FR128 | §4.3, §5.3 |
| FR129 | §4.3, §5.3 |
| FR130 | §4.4, §5.4 |
| FR131 | §4.4, §5.4 |
| NFR43 | §5.1 |
| NFR44 | §5.2, §9 |
| NFR45 | §5.3 |
| NFR46 | §5.3 |
| NFR47 | §5.4, §9 |
| NFR48 | §5.4 |
| NFR49 | Documento inteiro (abordagem delta sem breaking UX) |

---

## 11. Critérios de aceite de UX

1. Filtro de membros responde com busca server-side e feedback de consulta sem degradar usabilidade.
2. Painel ADN apresenta menos ruído de atualização e estados compreensíveis.
3. Fluxo de certificado exibe erros acionáveis e consistentes.
4. Dashboard operacional exibe KPIs mínimos e alertas ativos com navegação para detalhe.
5. Checklist de acessibilidade da seção 6 é validado em QA.

---

## 12. Próximos passos (handoff)

1. `@dev` — implementar componentes/estados definidos nas seções 5 e 7.
2. `@qa` — preparar cenários E2E para filtro server-side, polling adaptativo e painel operacional.
3. `@architect` — validar contratos e limites técnicos para intervalos de polling, métricas e filtros do dashboard.
4. `@sm` — refletir este documento nas stories MSYS-03, MSYS-04 e MSYS-07.

---

## 13. Change log

| Data | Versão | Descrição | Autor |
| ---- | ------ | --------- | ----- |
| 2026-04-28 | 1.0 | Especificação front-end/UX do ciclo de melhorias FR121–FR131. | UX (Uma / AIOS) |

---

— Uma (UX) — AIOS; baseado em `docs/prd-implementacao-melhorias-sistema.md`.
