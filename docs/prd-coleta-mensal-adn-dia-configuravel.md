# PRD — Coleta mensal ADN no dia configurável (enfileiramento automático)

**Documento:** requisitos de produto derivados de [`briefing-coleta-mensal-adn-dia-configuravel.md`](briefing-coleta-mensal-adn-dia-configuravel.md).  
**Data:** 2026-04-30  
**Audiência:** produto, engenharia, operações.

**Relação com normativa existente:** este PRD **incrementa** o incremento descrito em [`prd-atualizacao-agendamento-por-empresa.md`](prd-atualizacao-agendamento-por-empresa.md) e o rastreio em [`prd.md`](prd.md) (dia D 1–28, idempotência, fuso). O utilizador **já** configura `monthlyRunDay`; este documento exige que o **sistema** enfileire jobs ADN nesse dia.

**Regra de precedência (materialização do job):** em caso de conflito entre a tabela genérica `jobs` referida em [`architecture.md`](architecture.md) e a fila real **`adn_sync_jobs`**, prevalece **este PRD** e a implementação em Postgres sobre **`adn_sync_jobs`**.

---

## 1. Problema e contexto

O dia civil da coleta recorrente (1–28) por empresa está **persistido** e **validado**; a lógica pura de calendário e chave mensal existe em [`packages/scheduling`](../packages/scheduling/src/monthly-enqueue.ts). Não existe, contudo, um **agendador** (tick diário) que insira linhas em [`adn_sync_jobs`](../packages/db/src/schema.ts) no dia D em `America/Sao_Paulo`. A fila cresce sobretudo com pedidos **manuais** ([`adn-sync.ts`](../frontend/src/server/api/v1/handlers/adn-sync.ts)). O worker ([`poll_jobs.py`](../workers/nfse-portal-bridge/poll_jobs.py)) consome `queued` quando a organização tem ADN activo.

---

## 2. Objectivos

- **O1:** No dia D (calendário civil em `America/Sao_Paulo`) igual a `monthlyRunDay` da empresa, o sistema **cria automaticamente** um job de sincronização ADN em estado `queued`, **sem** acção do utilizador no painel.
- **O2:** Garantir **no máximo uma** materialização desse tipo por **empresa** e **mês civil** (idempotência alinhada a NFR8 / Story 4.3 em `prd.md`).
- **O3:** Reutilizar o **worker e o conector** existentes (sem exigir alteração obrigatória do contrato HMAC de ingestão).

---

## 3. Fora de âmbito

- Alterar [`third_party/NFSE_dist/main.py`](../third_party/NFSE_dist/main.py) ou a lógica de download local (o bridge continua a orquestrar).
- **Horário distinto por empresa** (mantém-se tick global; ver [`brief-atualizacao-agendamento-por-empresa.md`](brief-atualizacao-agendamento-por-empresa.md) e **FR11** no PRD principal).
- Vários agendamentos distintos no mesmo mês para a mesma empresa.
- Reescrever na íntegra [`prd.md`](prd.md); pode-se **adicionar** rastreio de IDs `FR-ADN-MONTHLY-*` na matriz de requisitos noutra alteração.

---

## 4. Requisitos funcionais

| ID | Descrição |
|----|-----------|
| **FR-ADN-MONTHLY-01** | Um processo agendado (ex.: **Vercel Cron**) invoca **diariamente** (após a janela nominal de 06:00 em `America/Sao_Paulo`, p.ex. 06:05) um **endpoint HTTP interno** do projecto de deploy que contém a API. |
| **FR-ADN-MONTHLY-02** | O endpoint **só** aceita pedidos autenticados com **segredo partilhado** (ex.: `Authorization: Bearer` + variável de ambiente; nome exacto alinhado ao repositório). |
| **FR-ADN-MONTHLY-03** | Para cada empresa **activa** cuja organização tem **`adn_sync_enabled = true`**, se o **dia civil actual em SP** for igual a `monthlyRunDay`, o serviço avalia o enfileiramento via **`decideMonthlyScheduledEnqueue`** ([`monthly-enqueue.ts`](../packages/scheduling/src/monthly-enqueue.ts)), tendo em conta chaves já existentes para o período (runbook: duplo tick, mudança intra-mês — [`agendamento-mensal-por-empresa.md`](runbooks/agendamento-mensal-por-empresa.md)). |
| **FR-ADN-MONTHLY-04** | Quando a decisão for `enqueue`, **`INSERT`** em `adn_sync_jobs` com: `status = queued`; **`trigger = monthly`** (alinhado a [`ExecutionTrigger`](../packages/shared/src/portal-types.ts)); **`idempotency_key = sched_monthly:{companyId}:{YYYY-MM}`** (mês civil SP); `summary_json` coerente com fila (ex.: fase `queued`, `fetchMode` incremental ou valor por defeito igual ao fluxo manual). |
| **FR-ADN-MONTHLY-05** | Empresas cuja organização tem **`adn_sync_enabled = false`**: o tick **não** insere job mensal (evita fila que o worker nunca reclama). |
| **FR-ADN-MONTHLY-06** | Jobs criados pelo agendador têm **`requested_by_user_id` nulo** (actor sistema). |
| **FR-ADN-MONTHLY-07** | A listagem de execuções / origem no UI que mapeia `trigger` (ex.: [`execucoes/page.tsx`](../frontend/src/app/%28dashboard%29/execucoes/page.tsx) e equivalentes) **identifica** origem **mensal** de forma correcta: **não** hardcodar “dia 1º” se o produto suporta dia D — usar rótulo neutro (ex. “Agendada (mensal)”) ou incluir o **dia** quando os dados do contexto o permitirem. |

