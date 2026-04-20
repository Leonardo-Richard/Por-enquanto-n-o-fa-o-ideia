# Project Brief: Portal de Automação de Notas Fiscais (por empresa)

## Executive Summary

Plataforma web em que o usuário cadastra empresas (CNPJ) e um **código do sistema** de origem das notas fiscais. Uma **automação** baixa as NF e as organiza no computador do usuário em pastas **por empresa**, usando **CNPJ** (como nome da pasta) e o **código do sistema** informado. A coleta deve disparar **no cadastro da empresa** e **no dia 1º de cada mês**, garantindo rotina mensal sem depender só de ação manual.

**Problema:** quem precisa consolidar notas de várias empresas e sistemas perde tempo baixando manualmente, erra pastas/nomenclatura e atrasa fechamentos.

**Público-alvo:** contadores, financeiros e pequenas empresas que centralizam documentos fiscais de múltiplos CNPJs.

**Proposta de valor:** cadastro simples, pastas previsíveis (`CNPJ` + código do sistema), e execução automática na entrada e mensalmente.

---

## Problem Statement

- **Estado atual:** notas ficam em portais diversos; o usuário baixa arquivo por arquivo, renomeia pastas de forma inconsistente e mistura empresas.
- **Impacto:** retrabalho, risco de perda de NF-e, atraso em obrigações e auditoria difícil.
- **Por que soluções genéricas falham:** armazenamento em nuvem “só na web” não resolve organização local; sincronização manual não escala com vários CNPJs e origens.
- **Urgência:** obrigações fiscais e rotinas de fechamento são recorrentes; padronizar pastas e automatizar download reduz erro humano de forma contínua.

---

## Proposed Solution

- **Conceito:** site para cadastro e gestão de empresas (CNPJ + código do sistema configurável pelo usuário) e **orquestração** da automação de download com destino no disco local, estruturado por empresa.
- **Diferenciação:** convenção explícita de pastas (CNPJ + código), gatilhos claros (cadastro + dia 1º), foco em quem opera várias empresas.
- **Visão:** evoluir para painel de status (última execução, erros, retentativas) e alertas, mantendo o núcleo de automação e organização.

> **Nota de produto:** “Baixar no computador do usuário” a partir de um site puro exige **componente local** (agente desktop, app leve ou extensão) ou integração com pasta sincronizada. O desenho técnico exato fica para PRD/arquitetura; aqui registramos a intenção e o risco associado.

---

## Target Users

### Primary User Segment: Operador fiscal / financeiro (multi-empresa)

- **Perfil:** usa mais de um CNPJ ou integra com mais de um “sistema” de emissão/consulta de NF.
- **Comportamento hoje:** acessa vários portais, exporta arquivos, cria pastas manualmente.
- **Necessidades:** nomenclatura estável, separação por empresa, lembrar de rodar a coleta (ou não precisar lembrar).
- **Objetivo:** pasta local organizada e atualizada para conferência, envio ao contador ou arquivo.

### Secondary User Segment: Microempresa / MEI com um CNPJ (opcional)

- **Perfil:** um único CNPJ, mas quer simplicidade e lembrete mensal automático.
- **Objetivo:** menos cliques e menos erro de arquivo “solto” na Área de Trabalho.

---

## Goals & Success Metrics

### Business Objectives

- Reduzir tempo médio de coleta mensal por empresa (baseline a definir após MVP).
- Aumentar taxa de execuções bem-sucedidas sem intervenção (meta a calibrar com pilotos).

### User Success Metrics

- Usuário encontra NF da empresa X na pasta esperada após cadastro e após o dia 1º.
- Taxa de erros de “empresa errada” ou arquivo fora do lugar próxima de zero (validação qualitativa inicial).

### Key Performance Indicators (KPIs)

- **Execuções concluídas / agendadas:** proporção de jobs mensais e pós-cadastro que terminam sem erro.
- **Tempo até primeira NF na pasta:** após cadastro, SLA alvo definido no PRD (ex.: &lt; X minutos em condições normais).

---

## MVP Scope

### Core Features (Must Have)

- **Cadastro de empresa:** CNPJ (validado), nome fantasia opcional, **código do sistema** informado pelo usuário.
- **Estrutura de pastas:** raiz configurável no cliente local + subpastas por **CNPJ** e segmentação por **código do sistema** (detalhe exato do path: `CNPJ/codigo-sistema/` ou `CNPJ_codigo/` — a fixar no PRD para evitar colisões).
- **Gatilhos de automação:** execução ao **concluir cadastro** da empresa; execução **agendada no dia 1º de cada mês** (por empresa ou em lote — a definir).
- **Autenticação e conta:** usuário logado; dados de empresas vinculados à conta (mínimo viável de segurança).
- **Componente local para escrita em disco:** mecanismo que efetivamente salva arquivos na máquina (sem isso, o requisito “no computador” não se cumpre).

