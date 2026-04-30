# Worker NFSE_dist ↔ Portal (bridge)

Este directório liga o portal (jobs `adn_sync_jobs` + API interna HMAC) ao cliente **[NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist)** — o mesmo fluxo que o menu **«1) Baixar Notas de Todos os Clientes»** (`run_download_workflow` em `main.py`).

## Requisitos

- **Windows** (recomendado): `curl.exe` no PATH, certificado e-CNPJ na loja ou PFX em `certificates/`, conforme o [README do NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist).
- **Python 3.11+**
- Postgres acessível com o mesmo `DATABASE_URL` que o portal.
- Portal a correr com `ADN_WORKER_HMAC_SECRET` definido e bucket Storage ADN configurado (`docs/qa/adn-staging-setup.md`).

## 1. Descarregar o código NFSE_dist

Na raiz do monorepo:

```bash
npm run vendor:nfse-dist
```

Isto cria `third_party/NFSE_dist/` (ignorado pelo Git).

Instalar dependências Python do bridge:

```bash
cd workers/nfse-portal-bridge
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Variáveis de ambiente (worker)

| Variável | Exemplo | Notas |
| -------- | ------- | ----- |
| `DATABASE_URL` | `postgresql://…` | Igual ao portal. |
| `PORTAL_INTERNAL_URL` | `http://localhost:3000` | URL base onde o Next responde. |
| `ADN_WORKER_HMAC_SECRET` | *(hex forte)* | **O mesmo** valor no `.env` do portal. |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | `https://<ref>.supabase.co` | Necessário para o worker descarregar o certificado do cofre (vault_ref `supabase-storage:`). |
| `SUPABASE_SERVICE_ROLE_KEY` | *(service role)* | Necessário para leitura privada de `adn-certificates`. |
| `NFSE_DIST_ROOT` | *(opcional)* | Default: `<repo>/third_party/NFSE_dist`. |
| `NFSE_DIST_CLIENTS_LOCAL_PATH` | `C:\secrets\clients.local.json` | Opcional: ficheiro com thumbprint / `senha_cert` / PFX (não versionar). |
| `NFSE_CLEAN_BEFORE_RUN` | `1` | Opcional: limpa XML/PDF antigos do CNPJ antes da recolha (por defeito **não** limpa, melhor para fluxos grandes). |
| `POLL_INTERVAL_SEC` | `15` | Intervalo quando não há jobs. |
| `ADN_DOWNLOAD_ENGINE` | `nfse_dist` | `nfse_dist` (padrão) ou `playwright_extension` (motor B / subprocesso em `workers/adn-playwright-motor`). |
| `ADN_PLAYWRIGHT_MOTOR_NODE` | `node` | Comando Node para o motor B (defeito: `node.exe` no Windows). |
| `ADN_PLAYWRIGHT_MOTOR_SCRIPT` | *(caminho)* | Script de entrada; por defeito `<repo>/workers/adn-playwright-motor/cli.js`. |
| `ADN_BROWSER_PHASE_TIMEOUT_SEC` | `3600` | Tempo máximo de espera do subprocesso motor B. |
| `ADN_BROWSER_LOCK_PATH` | *(opcional)* | Ficheiro de lock entre processos `poll_jobs` durante motor B (default: `.adn_browser_worker.lock` na raiz do repo). |
| `NFSE_BRIDGE_SKIP_NFSE_DIST` | `1` | **Smoke/testes:** não executa **nenhum** motor de descarga (nem NFSE_dist nem Playwright); valida fila + `PATCH` + uploads vazios. |
| `NFSE_LOCAL_MIRROR_DISABLED` | `1` | **LM-02A:** não copia XML/PDF para `organizations.local_download_root` (o job continua `completed` se o Storage tiver sucesso). |
| `ADN_CLEAN_STALE_ON_WORKER_START` | `1` | **Órfãos:** ao arrancar `npm run worker:adn-bridge`, marca `failed` jobs que ficaram em `running` há mais de `ADN_STALE_JOB_HOURS` (default 24). Use `0` para desactivar. |
| `ADN_STALE_JOB_HOURS` | `24` | Idade mínima (`started_at`) para considerar o job órfão; também usado por `npm run fix:adn-stale-jobs`. |

**Importante (monorepo):** o Next lê `frontend/.env.local` com prioridade. Se `ADN_WORKER_HMAC_SECRET` estiver vazio aí, as rotas internas ADN respondem **503** mesmo com o segredo correcto na raiz `.env`.

**Motor cenário B (Playwright / extensão):** rollback, env e versões — [`docs/runbooks/adn-motor-cenario-b.md`](../../docs/runbooks/adn-motor-cenario-b.md).

## 3. Arranque

**Monorepo (recomendado em dev):** na raiz do repositório, com `DATABASE_URL` e `ADN_WORKER_HMAC_SECRET` em `.env`, `frontend/.env.local` ou `backend/.env.local`, e venv Python com `pip install -r workers/nfse-portal-bridge/requirements.txt`:

```bash
npm run dev:with-adn-bridge
```

Isto inicia o Next **frontend** (`npm run dev -w frontend`, porta 3000) e o worker em paralelo. Se trabalha só com o **backend** na porta 3001: `npm run dev:with-adn-bridge-backend`. O script `npm run worker:adn-bridge` tenta automaticamente `http://127.0.0.1:3000` e `:3001` onde `/api/health` responder, se `API_INTERNAL_URL` / `PORTAL_INTERNAL_URL` não estiverem definidos. Só o worker: `npm run worker:adn-bridge`.

