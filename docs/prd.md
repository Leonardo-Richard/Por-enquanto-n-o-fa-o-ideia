# Portal de Automação de Notas Fiscais (por empresa) — Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Permitir que usuários cadastrem múltiplas empresas (CNPJ) com um **código do sistema** de origem das notas fiscais, com dados vinculados à conta autenticada.
- Automatizar a coleta de NF e a **organização local** em pastas **por empresa**, com convenção estável: **CNPJ (somente dígitos)** e subpasta pelo **código do sistema**.
- Disparar coleta **ao concluir o cadastro** da empresa e **mensalmente no dia do mês configurado por empresa** (padrão **dia 1**, intervalo **1–28**), com política clara quando o cliente local estiver indisponível.
- Entregar um **componente local** (agente desktop prioritário para Windows) que efetue escrita em disco por um **canal seguro** com o backend.
- Estabelecer base de **segurança e privacidade** (LGPD): mínimo de dados, credenciais protegidas, auditoria de acesso e criptografia em trânsito e em repouso onde aplicável.
- Fornecir **visibilidade mínima** de execução (última execução, sucesso/falha, mensagem de erro legível) já no MVP, como fundação para alertas pós-MVP.

### Background Context

Contadores, equipes financeiras e pequenas empresas que consolidam documentos fiscais de **vários CNPJs** e **várias origens** hoje perdem tempo em portais distintos, com nomenclatura inconsistente e risco de misturar empresas. O produto resolve isso com **cadastro simples**, **pastas previsíveis** no computador do usuário e **gatilhos automáticos** na entrada e mensalmente.

O brief registra corretamente que um site “puro” não grava pastas locais: o MVP **deve** incluir um **cliente local**. Este PRD fixa decisões de produto que estavam abertas no brief: formato de pastas, normalização de CNPJ, fuso para o job mensal, comportamento offline e premissas de conector por “sistema” de NF (detalhe técnico de cada fonte permanece para arquitetura e integrações).

### Change Log

| Date       | Version | Description                                              | Author   |
| ---------- | ------- | -------------------------------------------------------- | -------- |
| 2026-04-22 | 0.2     | Agendamento mensal **por empresa** (dia 1–28, default 1); novas stories 2.4 e 4.3 atualizada; FR10/FR18; apêndice. Ver `docs/brief-atualizacao-agendamento-por-empresa.md`. | PM (AIOS) |
| 2026-04-20 | 0.1     | Versão inicial do PRD a partir de `docs/brief.md`        | PM (AIOS) |

---

## Requirements

### Functional

