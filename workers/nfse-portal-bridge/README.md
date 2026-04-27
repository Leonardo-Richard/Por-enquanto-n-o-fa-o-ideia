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
| `NFSE_DIST_ROOT` | *(opcional)* | Default: `<repo>/third_party/NFSE_dist`. |
| `NFSE_DIST_CLIENTS_LOCAL_PATH` | `C:\secrets\clients.local.json` | Opcional: ficheiro com thumbprint / `senha_cert` / PFX (não versionar). |
| `POLL_INTERVAL_SEC` | `15` | Intervalo quando não há jobs. |
| `NFSE_BRIDGE_SKIP_NFSE_DIST` | `1` | **Só smoke/testes:** não chama `run_download_workflow` (valida fila + `PATCH` + uploads vazios). |
| `NFSE_LOCAL_MIRROR_DISABLED` | `1` | **LM-02A:** não copia XML/PDF para `organizations.local_download_root` (o job continua `completed` se o Storage tiver sucesso). |

**Importante (monorepo):** o Next lê `frontend/.env.local` com prioridade. Se `ADN_WORKER_HMAC_SECRET` estiver vazio aí, as rotas internas ADN respondem **503** mesmo com o segredo correcto na raiz `.env`.

## 3. Arranque

Com o portal (`npm run dev`) e Postgres activos:

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

Fluxo por job:

1. Reserva um job `queued` (org com `adn_sync_enabled`).
2. Escreve `clients.json` no NFSE_dist com o CNPJ da empresa monitorada.
3. Copia `clients.local.json` opcional (`NFSE_DIST_CLIENTS_LOCAL_PATH`).
4. Executa `run_download_workflow()` (XML + PDF como no repositório original).
5. Percorre `data/<CNPJ>/` e envia cada XML/PDF ao portal (`uploads/prepare` → PUT → `artifacts/commit`).
6. Se a organização tiver `local_download_root` e `NFSE_LOCAL_MIRROR_DISABLED` ≠ `1`, espelha para `{root}\{CNPJ}\{system_code}\` (`mirror_local.py`).
7. Marca o job `completed` ou `failed` (`PATCH …/adn/jobs/:id`, com `mirrorWritten` / `mirrorFailed` / `mirrorHadFailures` no resumo quando aplicável).

## 4. Certificado e organização

- O certificado **não** passa pelo browser: continua na VM do worker, como no NFSE_dist.
- No portal: activar **Sincronização ADN** na organização (**Configurações**) e pedir sync na ficha da empresa.

## 5. Limitações conhecidas

- **Caminhos no portal (`local_download_root`):** prefixos **`\\?\`** / **`\\.\`** (extended path / device) e **UNC** (`\\` + servidor + partilha) são rejeitados na API com código estável (diferente de `C:\...`). O worker não usa extended paths para a raiz.
- A UI Rich do NFSE_dist espera consola; em ambientes sem TTY pode falhar — preferir `cmd.exe` interactivo ou consola de serviço com utilizador logado.
- Paralelismo PDF (`NFSE_DIST_PDF_WORKERS`, etc.) segue o [README upstream](https://github.com/RafaelOliveiraCf/NFSE_dist#variáveis-de-ambiente).
