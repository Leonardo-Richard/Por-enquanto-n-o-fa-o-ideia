# Runbook — motor ADN cenário B (Playwright / extensão Chrome)

**Referência:** worker [`workers/nfse-portal-bridge`](../../workers/nfse-portal-bridge), motor Node [`workers/adn-playwright-motor`](../../workers/adn-playwright-motor), **NFR-ADN-B-05** (versões).

## 1. Variáveis de ambiente (ordem de leitura)

| Variável | Onde | Notas |
| -------- | ---- | ----- |
| `ADN_DOWNLOAD_ENGINE` | Worker | `nfse_dist` (padrão produção) ou `playwright_extension` (cenário B). |
| `NFSE_BRIDGE_SKIP_NFSE_DIST` | Worker | `1` = sem descarga real (smoke). Deve saltar **ambos** os motores. |
| `ADN_PLAYWRIGHT_MOTOR_SCRIPT` | Worker | Caminho absoluto para `cli.js` do motor. |
| `ADN_BROWSER_PHASE_TIMEOUT_SEC` | Worker / motor | Tempo máximo do subprocesso (kill → `timeout` no portal). |
| `ADN_BROWSER_LOCK_PATH` | Worker | Caminho do ficheiro de lock entre processos (opcional; ver §3). |
| `ADN_CHROME_USER_DATA_DIR` | Motor (Node) | Perfil reutilizável; **nunca** exposto em `summary_json` do portal. |
| `ADN_BROWSER_DEBUG` | Motor | `1` = logs adicionais no host (redigidos). |
| `ADN_PUBLIC_RECENT_JOBS_RATE_LIMIT_PER_MIN` | Portal (Next) | Limite GET execuções org (default 60/min). |

## 2. Rollback instantâneo

1. Definir `ADN_DOWNLOAD_ENGINE=nfse_dist` (ou remover a variável).
2. Reiniciar o processo `poll_jobs` / serviço Windows do worker.
3. Não é necessário redeploy do portal para o worker voltar ao motor NFSE_dist.

## 3. Serialização de jobs browser (NFR-ADN-B-04)

- Um processo `poll_jobs` trata jobs **em sequência**.
- Vários processos na mesma VM: lock em disco (`filelock`) — ficheiro por defeito `<repo>/.adn_browser_worker.lock`, configurável com **`ADN_BROWSER_LOCK_PATH`**. O segundo worker **aguarda** até o primeiro libertar o lock (timeout infinito por defeito).

## 4. Versões Playwright / Chromium

Após `npm install` em `workers/adn-playwright-motor`, registar no controlo de mudanças:

- Versão `playwright` em `package.json`.
- Resultado de `npx playwright install chromium` no ambiente de staging (build ID Chromium).

## 5. Ligações

- Motor Node: [`workers/adn-playwright-motor/README.md`](../../workers/adn-playwright-motor/README.md)
- Template evidência O5: [`docs/templates/adn-o5-evidence-template.md`](../templates/adn-o5-evidence-template.md)