1. **FR1 — Autenticação de conta:** O sistema deve permitir registro, login, logout e recuperação de acesso (fluxo mínimo a definir na implementação, sem bloquear MVP).
2. **FR2 — Vínculo de dados à conta:** Cadastros de empresas e configurações de automação devem estar associados ao usuário autenticado e isolados de outras contas.
3. **FR3 — Cadastro de empresa:** O usuário deve informar CNPJ com validação de formato/dígitos verificadores (regras brasileiras), nome fantasia opcional e **código do sistema** (string configurável pelo usuário, não vazia após trim).
4. **FR4 — Unicidade lógica:** Não deve ser possível duplicar o mesmo par **CNPJ normalizado + código do sistema** na mesma conta (mensagem de erro clara).
5. **FR5 — Normalização de CNPJ:** Armazenar e exibir CNPJ de forma consistente; usar **apenas 14 dígitos** para nomes de pasta e chaves internas.
6. **FR6 — Estrutura de pastas local:** O agente deve gravar arquivos em: `{pasta_raiz_configurável}/{14 dígitos CNPJ}/{codigo-sistema}/`, onde `codigo-sistema` é sanitizado para caracteres seguros no filesystem (detalhe de sanitização na especificação técnica).
7. **FR7 — Configuração da pasta raiz:** O usuário deve definir no **cliente local** o caminho da pasta raiz onde as subpastas por CNPJ serão criadas; o backend não precisa validar o path, apenas receber metadados necessários ao pairing.
8. **FR8 — Pairing do agente:** O usuário deve conseguir associar o agente local à sua conta de forma segura (ex.: código de emparelhamento de curta duração ou fluxo equivalente).
9. **FR9 — Gatilho pós-cadastro:** Ao concluir com sucesso o cadastro de uma nova empresa, o sistema deve enfileirar uma **execução imediata** de coleta para aquela empresa (assíncrona em relação à UI).
10. **FR10 — Gatilho mensal por empresa:** Deve existir agendamento **recorrente mensal por empresa ativa**, executando a coleta no **dia do mês** definido para aquela empresa (intervalo **1–28**; padrão **1** na criação e para dados legados sem valor), no fuso e horário de **FR11**.
11. **FR11 — Fuso e horário do job mensal:** O agendamento mensal usa **timezone América/São_Paulo**; horário padrão **06:00** (ajustável em versão futura). Deve ficar explícito na UI que o horário é neste fuso.
12. **FR12 — Execução com cliente offline:** Se não houver agente disponível no horário agendado, o job permanece **pendente** e deve ser **retentado automaticamente** com backoff até limite configurável (ver NFRs); a UI deve mostrar “pendente / aguardando cliente”.
13. **FR13 — Entrega ao agente:** O backend deve enviar ao agente instruções suficientes para executar o download e gravar no path acordado (contrato de comando documentado na arquitetura).
14. **FR14 — Conector por sistema (MVP):** O MVP deve suportar ao menos **um** tipo de conector definido pelo projeto (ex.: “manual” ou integração inicial específica). O campo **código do sistema** identifica a “origem lógica” para roteamento do conector; novas integrações são extensões, não mudança do modelo mental do usuário.
15. **FR15 — Status de execução:** Para cada execução, o usuário deve ver na web: estado (sucesso, falha, pendente), timestamp da última tentativa e mensagem de erro resumida quando houver falha.
16. **FR16 — Listagem de empresas:** Tela com lista de empresas da conta, com acesso a detalhes e histórico resumido de execuções.
17. **FR17 — Edição e desativação:** Permitir editar nome fantasia e código do sistema onde não houver conflito; permitir desativar empresa para interromper agendamentos futuros sem apagar histórico (comportamento exato de “arquivar” vs “excluir” — MVP: **desativar** obrigatório, exclusão física opcional/fase 2).
18. **FR18 — Dia da automação mensal (configuração):** No cadastro e na edição da empresa, o utilizador deve definir o **dia de execução mensal** (1–28). A UI deve explicar que o horário segue **FR11** (fuso América/São Paulo). Valores inválidos são bloqueados com mensagem clara na UI e na API.

### Non Functional

1. **NFR1 — Segurança em trânsito:** Toda comunicação web e entre agente e backend deve usar TLS; canal agente–servidor deve ser autenticado e resistente a replay (mTLS ou tokens de sessão com renovação — decisão de arquitetura).
2. **NFR2 — Proteção de credenciais:** Credenciais de portais ou segredos não podem aparecer em logs em claro; armazenamento em cofre ou equivalente.
3. **NFR3 — LGPD:** Minimizar dados pessoais; documentar base legal e retenção; permitir exportação/exclusão conforme escopo do produto (MVP: pelo menos política de privacidade e fluxo de suporte para solicitações).
4. **NFR4 — Auditoria:** Registrar acessos administrativos e ações sensíveis (criação/remoção de empresa, pairing de agente) de forma imutável ou append-only quando possível.
5. **NFR5 — Disponibilidade do backend:** Meta orientadora para MVP: **99,5%** mensal (não é SLO contratual salvo decisão de negócio).
6. **NFR6 — Performance da UI:** Telas principais devem permanecer responsivas; trabalho pesado ocorre em jobs e no agente (NFR orientador).
7. **NFR7 — Limites de escala (MVP):** Suportar ordem de grandeza de **dezenas** de empresas por conta e **frequência mensal** sem degradação inaceitável (ajustar após métricas reais).
8. **NFR8 — Observabilidade:** Backend com logs estruturados e correlação por `job_id` / `empresa_id` / `conta_id`.
9. **NFR9 — Retentativas:** Política padrão: retentativas exponenciais para falhas transitórias, com teto máximo de **7 dias** após o dia agendado para o job mensal (revisável).
10. **NFR10 — Cliente local Windows:** Instalador ou pacote de distribuição para Windows na prioridade do MVP; arquitetura do agente preparada para evolução macOS/Linux.

