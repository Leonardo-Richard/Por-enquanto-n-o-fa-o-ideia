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
| `ADN_BROWSER_FETCH_FROM` | Motor Node | `YYYY-MM-DD` ou **`year-start`** (1 Jan do ano corrente). Se ausente, usa **`today − 12 meses + 1 dia`** (janela máxima segura). |
| `ADN_BROWSER_FETCH_TO` | Motor Node | `YYYY-MM-DD` ou hoje (default). |
| `ADN_BROWSER_FETCH_DAYS` | Motor Node | Janela em dias a partir de hoje quando `FETCH_FROM` não está definido. Sem default — quando ausente o motor usa `today − 12 meses + 1 dia`. **Limite forçado**: a extensão recusa janelas > 12 meses ("Período máximo permitido: 12 meses"); o motor faz clamp e avisa via stderr. |
| `ADN_BROWSER_TIPO_NOTA` | Motor Node | `Emitidas` (default) ou `Recebidas`. |
| `ADN_BROWSER_COMPACT_ZIP` | Motor Node | `1` (default) liga a opção «Compactar em .zip» no popup da extensão para que esta entregue **um único ZIP** com todos os XML. `0` deixa a extensão entregar XMLs individuais (ficheiros com nome UUID sem extensão `.xml`, que o motor depois renomeia automaticamente). |
| `ADN_BROWSER_PERIOD_RETRIES` | Motor Node | Tentativas para encolher a janela quando a extensão recusa por "12 meses" (default 3, 0 desliga). |
| `ADN_BROWSER_PERIOD_SHRINK_DAYS` | Motor Node | Dias a adicionar ao `from` em cada retry (default 14). |
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
| `ADN_CERT_DIALOG_MAX_CLICKS` | `50` | Limite global de cliques (PostMessage + keybd_event). |
| `ADN_CERT_DIALOG_DIAG_SEC` | `8` | Intervalo (s) de dump diagnóstico de janelas Chrome/NFS-e no log. |
| `ADN_CERT_DIALOG_GLOBAL_ENTER` | `1` | `0` desliga camada 3 (foreground fallback) — necessária quando o Chromium não expõe o título do diálogo. |
| `ADN_CERT_DIALOG_GLOBAL_DELAY` | `10` | Segundos a aguardar antes do primeiro ENTER global (evita disparar antes do diálogo aparecer). |
| `ADN_CERT_DIALOG_GLOBAL_INTERVAL_SEC` | `5` | Intervalo mínimo entre ENTERs globais. |
| `ADN_CERT_DIALOG_GLOBAL_MAX` | `2` | Limite de ENTERs globais (camada 3): 1 confirma o cert, 1 retry. Mais que isso interfere com a extensão pós-login. |

Verificação rápida no Windows após um job:

```powershell
Get-ChildItem -Path 'Cert:\CurrentUser\My' | Where-Object { $_.Subject -match ':(\d{14})' } | Select-Object Subject, Thumbprint
```

Deve mostrar **um único** cert ICP-Brasil de e-CNPJ — o do CNPJ que acabou de processar. No log do worker, procurar `[nfse-portal-bridge] Loja Pessoal do Windows: N certificado(s) ICP-Brasil de outras empresas removidos` e `[cert-dialog-clicker] ENTER enviado ao diálogo nativo`.

## 4.1. Limite de 12 meses da extensão

A extensão «Baixar NFSe» recusa qualquer janela superior a **12 meses** com:

> Período máximo permitido: 12 meses. Reduza o período e tente novamente.

Empíricamente, a extensão usa contagem em **meses calendário** ou **365 dias estritos** — mesmo janelas de 364 dias (e.g., `2025-05-12 → 2026-05-11`) são recusadas. O motor adopta duas medidas:

1. **Janela default conservadora**: `today − 1 ano + 7 dias` (≈358 dias). Em 11/5/2026 → de 18/5/2025 a 11/5/2026.

2. **Retry automático com encolhimento progressivo**: quando o popup mostra `Período máximo permitido: 12 meses` após o click, o motor encolhe o `from` em `ADN_BROWSER_PERIOD_SHRINK_DAYS` (default 14) e tenta de novo, até `ADN_BROWSER_PERIOD_RETRIES` (default 3) tentativas. A janela efectivamente aceite é logada via stderr (`janela efectiva (após retry)`).