### Out of Scope for MVP

- Integração fiscal completa com prefeituras/SEFAZ em todos os municípios e todos os layouts.
- OCR de PDFs não estruturados, conferência automática de impostos.
- App mobile nativo (a menos que o desenho escolhido exija).

### MVP Success Criteria

- Usuário cadastra pelo menos uma empresa, define o código, e vê arquivos aparecendo na pasta correta após o primeiro job.
- No dia 1º, o job roda sem ação manual do usuário (salvo dependências externas como máquina ligada / agente ativo — explicitar no PRD).

---

## Post-MVP Vision

### Phase 2 Features

- Histórico de execuções, logs exportáveis, retentativas inteligentes.
- Notificações (e-mail / push) de falha ou NF ausente.

### Long-term Vision

- Conector padronizado por “tipo de sistema” além do código livre; dashboard de conformidade por empresa.

### Expansion Opportunities

- API para ERP/contabilidade, retenção em nuvem criptografada opcional, multiusuário por empresa (permissões).

---

## Technical Considerations

### Platform Requirements

- **Target Platforms:** Web (cadastro e gestão) + **cliente local** para I/O em disco.
- **Browser/OS Support:** navegadores modernos para o site; Windows como prioridade típica para automação desktop no Brasil (macOS/Linux se houver demanda).
- **Performance Requirements:** jobs não devem travar a UI; downloads em background com limites de banda configuráveis (fase 2).

### Technology Preferences

- **Frontend:** a definir (ex.: stack web moderna).
- **Backend:** a definir; necessário **agendamento** confiável para dia 1º (cron + fila).
- **Database:** relacional ou document store para empresas, credenciais e estado dos jobs.
- **Hosting/Infrastructure:** cloud com filas e logs; segredos em cofre (vault/secret manager).

### Architecture Considerations

- **Repository Structure:** monorepo ou separação site/agente — decisão no PRD.
- **Service Architecture:** API + worker de jobs; agente local com canal seguro (WebSocket/mTLS) para comandos de download.
- **Integration Requirements:** conectores específicos por “sistema” de NF (detalhe depende de cada fonte legal/técnica).
- **Security/Compliance:** LGPD, mínimo de dados pessoais; criptografia em trânsito e em repouso para credenciais; auditoria de acesso.

---

## Constraints & Assumptions

### Constraints

- **Budget / Timeline / Resources:** não informados — manter MVP enxuto.
- **Technical:** automação depende de fontes acessíveis e estáveis; mudanças em portais quebram scripts.

### Key Assumptions

- O usuário pode instalar um pequeno agente ou app no PC.
- O “código do sistema” é suficiente para o MVP como identificador lógico da origem; integrações profundas vêm depois.
- Execução no dia 1º pode exigir que o computador esteja disponível ou um serviço em nuvem com destino sincronizado — decisão de arquitetura pendente.

---

## Risks & Open Questions

### Key Risks

- **R1 — Viabilidade técnica por fonte:** cada portal tem regras, captcha e termos de uso; risco legal e de manutenção.
- **R2 — Segurança:** credenciais e NF são dados sensíveis; vazamento tem alto impacto.
- **R3 — Confiabilidade do agendamento:** fuso horário, feriados e falha de rede no dia 1º.

### Open Questions

- O download é sempre via portal web (RPA) ou haverá API oficial/contrato com o sistema?
- Pastas: CNPJ com ou sem máscara? Normalizar só dígitos evita duplicatas.
- Job do dia 1º: horário exato, timezone (Brasil) e comportamento se o PC estiver desligado (fila até ligar vs. executar só em nuvem).

### Areas Needing Further Research

- Termos de uso dos sistemas-alvo e política de automação.
- Opções de agente local (instalador, assinatura de código, atualizações automáticas).

---

## Appendices

### C. References

- Template AIOS: `project-brief-tmpl.yaml` (v2.0)
- Entrada do usuário: descrição do produto (automação, pastas por CNPJ e código, gatilhos cadastro + dia 1º)

---

## Next Steps

### Immediate Actions

1. Validar com stakeholders o **modelo de deploy local** (agente vs. app vs. sincronização com nuvem).
2. Fechar **formato de pastas** e regras de unicidade (CNPJ + código).
3. Encaminhar para **@pm** elaborar PRD com requisitos funcionais e não funcionais, incluindo fluxos de erro e LGPD.
4. Encaminhar para **@architect** o desenho do job mensal (cron), filas e canal seguro com o cliente local.

### PM Handoff

Este Project Brief reúne o contexto inicial do produto. O PM pode gerar o PRD seção a seção, usando esta base e fechando as questões abertas (especialmente componente local, fontes de NF e política de agendamento).

---

— Documento gerado no fluxo *create-project-brief* (rascunho YOLO a partir do briefing do usuário).