---

## User Interface Design Goals

### Overall UX Vision

Interface web **objetiva e orientada a tarefas**: cadastrar empresa, ver status da última coleta e entender rapidamente se algo precisa de intervenção. O agente local deve ter **fluxo mínimo** (pasta raiz, conexão com conta, indicador de atividade). Linguagem voltada a operadores fiscais/financeiros, com termos consistentes (CNPJ, código do sistema, última execução).

### Key Interaction Paradigms

- **Onboarding em duas frentes:** (1) conta no site; (2) instalação e pairing do agente — com instruções passo a passo e estado visível (“aguardando agente”, “conectado”).
- **Feedback assíncrono:** salvar empresa → confirmação imediata + card de “coleta em andamento” sem bloquear navegação.
- **Prevenção de erro:** validação de CNPJ inline; bloqueio de duplicidade com mensagem clara.

### Core Screens and Views

1. Login / registro / recuperação de senha  
2. Dashboard (lista de empresas + status da última execução)  
3. Cadastro / edição de empresa  
4. Detalhe da empresa (histórico resumido de execuções, erros)  
5. Área de downloads / agente (instruções, pairing, estado da conexão)  
6. Configurações da conta (nome, e-mail, sessões — escopo mínimo)

### Accessibility: WCAG AA

Meta **WCAG 2.2 nível AA** para o produto web (componentes, contraste, foco, labels). Agente desktop: boas práticas de acessibilidade do SO (navegação por teclado onde aplicável).

### Branding

Sem identidade visual fechada neste PRD; usar sistema de design neutro e profissional (ex.: componentes acessíveis + tipografia legível). Evitar estética “jogável”; priorizar densidade informacional moderada.

### Target Device and Platforms

- **Web responsivo** para gestão (desktop prioritário, tablet aceitável).  
- **Agente desktop** Windows no MVP.  
- **Sem app mobile nativo** no escopo MVP.

---

## Technical Assumptions

### Repository Structure: Monorepo

**Monorepo** para aplicação web, API/worker, pacotes compartilhados (tipos, contratos) e repositório separado ou pacote do **agente desktop** conforme estratégia de release — decisão final na arquitetura, com preferência por monorepo se o time for pequeno e o release unificado.

### Service Architecture

- **API** para autenticação e CRUD de empresas.  
- **Workers / fila** para jobs de coleta e agendamento mensal **por dia configurado na empresa** (1–28).  
- **Serviço de agendamento** confiável (cron gerenciado + fila; idempotência por empresa + período).  
- **Canal persistente e seguro** entre agente e backend (WebSocket seguro, streaming ou polling de longo prazo — decisão do arquiteto).  
- **Armazenamento:** base relacional para entidades e estado de jobs; object storage apenas se necessário para artefatos (fase posterior).

### Testing Requirements

- **Pirâmide:** unitários em domínio e validações; integração em API e fila; e2e smoke para fluxo crítico (login → cadastro empresa → job enfileirado).  
- Testes do **agente:** pelo menos testes de integração do filesystem em ambiente controlado (paths temporários).

### Additional Technical Assumptions and Requests

