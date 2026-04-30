# Runbook: worker ADN no Easypanel (Docker)

Este runbook descreve um **segundo serviço** no Easypanel que corre `poll_jobs.py` em Linux, consumindo a mesma base Postgres que o portal e chamando as rotas internas HTTPS do Next.

**Limitações:** o fluxo **NFSE_dist** foi pensado primeiro para **Windows**; em Linux costuma funcionar com `curl` do sistema, mas valide com um job real ou use `NFSE_BRIDGE_SKIP_NFSE_DIST=1` só para testar fila + HMAC. O motor **Playwright + Chrome de sistema** não é suportado nesta imagem.

---

## 1. Portal (primeiro serviço)

1. Confirme que o portal responde em **HTTPS** (ex.: `https://auto-….easypanel.host`).
2. **Remova** `API_INTERNAL_URL` se apontar para `http://localhost:3001` e só existir um processo na porta **3000** (imagem `Dockerfile` do repo).
3. No mesmo serviço, mantenha pelo menos:
   - `DATABASE_URL`
   - `ADN_WORKER_HMAC_SECRET` (valor forte, partilhado com o worker)
   - `SUPABASE_SERVICE_ROLE_KEY`, bucket ADN, etc. (já necessários ao portal)

---

## 2. Novo serviço «ADN worker» no Easypanel

1. **Criar aplicação** → tipo que permita **Dockerfile** a partir de repositório Git (ou build a partir de pasta).
2. **Repositório:** o mesmo monorepo deste projecto.
3. **Dockerfile:** `Dockerfile.adn-worker` (na raiz).
4. **Build:** na raiz do repo, o ficheiro `.dockerignore` já inclui `workers/nfse-portal-bridge` no contexto (sem `node_modules` pesados). Comando típico:

   ```bash
   docker build -f Dockerfile.adn-worker -t <sua-tag> .
   ```

   Opcional (imagem mais pequena): `--ignorefile .dockerignore.adn-worker`.

5. **Porta:** o worker **não** expõe HTTP; pode deixar a porta por defeito ignorada ou qualquer valor — o processo só faz saída HTTPS para o portal e Postgres.

---

## 3. Variáveis de ambiente (worker)

| Variável | Obrigatório | Exemplo / notas |
| -------- | ----------- | ---------------- |
| `DATABASE_URL` | Sim† | **Igual** ao do portal (mesmo Postgres/Supabase). |
| `ADN_WORKER_DATABASE_URL` | Sim† | **Mesma** connection string se o painel **não** passar `DATABASE_URL` ao contentor (caso frequente no Easypanel). |
| `PORTAL_INTERNAL_URL` | Sim‡ | URL **HTTPS pública** do portal, **sem** barra final. Ex.: `https://auto-automacaonf.….easypanel.host`. |
| `API_INTERNAL_URL` | Não | Se preenchido, **prevalece** sobre `PORTAL_INTERNAL_URL`. Use só se tiver backend interno real nessa URL. |
| `ADN_WORKER_HMAC_SECRET` | Sim | **Mesmo** valor que no portal. |
| `NEXT_PUBLIC_SUPABASE_URL` ou `SUPABASE_URL` | Sim | URL do projecto Supabase (materialização do certificado). |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role (ler bucket do certificado). |
| `POLL_INTERVAL_SEC` | Não | Segundos entre ciclos quando a fila está vazia (default `15`). |
| `ADN_DOWNLOAD_ENGINE` | Não | `nfse_dist` (default) ou `playwright_extension` (nesta imagem Linux o cenário B **não** está garantido). |
| `NFSE_LOCAL_MIRROR_ENABLED` | Não | `1` só se quiser cópia em disco **dentro do contentor** (pasta raiz da org — raro em cloud). |

† Pelo menos uma das duas (`DATABASE_URL` ou `ADN_WORKER_DATABASE_URL`) com valor não vazio.  
‡ Obrigatório se `API_INTERNAL_URL` estiver vazio.

**Não** defina `API_INTERNAL_URL=http://localhost:3000` dentro do contentor do worker a menos que o portal esteja na **mesma rede Docker** com esse hostname — em Easypanel típico use sempre a URL **pública** HTTPS.

---

## 4. Verificação

1. No portal, **«Buscar notas agora»** com ADN activo → job `queued`.
2. Logs do worker: deve aparecer `Job … em execução…` e depois `PATCH job=completed` ou erro explícito.
3. Na ficha da empresa, **«Ficheiros no portal»** deve listar XML/PDF após sucesso.

---

## 5. Smoke sem ADN (opcional)

Para validar só fila + HMAC + Postgres:

- `NFSE_BRIDGE_SKIP_NFSE_DIST=1` no worker (não corre NFSE_dist nem Playwright).

---

## 6. Coleta mensal

O **cron HTTP** continua a correr no **portal** (Easypanel), com `CRON_SECRET`, a enfileirar jobs. O **worker** deste runbook processa esses jobs da mesma forma que os manuais.

---

## Referências

- `workers/nfse-portal-bridge/README.md`
- `Dockerfile` (portal) vs `Dockerfile.adn-worker` (este worker)
