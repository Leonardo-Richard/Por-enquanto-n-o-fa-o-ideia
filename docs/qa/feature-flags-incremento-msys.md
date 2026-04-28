# Feature flags — incremento MSYS (mapeamento PRD → ambiente)

No Next.js, variáveis expostas ao browser **devem** usar o prefixo `NEXT_PUBLIC_`. Os ACs do pacote citam nomes lógicos; no deploy use:

| Story / AC (nome lógico) | Variável de ambiente (runtime) |
| ------------------------ | ------------------------------ |
| `MEMBERS_SERVER_SEARCH_ENABLED` | `NEXT_PUBLIC_MEMBERS_SERVER_SEARCH_ENABLED` = `1` ou `true` |
| `ADN_ADAPTIVE_POLLING_ENABLED` | `NEXT_PUBLIC_ADN_ADAPTIVE_POLLING_ENABLED` = `1` ou `true` |

**Servidor-only** (sem prefixo público):

| Uso | Variável |
| --- | -------- |
| Forçar limite em memória (rollback MSYS-06) | `RATE_LIMIT_LOCAL_ONLY=1` |
| Upstash Redis (rate limit distribuído) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

Documentar no PR a combinação por ambiente (staging/produção).
