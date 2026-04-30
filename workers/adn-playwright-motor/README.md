# Motor ADN cenário B (Playwright)

Subprocesso invocado pelo worker [`nfse-portal-bridge`](../nfse-portal-bridge) quando `ADN_DOWNLOAD_ENGINE=playwright_extension`.

## Instalação (Windows)

**Automático (recomendado):** na raiz do monorepo:

```bash
npm run setup:adn-playwright
```

Isto cria `.local/`, `npm install` e `npx playwright install chromium` no motor, `pip install` do bridge, e um **manifest placeholder** em `.local/adn-browser-extension` se ainda não existir extensão — **substitua** essa pasta pelo pacote real descompactado.

**Sincronizar a extensão «Baixar NFSe» desde o Chrome (Windows):** com a extensão instalada no perfil Default, na raiz do monorepo: `npm run sync:adn-extension-from-chrome` (copia a versão mais recente para `.local/adn-browser-extension`).

**Manual:**

```bash
cd workers/adn-playwright-motor
npm install
npx playwright install chromium
```

Para **certificado digital** com o armazenamento de certificados do Windows, recomenda-se o Chrome instalado na máquina:

```bash
set ADN_PLAYWRIGHT_CHANNEL=chrome
```

(Valor `chrome` = canal Playwright que usa o Google Chrome do sistema.)

## O que o modo «browser real» faz

1. Abre o **Emissor Nacional** (URL configurável; por defeito o login do portal contribuinte).
2. Arranca o Chromium **com a extensão** (`--load-extension` / `--disable-extensions-except`).
3. Usa um **perfil persistente** (`ADN_CHROME_USER_DATA_DIR`) — sessões, cookies e políticas de certificado ficam guardados aí.
4. Tenta clicar numa ligação/botão de **«Certificado digital»** (vários selectores de texto).
5. **Espera** até aparecer pelo menos um ficheiro **`.xml` novo** na pasta `--output-dir` (a extensão ou o fluxo após login deve gravar aí), ou falha com `STDERR_CAT_EXTENSION` ao fim do tempo.

### Limitação importante (certificado)

O **popup nativo do Windows** para escolher o certificado **não é controlado pelo Playwright**. Em produção, o operador deve:

- usar um **perfil** onde já existe sessão válida no portal; **ou**
- políticas Chrome que **escolham o certificado** automaticamente para o domínio; **ou**
- primeira execução **assistida** (alguém escolhe o certificado à mão uma vez) e depois o perfil reutiliza.

Sem isso, o passo 4 pode abrir o diálogo e ficar à espera até ao timeout.

## Variáveis de ambiente

| Variável | Obrigatório (modo browser) | Descrição |
| -------- | ---------------------------- | --------- |
| `ADN_CHROME_USER_DATA_DIR` | Sim | Pasta do **perfil Chrome** (fora do repositório; permissões restritas). |
| `ADN_BROWSER_EXTENSION_DIR` | Sim | Pasta da **extensão descompactada** (nunca commitar). |
| `ADN_NFSE_LOGIN_URL` | Não | URL inicial. Por defeito: `https://www.nfse.gov.br/EmissorNacional/Login?ReturnUrl=%2fEmissorNacional` |
| `ADN_PLAYWRIGHT_USE_BROWSER` | Não | `1` força modo browser mesmo sem as duas pastas (útil para testar erros de config). |
| `ADN_PLAYWRIGHT_FATIA_ZERO` | Não | `1` força só XML de teste (ignora browser). |
| `ADN_PLAYWRIGHT_CHANNEL` | Não | Ex.: `chrome` para usar Chrome instalado (recomendado com certificado). |
| `ADN_BROWSER_HEADLESS` | Não | `1` = headless (muitas extensões **não** funcionam; por defeito **janela visível**). |
| `ADN_BROWSER_WAIT_ARTIFACTS_SEC` | Não | Segundos a aguardar XML novo (defeito `300`). |
| `ADN_BROWSER_DEBUG` | Não | `1` — logs no stderr (sem caminhos completos sensíveis em produção). |
| `ADN_PLAYWRIGHT_FATIA_ZERO_FAIL` | Não | `1` — falha simulada (testes). |

Documentação de operação: [`docs/runbooks/adn-motor-cenario-b.md`](../../docs/runbooks/adn-motor-cenario-b.md).

## CLI

```text
node cli.js --output-dir <dir> --cnpj <14 dígitos> --job-id <uuid>
```

- **`--output-dir`:** `NFSE_DIST_ROOT/data/<cnpj>/` (o worker Python passa o caminho completo).
- O worker **herda** as variáveis de ambiente do processo que o arranca (serviço Windows / consola).

## Exit code e stderr → `failureCategory` (pai Python)

| Exit | Prefixo stderr | Categoria |
| ---- | ----------------- | --------- |
| `10` | `STDERR_CAT_SESSION` | `session` |
| `11` | `STDERR_CAT_PORTAL` | `portal` |
| `12` | `STDERR_CAT_EXTENSION` | `extension` |
| `13` | `STDERR_CAT_DISK` | `disk` |
| `14` | `STDERR_CAT_TIMEOUT` | `timeout` |

O timeout global do subprocesso continua a ser `ADN_BROWSER_PHASE_TIMEOUT_SEC` no **worker** Python.

## Exemplo mínimo (Windows)

```bat
set ADN_DOWNLOAD_ENGINE=playwright_extension
set ADN_CHROME_USER_DATA_DIR=D:\dados-adn\chrome-profile
set ADN_BROWSER_EXTENSION_DIR=D:\dados-adn\extensao-descompactada
set ADN_PLAYWRIGHT_CHANNEL=chrome
set ADN_BROWSER_HEADLESS=0
python poll_jobs.py
```

(Além das variáveis já obrigatórias do bridge: `DATABASE_URL`, `ADN_WORKER_HMAC_SECRET`, etc.)
