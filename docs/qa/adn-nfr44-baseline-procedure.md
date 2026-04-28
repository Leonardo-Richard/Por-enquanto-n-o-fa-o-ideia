# NFR44 — baseline de chamadas GET `adn/sync` por sessão (MSYS-04)

**Meta:** redução ≥ 30% de pedidos por sessão activa no painel ADN, sem queda da taxa de sucesso dos jobs.

## Baseline (antes)

1. Desligar polling adaptativo: `NEXT_PUBLIC_ADN_ADAPTIVE_POLLING_ENABLED` não definido ou `0`.
2. Abrir a ficha de uma empresa com painel ADN; realizar um fluxo típico (pedido de sync + esperar estados).
3. No DevTools → Rede, filtrar por `adn/sync` ou contar no consola do browser: `globalThis.__portalAdnSyncGetCount` (incrementado em cada GET do cliente após resposta HTTP).

## Depois (polling adaptativo)

1. Activar `NEXT_PUBLIC_ADN_ADAPTIVE_POLLING_ENABLED=1`.
2. Repetir o mesmo cenário e comparar `__portalAdnSyncGetCount` e duração da sessão.

## Evidência no PR

- Valores baseline vs pós (contagem e, se possível, taxa de sucesso de jobs no período).
- Nota: o contador é **por tab** e reseta com reload; usar a mesma disciplina nos dois lados da comparação.
