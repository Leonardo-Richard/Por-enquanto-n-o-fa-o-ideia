# Postgres — menor privilégio para o worker ADN (`nfse-portal-bridge`)

O worker Python em [`workers/nfse-portal-bridge`](../../workers/nfse-portal-bridge) lê e actualiza apenas um subconjunto de tabelas. Por omissão usa-se a mesma `DATABASE_URL` que o portal; em produção pode valer a pena uma **role dedicada** com permissões mínimas.

## Tabelas e operações (código actual)

| Tabela | Operação | Ficheiros |
| ------ | -------- | --------- |
| `adn_sync_jobs` | `SELECT` implícito no `UPDATE … FOR UPDATE SKIP LOCKED`, `UPDATE` (claim, reclaim órfãos, fallbacks `failed` / `completed`) | `poll_jobs.py` |
| `organizations` | `SELECT` (`adn_sync_enabled`, `local_download_root`), `JOIN` no claim | `poll_jobs.py`, `mirror_local.py` |
| `companies` | `SELECT` (`cnpj_digits`, `trade_name`, `system_code`, `organization_id`) | `poll_jobs.py`, `mirror_local.py` |
| `company_certificates` | `SELECT` (`status`, `vault_ref`, …) | `cert_materialization.py` |
| `adn_artifacts` | `SELECT` (remirror) | `remirror_job.py` |

Não há `INSERT` nem `DELETE` a partir do worker nestas queries.

## Exemplo de role (schema `public`)

Ajuste o nome do schema se o projecto usar outro. **Não** copie passwords de exemplo para produção.

```sql
-- Roles: login fina + role de grupo (boa prática)
CREATE ROLE adn_worker NOINHERIT;
CREATE ROLE adn_worker_login WITH LOGIN PASSWORD 'gerar-segredo-forte' INHERIT;
GRANT adn_worker TO adn_worker_login;

GRANT USAGE ON SCHEMA public TO adn_worker;

-- Fila e recuperação de estado
GRANT SELECT, UPDATE ON TABLE public.adn_sync_jobs TO adn_worker;

-- Leitura para claim, espelho e certificado
GRANT SELECT ON TABLE public.organizations TO adn_worker;
GRANT SELECT ON TABLE public.companies TO adn_worker;
GRANT SELECT ON TABLE public.company_certificates TO adn_worker;
GRANT SELECT ON TABLE public.adn_artifacts TO adn_worker;
```

### Permissões ao nível da coluna (opcional, mais restritivo)

Se quiser limitar colunas expostas em `organizations` e `companies`, revogue `SELECT` na tabela e conceda só as colunas usadas pelo worker (PostgreSQL 15+):

```sql
REVOKE SELECT ON TABLE public.organizations FROM adn_worker;
GRANT SELECT (id, adn_sync_enabled, local_download_root) ON TABLE public.organizations TO adn_worker;

REVOKE SELECT ON TABLE public.companies FROM adn_worker;
GRANT SELECT (id, organization_id, cnpj_digits, trade_name, system_code) ON TABLE public.companies TO adn_worker;
```

Confirme os nomes das colunas com `\d organizations` / `\d companies` na sua migração Drizzle.

## RLS (Row Level Security)

Se activar **RLS** nestas tabelas para o portal, a role `adn_worker` precisa de **políticas** que permitam as mesmas linhas (por `organization_id` / `company_id`) ou, em último caso, `BYPASSRLS` só nessa role (menos desejável). Sem políticas adequadas, o worker falha com “permission denied” ou zero linhas.

## Ligação da aplicação

Na VM do worker, use a connection string do utilizador `adn_worker_login` (ou equivalente gerido pelo hosting). O portal continua a usar um utilizador com privilégios completos de aplicação.

## Referências

- README do worker: [`workers/nfse-portal-bridge/README.md`](../../workers/nfse-portal-bridge/README.md)
- Fila e fairness (desenho): [`docs/architecture-adn-job-queue-fairness.md`](../architecture-adn-job-queue-fairness.md)