- Preferência alinhada ao preset AIOS **nextjs-react** para o **frontend web** (Next.js, React, TypeScript, Tailwind), salvo decisão explícita em contrário na arquitetura.  
- Backend e workers: linguagem com bom suporte a filas e tipagem (ex.: Node/TypeScript ou equivalente).  
- Infraestrutura em nuvem com **secrets manager**, logs centralizados e variáveis por ambiente.  
- Versionamento de **contrato** entre backend e agente (versionamento semântico da API de comandos).  
- Jobs **idempotentes** onde possível para evitar duplicidade de arquivos (estrategia de “overwrite” ou “skip se já existe” por política — fechar na arquitetura).

---

## Epic List

1. **Epic 1 — Fundação do produto e autenticação:** Estabelecer repositório, pipelines, app web mínimo, autenticação de conta e página de saúde/visibilidade de deploy.  
2. **Epic 2 — Gestão de empresas na web:** CRUD de empresas com validação de CNPJ, unicidade por conta, normalização, **dia mensal da automação (1–28)** e UX de listagem/detalhe.  
3. **Epic 3 — Agente desktop e pipeline local:** Instalação/pairing, seleção de pasta raiz, criação da árvore `CNPJ/código-sistema`, recebimento de comandos e gravação segura.  
4. **Epic 4 — Orquestração de coletas:** Fila de jobs, gatilho pós-cadastro, agendamento mensal **por dia configurado na empresa** (America/São_Paulo), retentativas, status e erros expostos na UI.

---

## Epic 1 — Fundação do produto e autenticação

**Objetivo ampliado:** Entregar a base técnica e o primeiro incremento utilizável: usuário consegue criar conta, autenticar-se e ver uma página autenticada mínima, com CI/CD e observabilidade básica de aplicação.

### Story 1.1 — Bootstrap do repositório e pipeline

**User story:** Como mantenedor do produto, quero repositório versionado com pipeline de CI, para garantir qualidade contínua e deploy reprodutível.

**Acceptance Criteria:**

1. Repositório inicializado com estrutura definida (monorepo ou acordado) e documentação de como rodar localmente.  
2. Pipeline de CI executa lint, testes e build em PR.  
3. Branch principal protegida com checagem obrigatória do CI.

### Story 1.2 — Autenticação e sessão

**User story:** Como usuário, quero criar conta e entrar no sistema, para que meus dados fiquem isolados.

**Acceptance Criteria:**

1. Fluxos de registro, login e logout funcionando com persistência de sessão segura.  
2. Senhas armazenadas com algoritmo forte e política mínima de complexidade.  
3. Testes automatizados cobrem fluxo feliz e credenciais inválidas.

### Story 1.3 — Shell da aplicação web

**User story:** Como usuário autenticado, quero uma área logada básica, para validar que o deploy e a sessão funcionam ponta a ponta.

**Acceptance Criteria:**

1. Layout mínimo com navegação para “Empresas” (placeholder) e “Sair”.  
2. Rotas protegidas retornam 401/redirect adequado quando não autenticado.  
3. Página de health check pública para monitoramento.

---

## Epic 2 — Gestão de empresas na web

**Objetivo ampliado:** Permitir cadastro e manutenção de empresas com regras de negócio corretas (CNPJ, unicidade, código do sistema), preparando terreno para disparo de jobs no epic seguinte.

### Story 2.1 — Modelo e API de empresas

**User story:** Como sistema, preciso persistir empresas por conta com invariantes claras, para evitar dados inconsistentes.

**Acceptance Criteria:**

1. Entidade Empresa com CNPJ normalizado (14 dígitos), código do sistema, nome fantasia opcional, flags ativo/inativo.  
2. Constraint de unicidade `(account_id, cnpj_digits, system_code)` no banco.  
3. Testes de API para criação, conflito e listagem paginada.

### Story 2.2 — UI de cadastro e listagem

**User story:** Como usuário, quero cadastrar e listar empresas, para configurar minhas fontes de NF.

**Acceptance Criteria:**

1. Formulário com validação de CNPJ e feedback de duplicidade.  
2. Lista com colunas: CNPJ (mascarado na UI), nome fantasia, código do sistema, status, última execução (placeholder se ainda não existir integração).  
3. Acessibilidade: labels, mensagens de erro anunciadas, foco gerenciado em erros.