**Jobs presos em `running`:** o worker só consome `queued`. Se o processo morrer ou o `PATCH` falhar (ex. 503), o job fica `running` para sempre na base até ser libertado. Por omissão, cada arranque do worker corre a limpeza de órfãos (ver tabela). Limpeza manual: `npm run fix:adn-stale-jobs` ou `ADN_STALE_JOB_HOURS=6 npm run fix:adn-stale-jobs` se precisar de um limiar mais curto. **Reset total** (marca *todos* os `running` como `failed`): `npm run fix:adn-all-running` — só em dev / quando tiver a certeza de que nenhum worker está a meio de um job real. Estado: `npm run status:adn-jobs`.

**Manual (produção ou depuração):** com o portal e Postgres activos:

```bash
cd workers/nfse-portal-bridge
.venv\Scripts\activate
set DATABASE_URL=...
set PORTAL_INTERNAL_URL=http://localhost:3000
set ADN_WORKER_HMAC_SECRET=...
python poll_jobs.py
```

**Smoke local (sem ADN nem certificado):** na raiz do repo, com o portal activo e o mesmo `ADN_WORKER_HMAC_SECRET` em `frontend/.env.local`:

```bash
node scripts/run-adn-bridge-smoke-once.mjs
```

Equivale a `NFSE_BRIDGE_SKIP_NFSE_DIST=1` e `python poll_jobs.py --once` (um job ou sair se a fila estiver vazia).

**Regressão motor `nfse_dist` (checklist):** com `ADN_DOWNLOAD_ENGINE` ausente ou `nfse_dist`, `NFSE_BRIDGE_SKIP_NFSE_DIST` **não** definido, mesmo `DATABASE_URL` / `ADN_WORKER_HMAC_SECRET` e portal a responder, `python poll_jobs.py --once` deve percorrer claim → `run_download_workflow` (ou ambiente de teste documentado) → `PATCH` completed **sem** erros de import. Testes unitários do bridge: `cd workers/nfse-portal-bridge && python -m pytest tests/ -q`.

Fluxo por job:

1. Reserva um job `queued` (org com `adn_sync_enabled`).
2. Escreve `clients.json` no NFSE_dist com o CNPJ da empresa monitorada.
   - Se `summary_json.fetchMode == "all"` no job, reinicia checkpoint para `0` e faz varredura completa (histórico disponível no ADN, não só incremental).
3. Se existir `company_certificates.vault_ref` activo (`supabase-storage:`), descarrega o PKCS#12 do cofre, materializa `certificates/<CNPJ>.pfx` e actualiza `clients.local.json` com `senha_cert`.
4. Copia `clients.local.json` opcional (`NFSE_DIST_CLIENTS_LOCAL_PATH`) e filtra para o CNPJ do job.
5. Executa `run_download_workflow()` (XML + PDF como no repositório original).
6. Limpa XML/PDF antigos em `data/<CNPJ>/` (best-effort) e só envia artefactos com timestamp desta execução, evitando falso positivo com ficheiros antigos (`uploads/prepare` → PUT → `artifacts/commit`).
7. Se a organização tiver `local_download_root` e `NFSE_LOCAL_MIRROR_DISABLED` ≠ `1`, espelha para `{root}\{Código-Apelido}\` — `system_code` + `trade_name` da empresa, no padrão Domínio Web (`mirror_local.py`).
8. Em modo normal (sem `NFSE_BRIDGE_SKIP_NFSE_DIST=1`), se não houver nenhum XML/PDF da empresa no fim da execução, o job é marcado como `failed` para forçar nova tentativa operacional.
9. Marca o job `completed` ou `failed` (`PATCH …/adn/jobs/:id`, com `mirrorWritten` / `mirrorFailed` / `mirrorHadFailures` no resumo quando aplicável).

### Regravar na pasta raiz (job já executado)

No portal, na ficha da empresa (ADN), é possível pedir um job **`retry`** com `remirrorFromJobId` no `summary_json`: o worker **não** volta ao ADN; apenas descarrega do Storage Supabase os artefactos já ligados a esse job e volta a gravá-los na pasta raiz (`remirror_job.py`). Requer `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente do worker (igual à materialização do certificado).

**Compatibilidade de layouts (ingestão):**
- Quando o XML não traz chave de acesso ADN com 44 dígitos, o bridge gera uma chave técnica determinística (44 dígitos) por `(cnpj, nsu/doc_id)` para manter idempotência XML/PDF e permitir ingestão no portal sem descarte (`syntheticAccessKeys` no resumo do job).

## 4. Certificado e organização

- O browser envia o certificado para cofre privado; o worker materializa o PFX no host local antes da recolha NFSE_dist.
- No portal: activar **Sincronização ADN** na organização (**Configurações**) e pedir sync na ficha da empresa.

## 5. Limitações conhecidas

- **Caminhos no portal (`local_download_root`):** prefixos **`\\?\`** / **`\\.\`** (extended path / device) e **UNC** (`\\` + servidor + partilha) são rejeitados na API com código estável (diferente de `C:\...`). O worker não usa extended paths para a raiz.
- A UI Rich do NFSE_dist espera consola; em ambientes sem TTY pode falhar — preferir `cmd.exe` interactivo ou consola de serviço com utilizador logado.
- Paralelismo PDF (`NFSE_DIST_PDF_WORKERS`, etc.) segue o [README upstream](https://github.com/RafaelOliveiraCf/NFSE_dist#variáveis-de-ambiente).
