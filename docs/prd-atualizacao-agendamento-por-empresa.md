# PRD — Incremento: dia da automação mensal por empresa

**Documento:** requisitos do incremento descrito em `docs/brief-atualizacao-agendamento-por-empresa.md`.  
**Normativa integrada:** `docs/prd.md` **v0.2** (2026-04-22) — este ficheiro serve de **sumário executivo e rastreio**; em caso de conflito, prevalece `docs/prd.md`.

---

## 1. Objetivos

- Permitir **dia do mês (1–28)** configurável **por empresa** para a execução recorrente `scheduled_monthly`.
- **Manter** o **job imediato** ao concluir o cadastro da empresa (sem ação manual obrigatória).
- **Default e legado:** dia **1** quando o utilizador não escolhe outro ou quando o registo não tem valor persistido.

## 2. Fora de âmbito (confirmado)

- Vários agendamentos por empresa no mesmo mês.
- Horário distinto por empresa (mantém-se **FR11** do PRD principal: 06:00 `America/São_Paulo`).
- Fuso horário por empresa.
- Dias **29–31** (evita meses sem dia D; decisão de produto fechada no PRD v0.2).

## 3. Requisitos funcionais (rastreio)

| ID   | Descrição resumida |
| ---- | ------------------- |
| FR9  | Inalterado: job imediato após cadastro. |
| FR10 | Agendamento mensal usa **dia D** da empresa (1–28; default 1). |
| FR11 | Inalterado: fuso e horário do tick mensal. |
| FR18 | UI + API: configurar D no cadastro/edição; validação e mensagens claras. |

## 4. Requisitos não funcionais relevantes

- **NFR8 / idempotência:** chave de job mensal por **empresa + período mensal** (sem duplicar execução do mesmo mês por mudança de configuração, conforme critérios da Story 4.3 em `docs/prd.md`).

## 5. UX

- Campo explícito no fluxo de **cadastro** e **edição** de empresa (selector ou input com validação 1–28).
- Microcopy: indicar que o horário segue o fuso **América/São Paulo** (alinhado a **FR11**).

## 6. Stories e critérios de aceite

Implementação e critérios completos:

- **Story 2.4** — Dia da automação mensal por empresa (`docs/prd.md`).
- **Story 4.3** — Agendamento mensal por dia da empresa e retentativas (`docs/prd.md`).

## 7. Dependências técnicas (para @architect)

- Coluna ou campo persistido em `companies` (nome sugerido a definir na arquitetura, ex.: `monthly_run_day`).
- Migração: default **1** para linhas existentes.
- Ajuste do **cron/tick** que hoje assume dia 1 fixo: passar a ler **D** por empresa ao calcular `scheduled_for`.
- Revisão da **`idempotency_key`** de jobs `scheduled_monthly` (ver `docs/architecture.md`).

## 8. Métricas de sucesso

- Menos pedidos de suporte do tipo “preciso outro dia que não o 1”.
- Taxa de jobs mensais bem-sucedidos **sem regressão** face ao baseline pós-MVP.

---

*Morgan (PM) — AIOS; alinhado ao brief de atualização e à integração em `docs/prd.md` v0.2.*