### Story 2.3 — Detalhe e desativação

**User story:** Como usuário, quero ver detalhes e desativar uma empresa, para parar coletas sem perder histórico.

**Acceptance Criteria:**

1. Página de detalhe com dados cadastrais e área reservada para histórico de execuções.  
2. Ação de desativar impede novos agendamentos e mostra estado “inativa” na lista.  
3. Tentativa de criar duplicata continua bloqueada após reativação futura (se implementada) sem violar unicidade.

### Story 2.4 — Dia da automação mensal por empresa

**User story:** Como utilizador, quero escolher o **dia do mês (1–28)** em que a coleta recorrente corre **para cada empresa**, para alinhar ao calendário de cada cliente, mantendo o **padrão dia 1** quando não altero nada.

**Acceptance Criteria:**

1. No **cadastro** e na **edição** da empresa, campo visível para o dia (selector ou input validado) com intervalo **1–28** e default **1**.  
2. Texto de ajuda referencia que o horário é o de **FR11** (ex.: 06:00 em `America/São_Paulo`).  
3. API persiste o valor com a empresa; rejeição **400** com mensagem clara para fora do intervalo ou tipo inválido.  
4. Empresas já existentes sem o campo persistido comportam-se como dia **1** até o utilizador gravar uma edição.

---

## Epic 3 — Agente desktop e pipeline local

**Objetivo ampliado:** Cumprir o requisito “arquivos no computador do usuário” com um cliente Windows que converse com o backend, crie a estrutura de pastas e grave arquivos de forma segura e previsível.

### Story 3.1 — Instalador e configuração da pasta raiz

**User story:** Como usuário Windows, quero instalar o agente e escolher a pasta raiz, para controlar onde os arquivos serão salvos.

**Acceptance Criteria:**

1. Pacote instalável ou distribuível com instruções claras.  
2. Seleção de diretório com validação de permissão de escrita.  
3. Persistência local cifrada ou protegida para credenciais de pairing (se aplicável).

### Story 3.2 — Pairing seguro com a conta

**User story:** Como usuário, quero associar o agente à minha conta com um fluxo seguro e de curta duração.

**Acceptance Criteria:**

1. Fluxo de código de emparelhamento ou OAuth device flow — documentado e implementado.  
2. Revogação de agente na web invalida sessão do cliente.  
3. Testes cobrem expiração do código e tentativa de reuso.

### Story 3.3 — Execução de comandos e gravação em `CNPJ/código-sistema`

**User story:** Como sistema, quero que o agente receba comandos e grave arquivos no caminho acordado, para cumprir a convenção de pastas.

**Acceptance Criteria:**

1. Criação idempotente da árvore `{raiz}/{14 dígitos}/{sanitized_codigo}/`.  
2. Tratamento de erros de disco (sem espaço, permissão) com relatório ao backend.  
3. Prova automatizada ou manual documentada de ponta a ponta com pasta temporária.

---

## Epic 4 — Orquestração de coletas

**Objetivo ampliado:** Enfileirar trabalhos na criação da empresa, agendar mensalmente **no dia configurado por empresa (1–28, default 1)** no fuso definido, retentar quando o agente estiver offline e expor status na web.

### Story 4.1 — Fila de jobs e estados

**User story:** Como operador, quero que cada coleta seja um job rastreável com estados claros.

**Acceptance Criteria:**

1. Estados: `pendente`, `em_execução`, `sucesso`, `falha`, `cancelado` (onde aplicável).  
2. Correlação com `empresa_id`, timestamps e mensagem de erro.  
3. API/UI para listar últimas execuções por empresa.

### Story 4.2 — Gatilho pós-cadastro

**User story:** Como usuário, ao cadastrar uma empresa, quero que a primeira coleta seja agendada automaticamente.

**Acceptance Criteria:**

