# ADN — activação em *staging* (MVP)

## 1. Migração

Aplicar na base do mesmo projecto que `DATABASE_URL` (por ordem, conforme o repositório):

- `db/migrations/20260425103000_adn_01_ddl.sql`
- `db/migrations/20260427120000_org_local_download_root.sql` — pasta raiz Windows persistida (`organizations.local_download_root`) para o worker espelhar XML/PDF em disco.

**Worker espelho (LM-02):** após migração e `GET`/`PATCH` em `…/adn-sync-settings` (valor na base), o `poll_jobs.py` lê `organizations.local_download_root` por job. Variável `NFSE_LOCAL_MIRROR_DISABLED=1` desactiva a cópia local sem falhar o job; o `PATCH` final do job inclui `mirrorWritten`, `mirrorFailed` e `mirrorHadFailures` em `summaryJson` quando aplicável.

**Testes integração (LM-01B):** com Postgres acessível, na raiz do monorepo: `cd apps/web && npx vitest run src/app/api/v1/organization-adn-sync-settings.integration.test.ts` (requer `DATABASE_URL` no ambiente, igual ao portal).

## 2. Variáveis

Ver `.env.example` (secção ADN). Obrigatório para *worker* e rotas internas:

- `ADN_WORKER_HMAC_SECRET` — segredo partilhado portal ↔ VM.
- `SUPABASE_SERVICE_ROLE_KEY` — só servidor; usado para URLs assinadas Storage.
- `NEXT_PUBLIC_SUPABASE_URL` — já existente (FR1).
- `ADN_STORAGE_BUCKET` — criar bucket **privado** no Supabase Storage com este nome (ou ajustar env).

## 3. Activar a funcionalidade por organização

```sql
UPDATE organizations
SET adn_sync_enabled = true
WHERE id = '<uuid-da-org-de-teste>';
```

**Checklist:** confirmar que é ambiente de *staging*; não versionar UUIDs reais em docs.

## 4. Exemplo HMAC (corpo *raw* UTF-8)

Alinhado a `docs/stories/incremento-integracao-nfse-dist-adn.md` **ADN-03 AC2**:

1. Corpo JSON exactamente como enviado (sem reformatar).
2. `X-ADN-Timestamp` = segundos Unix UTC (string decimal).
3. `X-ADN-Signature` = hex minúsculo de `HMAC_SHA256(secret, rawBody)`.

Node (substituir `SECRET` e o JSON):

```bash
node -e "const c=require('crypto');const body=JSON.stringify({organizationId:'...',companyId:'...',accessKey:'0'.repeat(44),sha256:'a'.repeat(64),contentType:'application/xml'});const ts=String(Math.floor(Date.now()/1000));const sig=c.createHmac('sha256',process.env.ADN_WORKER_HMAC_SECRET).update(Buffer.from(body,'utf8')).digest('hex');console.log('X-ADN-Timestamp:',ts);console.log('X-ADN-Signature:',sig);console.log(body);"
```

Enviar `POST /api/internal/v1/adn/uploads/prepare` com esse corpo e cabeçalhos.

## 5. Ordem worker (*happy path*)

1. `uploads:prepare` → URL PUT assinada.  
2. `PUT` bytes no Storage.  
3. `artifacts:commit` com `artifactDraftId`.  
4. Espelho local (`mirror_local.py`) quando `local_download_root` preenchido e `NFSE_LOCAL_MIRROR_DISABLED` ≠ `1`.  
5. `PATCH /api/internal/v1/adn/jobs/:jobId` para estado / resumo (inclui contagens de espelho em `summaryJson`).

## 6. 429 no ADN nacional

Se o worker reportar *rate limit* ao ADN, reduzir paralelismo no **NFSE_dist** antes de subir réplicas do portal.
