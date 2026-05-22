# Fila `adn_sync_jobs` — fairness entre organizações (desenho)

**Estado:** desenho de evolução de produto; **implementação actual** em [`workers/nfse-portal-bridge/poll_jobs.py`](../../workers/nfse-portal-bridge/poll_jobs.py) usa uma **fila global FIFO**: `ORDER BY j.created_at ASC` com `FOR UPDATE SKIP LOCKED` entre jobs `queued` e orgs com `adn_sync_enabled = true`.

## Problema

Com uma única fila global, uma organização que enfileira muitos jobs consecutivos pode **adiantar-se** na ordem percebida por outras orgs: todas competem pelo mesmo `LIMIT 1`. Em cenários multi-tenant isto pode ser aceitável (justiça temporal global) ou não (SLA por cliente).

## Opções de evolução

### A — Round-robin por `organization_id`

Alterar o `claim_next_job` para escolher o próximo job entre orgs com pendentes, evitando servir duas vezes seguidas a mesma org enquanto outras tiverem `queued`.

- **Prós:** simples de explicar; reduz monopolização.
- **Contras:** query mais pesada (subconsulta por org “última servida”, estado em memória ou coluna `last_served_at`); precisa de testes de concorrência.

### B — Filas lógicas por organização + worker pool

N workers ou tags por org; cada worker só consome `WHERE organization_id = :fixed`.

- **Prós:** isolamento forte; SLA contratual por VM.
- **Contras:** custo operacional; subutilização se uma org tiver poucos jobs.

### C — Quota / rate limit de enqueue

No portal, limitar jobs `queued` simultâneos por `organization_id` (contagem + `429` ou fila diferida).

- **Prós:** não mexe no worker; política de produto visível na UI.
- **Contras:** não acelera orgs pequenas se a org grande já tiver enfileirado antes do limite.

### D — Prioridade explícita

Coluna `priority` (inteiro) em `adn_sync_jobs`; `ORDER BY priority DESC, created_at ASC`.

- **Prós:** suporta planos pagos / incidentes.
- **Contras:** requer governança para não inverstar fairness por defeito.

## Recomendação para o MVP actual

Manter **FIFO global** até existir métrica de “tempo de espera por org” ou reclamação de cliente. Se for necessário o primeiro incremento útil, **A (round-robin)** costuma ser o melhor custo/benefício sem multiplicar infra.

## Referências

- Worker: [`workers/nfse-portal-bridge/README.md`](../../workers/nfse-portal-bridge/README.md)
- Postgres mínimo para o worker: [`docs/runbooks/adn-worker-postgres-least-privilege.md`](runbooks/adn-worker-postgres-least-privilege.md)
- Arquitectura ADN: [`docs/architecture-integracao-nfse-dist-adn.md`](architecture-integracao-nfse-dist-adn.md)