Para histórico mais antigo (`>12 meses`), dispare **jobs separados** com janelas explícitas:

```
job 1: ADN_BROWSER_FETCH_FROM=2025-01-01 ADN_BROWSER_FETCH_TO=2025-12-31
job 2: ADN_BROWSER_FETCH_FROM=2024-01-01 ADN_BROWSER_FETCH_TO=2024-12-31
```

Quando esgotar todos os retries (caso a janela de 1 ano explícita seja rejeitada e o encolhimento não cubra), o motor sai com `STDERR_CAT_EXTENSION extensão recusou o pedido (period_over_12_months)` + screenshot do popup em `data/<cnpj>/_diag/popup-<ts>.png`.

## 5. Ingestão de downloads da extensão (ZIP + XMLs sem extensão)

A extensão «Baixar NFSe» pode entregar os artefactos em **dois modos**:

1. **Compactar em .zip = ON** (default deste motor, via `ADN_BROWSER_COMPACT_ZIP=1`): um único `*.zip` com todos os XML lá dentro. Recomendado — facilita a ingestão.
2. **Compactar em .zip = OFF**: a extensão dispara `chrome.downloads.download` para **cada XML individual** com o nome igual ao UUID do ficheiro **sem extensão** (ex.: `40344be2-2789-4dfb-9774-df2093ff7c75`, 9 KB). Depois apaga-os após processar (os 3 primeiros ficam «Removido» no histórico do Chrome). Este é o caso onde, na prática, o `outputDir` ficava vazio.

O motor (`run-browser.mjs`) faz, em cada iteração do loop de espera:

1. **`adoptExtensionlessDownloads`** — lê os primeiros 64 bytes de cada ficheiro sem extensão em `--output-dir` e:
   - se começar por `<?xml` (ou `<` após BOM): renomeia para `<orig>.xml`,
   - se começar por `PK\x03\x04`: renomeia para `<orig>.zip` (descomprimido no passo seguinte).
2. **`ingestZipsFromUserDownloads`** — move ZIPs novos do `~/Downloads` do utilizador para `--output-dir` (fallback caso a extensão ignore o `download.default_directory`). Heurística permissiva: qualquer `*.zip` com mtime ≥ início do job.
3. **`ingestZipDownloads`** — descomprime cada ZIP novo em `--output-dir/<zipBaseName>/` (Windows: `Expand-Archive`; com fallback `tar -xf`. Linux: `unzip`). Renomeia o ZIP para `<orig>.processed` (idempotência).
4. **`adoptExtensionlessDownloads` (2.ª passagem)** — caso o ZIP contivesse XMLs ainda sem extensão.
5. **`listNewXmlFilesRecursive`** — procura `.xml` novos recursivamente (apenas mtime ≥ início do job).

Se ao fim do timer (`ADN_BROWSER_WAIT_ARTIFACTS_SEC`) ainda não houver `.xml`, o motor faz um snapshot diagnóstico para o `stderr_tail`:

```
[diag] outputDir=... ficheiros_recentes=N zips_extraidos=N zips_de_downloads=N
[diag] outputDir > <path> (<size>B)   # até 10 entradas mais recentes
[diag] downloadsDir=... ficheiros_recentes=N
[diag] downloads > <path> (<size>B)
```

Esse snapshot é incluído no `summaryJson.stderr_tail` do PATCH `failed` no portal, permitindo descobrir se o ZIP caiu fora da pasta esperada ou ficou em `.crdownload` (download interrompido por TLS, popup bloqueado, etc.).

## 6. Versões Playwright / Chromium

Após `npm install` em `workers/adn-playwright-motor`, registar no controlo de mudanças:

- Versão `playwright` em `package.json`.
- Resultado de `npx playwright install chromium` no ambiente de staging (build ID Chromium).

## 7. Ligações

- Motor Node: [`workers/adn-playwright-motor/README.md`](../../workers/adn-playwright-motor/README.md)
- Template evidência O5: [`docs/templates/adn-o5-evidence-template.md`](../templates/adn-o5-evidence-template.md)
