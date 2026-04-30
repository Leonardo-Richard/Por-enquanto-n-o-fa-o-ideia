# Motor ADN cenário B (Playwright)

Subprocesso invocado pelo worker [`nfse-portal-bridge`](../nfse-portal-bridge) quando `ADN_DOWNLOAD_ENGINE=playwright_extension`.

## Instalação (Windows / staging)

```bash
cd workers/adn-playwright-motor
npm install
# Opcional: browsers Playwright para futura automação completa
# npx playwright install chromium
```

## Variáveis de ambiente (resumo)

| Variável | Descrição |
| -------- | ----------- |
| `ADN_CHROME_USER_DATA_DIR` | Perfil Chrome reutilizável (nunca enviado no `summary_json` do portal). |
| `ADN_BROWSER_DEBUG` | `1` — logs extra no stderr (ainda sem caminhos sensíveis). |
| `ADN_PLAYWRIGHT_FATIA_ZERO_FAIL` | `1` — força saída com falha mapeável (testes do subprocesso). |

Documentação completa de operação: [`docs/runbooks/adn-motor-cenario-b.md`](../../docs/runbooks/adn-motor-cenario-b.md).

## CLI

```text
node cli.js --output-dir <dir> --cnpj <14 dígitos> --job-id <uuid>
```

- **`--output-dir`:** pasta `data/<cnpj>/` sob `NFSE_DIST_ROOT` (o worker passa o caminho completo).
- Escreve XML de **fatia zero** quando termina com sucesso (artefacto de teste para integração).

## Exit code e stderr → `failureCategory` (pai Python)

O worker [`download_engine.py`](../nfse-portal-bridge/download_engine.py) mapeia na seguinte ordem: prefixos `STDERR_CAT_*` no stderr; depois o código de saída.

| Exit | Prefixo stderr (linha) | `failureCategory` |
| ---- | ------------------------ | ----------------- |
| `10` | `STDERR_CAT_SESSION` | `session` |
| `11` | `STDERR_CAT_PORTAL` | `portal` |
| `12` | `STDERR_CAT_EXTENSION` | `extension` |
| `13` | `STDERR_CAT_DISK` | `disk` |
| `14` | `STDERR_CAT_TIMEOUT` | `timeout` |
| ≠0 (outros) | — | `unknown` |

**Timeout do subprocesso:** o processo pai aplica `ADN_BROWSER_PHASE_TIMEOUT_SEC` e grava `timeout` no portal.

## Fatia zero

Em staging Windows, o comando acima deve produzir pelo menos um XML na pasta indicada **ou** terminar com exit≠0 com categoria não genérica — ver critérios na story ADN-B-02.
