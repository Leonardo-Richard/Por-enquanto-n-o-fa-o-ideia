# GET `/api/v1/organizations/:organizationId/adn/recent-jobs`

Lista jobs ADN de **todas** as empresas monitoradas da organização (ordenado por `created_at DESC`, desempate `id DESC`).

## Query

| Parâmetro | Default | Máximo | Descrição |
| --------- | ------- | ------ | --------- |
| `limit` | 25 | 100 | Número de jobs por página. |
| `cursor` | — | — | Cursor **opaque** (base64url) devolvido em `nextCursor`; payload JSON `{ "ca": "<ISO createdAt>", "id": "<uuid>" }`. |

## Resposta 200

```json
{
  "jobs": [
    {
      "id": "uuid",
      "companyId": "uuid",
      "companyCnpjMasked": "12.***.***/0001-99",
      "status": "completed",
      "trigger": "manual",
      "summary": {},
      "createdAt": "2026-04-30T12:00:00.000Z",
      "updatedAt": "2026-04-30T12:05:00.000Z"
    }
  ],
  "nextCursor": null
}
```

## Erros

- **401** — sem sessão.
- **403** — sem acesso à organização ou org não activa na sessão (não superadmin).
- **404** — organização inexistente ou `adn_sync_enabled=false` (mesma política que rotas ADN públicas).
- **429** — `error_code: ADN_RATE_LIMIT`; cabeçalho `Retry-After`. Limite: env `ADN_PUBLIC_RECENT_JOBS_RATE_LIMIT_PER_MIN` (default **60** pedidos/min por utilizador e organização).