1. Evento de criação gera job imediato na fila.  
2. Falhas no enfileiramento são visíveis ao usuário.  
3. Idempotência: recriação acidental não deve duplicar jobs indevidos (chave de idempotência).

### Story 4.3 — Agendamento mensal por dia da empresa e retentativas

**User story:** Como utilizador, quero que, em cada mês, o sistema tente coletar **no dia que configurei para aquela empresa** (por omissão dia **1**), sem me lembrar manualmente.

**Acceptance Criteria:**

1. O scheduler calcula `scheduled_for` em **America/São_Paulo** às **06:00** no **dia D** guardado na empresa (**D ∈ [1,28]**; omissão ou legado = **1**).  
2. **Idempotência:** não é criado um segundo job `scheduled_monthly` para o mesmo **empresa + mês civil de referência** (chave de idempotência alinhada ao modelo em `docs/architecture.md`).  
3. **Alteração do dia durante o mês:** se o job mensal do mês corrente **ainda não tiver sido materializado** na fila (pendente de tick), a primeira enfileiração deve usar o **D atual**; se já existir job mensal enfileirado ou terminal para esse mês, a alteração de D **só afeta meses seguintes** (sem segunda execução no mesmo mês por mudança de configuração).  
4. Se o agente estiver offline à hora agendada, o job fica pendente e retenta conforme **NFR9**.  
5. Após limite de retentativas, estado `falha` com mensagem a orientar verificar agente/rede.

### Story 4.4 — Integração mínima de conector

**User story:** Como produto, precisamos de pelo menos um caminho de coleta ponta a ponta, mesmo que simplificado.

**Acceptance Criteria:**

1. Implementação de um conector “MVP” (conforme decisão técnica: stub controlado, ambiente de homologação ou integração real inicial).  
2. O mesmo fluxo usa o campo **código do sistema** para roteamento.  
3. Documentação dos limites conhecidos e roadmap de novos conectores.

---

## Checklist Results Report

**Status:** relatório formal do `pm-checklist` **não executado** nesta entrega automatizada. Recomenda-se rodar o checklist PM no repositório AIOS após revisão humana do PRD e registrar resultados nesta seção.

**Verificação rápida interna (não substitui checklist):**

- Requisitos funcionais e não funcionais estão numerados e rastreáveis.  
- Escopo MVP e pós-MVP do brief está refletido; decisões abertas foram fechadas explicitamente.  
- Epics são sequenciais e incrementais.

---

## Next Steps

### UX Expert Prompt

Com base neste PRD, produzir wireframes de baixa fidelidade para: dashboard de empresas, fluxo de cadastro com validação de CNPJ, tela de pairing do agente e painel de status de execuções. Priorizar clareza para usuário financeiro/contábil e estados assíncronos (coleta em andamento, agente offline).

### Architect Prompt

A partir deste PRD, desenhar arquitetura alvo: monorepo, serviços API + worker, fila e agendamento do job mensal com **dia D por empresa (1–28)** e timezone, contrato versionado com o agente Windows, modelo de credenciais e ameaças (STRIDE resumido), escolha de DB e estratégia de idempotência de jobs (incl. chave por empresa + período mensal). Incluir sequência de implementação alinhada aos épicos 1–4 e critérios de prontidão para produção (observabilidade, backups, política de segredos).

---

## Appendix — Decisões de produto (ex-brief)

| Tema                         | Decisão no PRD                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Formato de pastas            | `{raiz}/{14 dígitos}/{codigo-sistema sanitizado}/`                            |
| Job mensal                   | **Dia D por empresa** (**D** ∈ 1–28, default **1**), **06:00**, `America/Sao_Paulo`; retentativas se agente offline |
| CNPJ em pastas               | Somente dígitos (14), sem máscara                                               |
| Cliente local                | Agente desktop Windows prioritário; pairing obrigatório                       |
| Conector “sistema de origem” | MVP exige pelo menos um conector; expansão por novos conectores               |

---

— Documento alinhado ao template `prd-template-v2` (AIOS). Última atualização: 2026-04-22.
