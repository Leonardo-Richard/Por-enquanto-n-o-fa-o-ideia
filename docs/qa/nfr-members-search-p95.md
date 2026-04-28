# NFR — p95 da consulta de membros (MSYS-03)

**Alvo:** `p95 <= 1200 ms` para `GET .../system-users` com `q` + paginação em **staging**, conforme story.

## Como medir

1. Definir `NEXT_PUBLIC_MEMBERS_SERVER_SEARCH_ENABLED=1` no ambiente de staging.
2. Usar observabilidade (APM, logs estruturados com `duration_ms` no handler, ou k6/Locust) contra a URL do portal autenticado.
3. Cenário: superadmin com sessão real; varrer `q` de 1–3 caracteres e páginas 1–3; aquecer cache de app/BD se aplicável.
4. Reportar no PR: ferramenta, nº de amostras, **p95** e percentil máximo observado.

Se o alvo for revisto, registar aprovação `@po` + `@architect` no PR.
