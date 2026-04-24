# Código de terceiros

## NFSE_dist (cliente ADN — Windows)

O portal integra-se com o repositório público **[NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist)** (Python, `curl.exe`/Schannel, `clients.json` / `clients.local.json`).

Na raiz do monorepo:

```bash
npm run vendor:nfse-dist
```

Isto cria `third_party/NFSE_dist/` (não versionado; ignorado pelo `.gitignore`).

O **worker** que liga jobs do portal ao NFSE_dist está em `workers/nfse-portal-bridge/` — ver o `README.md` desse directório.
