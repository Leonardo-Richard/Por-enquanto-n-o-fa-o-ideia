# Runbook — agendamento mensal por empresa

Operação do tick diário (`America/Sao_Paulo`) e do job `scheduled_monthly` com `monthly_run_day` e chave `sched_monthly:{company_id}:{YYYY-MM}`.

## Visão geral

- O worker corre **uma vez por dia** (ex.: 06:05 SP) com autenticação (`CRON_SECRET` ou equivalente).
- Para cada empresa `active` cujo **dia civil em SP** coincide com `monthly_run_day`, calcula-se `scheduled_for` = **06:00** nesse dia em SP (TIMESTAMPTZ).
- O `INSERT` do job deve usar **`ON CONFLICT (idempotency_key) DO NOTHING`** (ou equivalente) para cumprir AC3–AC4.

## Âncoras de diagnóstico

### #duplo-tick-mesmo-dia

Dois ticks no mesmo dia civil não devem criar duas linhas: a segunda tentativa encontra a mesma `idempotency_key` e é ignorada. **Observabilidade:** chamar `logStructuredMonthlyEnqueueDuplicateIgnored` ou `maybeLogMonthlyEnqueueDecision` (`@repo/scheduling`) para emitir **uma linha JSON** em `console.info` / `warn` com `event: scheduled_monthly_enqueue_ignored`.

### #mudanca-intra-mes

Se o operador alterar `monthly_run_day` **no mesmo mês civil** em que já existe job com a chave desse `YYYY-MM`, **não** haverá novo `INSERT` para esse mês (AC5/AC7). O primeiro tick do **mês seguinte** aplica o novo D quando o dia civil coincidir.

### #fevereiro-d28

Empresas com `monthly_run_day = 28` só disparam em fevereiro quando existe dia 28 (anos bissextos e não bissextos). Validar `scheduled_for` com testes unitários em `packages/scheduling` (cálculo civil SP via `Intl`, sem biblioteca de TZ externa).

### #pos-execucao-mesmo-mes

Após `succeeded` / `failed` / pendente / retry, a chave `sched_monthly:…:{YYYY-MM}` continua a ocupar o mês: alterações de dia **não** agendam segunda coleta mensal no mesmo mês civil (NFR8 / AC7).

## Implementação de referência

- Lógica pura (TZ + chave + `scheduled_for`): `packages/scheduling` — `decideMonthlyScheduledEnqueue`; telemetria duplicate — `logStructuredMonthlyEnqueueDuplicateIgnored` / `maybeLogMonthlyEnqueueDecision`.
- Validação HTTP / hidratação portal: `@repo/shared` — `parseMonthlyRunDayFromRequest`, `hydrateMonthlyRunDay`.
- DDL: `db/migrations/20260422120000_companies_monthly_run_day.sql`.
- **Tick HTTP (produção):** `GET` ou `POST` `/api/internal/v1/adn/cron/monthly-enqueue` com `Authorization: Bearer <CRON_SECRET>`. Vercel Cron (projecto **frontend**): `frontend/vercel.json` — `5 9 * * *` (UTC) ≈ 06:05 `America/Sao_Paulo` (sem DST). Ver `frontend/.env.example` (`CRON_SECRET`, `DATABASE_URL`).

### #endpoint-cron-mensal-adn

Chamada diária protegida; o handler enfileira `adn_sync_jobs` com `trigger = monthly` e chave `sched_monthly:{companyId}:{YYYY-MM}`. Não logar o token.