---

## 5. Requisitos não funcionais

| ID | Descrição |
|----|-----------|
| **NFR-ADN-MONTHLY-01** | **Segurança:** o endpoint de tick não é utilizável sem o segredo; respostas e logs não expõem o segredo. |
| **NFR-ADN-MONTHLY-02** | **Idempotência:** duas invocações no **mesmo** dia civil **não** duplicam o mesmo `idempotency_key` (constraint `UNIQUE` em `idempotency_key` ou `ON CONFLICT DO NOTHING` documentado). |
| **NFR-ADN-MONTHLY-03** | **Deploy:** **um único** destino (frontend **ou** backend) regista o cron em `vercel.json` / equivalente, para evitar **dois** ticks diários. |
| **NFR-ADN-MONTHLY-04** | **Observabilidade (opcional):** telemetria JSON alinhada a [`enqueue-telemetry`](../packages/scheduling/src/enqueue-telemetry.ts) em tentativas duplicadas ou skips. |

---

## 6. Critérios de aceite (testáveis)

1. Com data/hora simulada em que o **dia em SP** é D e a empresa activa tem `monthlyRunDay = D` e org com ADN activo, o **primeiro** tick cria **exactamente um** `adn_sync_jobs` com `status = queued` e `idempotency_key = sched_monthly:{companyId}:{YYYY-MM}`.
2. **Segundo** tick no **mesmo** dia civil **não** cria segunda linha com a mesma chave.
3. Empresa inactiva, dia civil ≠ D, ou `adn_sync_enabled = false` → **nenhum** novo job mensal desse tipo para o cenário em teste.
4. O worker existente, **sem** alteração obrigatória do fluxo HMAC, consegue **reclamar** e processar o job `queued` criado pelo agendador **quando** a org tem ADN activo e o ambiente do worker está saudável.
5. A UI de “Origem” / execuções **não** contradiz o PRD de dia configurável (cumpre **FR-ADN-MONTHLY-07**).

---

## 7. Dependências técnicas (resumo)

- Route App Router (ex. `api/internal/...`) + variável de ambiente do segredo; documentar em `.env.example` / runbook de ops.
- Entrada **crons** no `vercel.json` do projecto que serve a rota (ver [`backend/vercel.json`](../backend/vercel.json) e o espelho do frontend, se existir).
- Consulta a `companies` + `organizations` (filtro ADN) + chaves `sched_monthly:*` existentes em `adn_sync_jobs`.
- Possível migração: **UNIQUE** em `adn_sync_jobs.idempotency_key` **apenas** se ainda não existir e for compatível com outros usos do campo.

---

## 8. Métricas de sucesso

- Jobs mensais automáticos **criados** nos dias D esperados, sem duplicatas no mesmo mês civil por empresa.
- Taxa de jobs `queued` → concluídos pelo worker **sem regressão** face ao fluxo manual.
- Redução de pedidos de suporte do tipo “configurei o dia mas não correu sozinho”.

---

## 9. Riscos

| Risco | Mitigação |
|-------|-----------|
| Endpoint exposto ou segredo vazado | Revisão de segurança, rotação de segredo, rate limiting opcional. |
| Cron duplicado em dois projectos | **NFR-ADN-MONTHLY-03**: um único cron. |
| Política errada para org sem ADN | **FR-ADN-MONTHLY-05**; testes de aceite 3 e 4. |

---

## 10. Referências

- Briefing: [`briefing-coleta-mensal-adn-dia-configuravel.md`](briefing-coleta-mensal-adn-dia-configuravel.md)  
- PRD incremento dia D: [`prd-atualizacao-agendamento-por-empresa.md`](prd-atualizacao-agendamento-por-empresa.md)  
- Runbook: [`runbooks/agendamento-mensal-por-empresa.md`](runbooks/agendamento-mensal-por-empresa.md)  
- Brief legado: [`brief-atualizacao-agendamento-por-empresa.md`](brief-atualizacao-agendamento-por-empresa.md)

---

*PRD brownfield — AIOS PM track; implementação segue priorização da equipa.*
