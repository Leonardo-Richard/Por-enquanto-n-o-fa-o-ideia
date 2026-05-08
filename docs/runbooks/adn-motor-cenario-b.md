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
| `ADN_CHROME_USER_DATA_DIR` | Motor Node | Perfil Chrome persistente (modo browser real). |
| `ADN_BROWSER_EXTENSION_DIR` | Motor Node | Pasta da extensão descompactada. |
| `ADN_NFSE_LOGIN_URL` | Motor Node | URL do login (defeito: Emissor Nacional). |
| `ADN_PLAYWRIGHT_CHANNEL` | Motor Node | `chrome` recomendado no Windows com certificado digital. |
| `ADN_PLAYWRIGHT_USE_BROWSER` | Motor Node | `1` força modo browser; senão activa se perfil e extensão estiverem definidos. |
| `ADN_PLAYWRIGHT_FATIA_ZERO` | Motor Node | `1` — só XML de teste (sem abrir browser). |
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

## 4. Selecção automática de certificado (multi-empresa)

O Chromium for Testing (binário do Playwright) **ignora** a policy `AutoSelectCertificateForUrls`, pelo que o portal NFS-e abre sempre o **diálogo nativo do Windows** a pedir certificado. Quando a máquina processa várias empresas, há vários e-CNPJ ICP-Brasil instalados na loja `CurrentUser\My` e é fácil confirmar o errado.

Estratégia em duas camadas (todas activas por defeito no Windows):

1. **`cert_materialization._purge_other_company_certs_in_windows_store(active_cnpj)`** corre antes de cada job. Remove de `CurrentUser\My` todos os certs cujo Subject CN tem o padrão `:<14 dígitos>` (e-CNPJ ICP-Brasil) **diferente** do CNPJ do job actual. Certificados de pessoa física (e-CPF), code signing, ou outros certificados pessoais **não** são tocados (filtro restrito a CNPJ).
2. **`cert_dialog_clicker.start_watcher`** corre numa thread daemon durante o motor; envia `WM_KEYDOWN/WM_KEYUP VK_RETURN` ao diálogo nativo (botão OK = confirmar pré-seleccionado). Como a loja só tem **1** cert ICP-Brasil de empresa após a purga, o ENTER cego confirma sempre o correcto.

A serialização garantida pelo `playwright_browser_file_lock` (§3) torna a purga segura — nunca há dois jobs em concorrência. O cert da outra empresa volta a ser instalado automaticamente assim que essa empresa entrar na fila (cada job re-importa do cofre).

| Variável | Default | Notas |
| -------- | ------- | ----- |
| `ADN_PURGE_OTHER_CERTS_BEFORE_IMPORT` | `1` | `0` desliga a purga (uso paralelo manual fora do worker). |
| `ADN_CERT_DIALOG_AUTOCLICK` | `1` | `0` desliga o watcher (debugging visual). |
| `ADN_CERT_DIALOG_MAX_CLICKS` | `50` | Limite de cliques de segurança (evita loop infinito). |

Verificação rápida no Windows após um job:

```powershell
Get-ChildItem -Path 'Cert:\CurrentUser\My' | Where-Object { $_.Subject -match ':(\d{14})' } | Select-Object Subject, Thumbprint
```

Deve mostrar **um único** cert ICP-Brasil de e-CNPJ — o do CNPJ que acabou de processar. No log do worker, procurar `[nfse-portal-bridge] Loja Pessoal do Windows: N certificado(s) ICP-Brasil de outras empresas removidos` e `[cert-dialog-clicker] ENTER enviado ao diálogo nativo`.

## 5. Versões Playwright / Chromium

Após `npm install` em `workers/adn-playwright-motor`, registar no controlo de mudanças:

- Versão `playwright` em `package.json`.
- Resultado de `npx playwright install chromium` no ambiente de staging (build ID Chromium).

## 6. Ligações

- Motor Node: [`workers/adn-playwright-motor/README.md`](../../workers/adn-playwright-motor/README.md)
- Template evidência O5: [`docs/templates/adn-o5-evidence-template.md`](../templates/adn-o5-evidence-template.md)
