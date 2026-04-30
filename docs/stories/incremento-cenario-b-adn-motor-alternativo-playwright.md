# User stories — Incremento: motor alternativo cenário B (Playwright / worker Windows)

**Produto:** Portal de Automação de Notas Fiscais  
**Fontes:** [`docs/prd-cenario-b-adn-playwright-extensao-chrome.md`](../prd-cenario-b-adn-playwright-extensao-chrome.md), [`docs/architecture-cenario-b-adn-playwright-extensao-chrome.md`](../architecture-cenario-b-adn-playwright-extensao-chrome.md), [`docs/front-end-spec-cenario-b-adn-playwright-extensao-chrome.md`](../front-end-spec-cenario-b-adn-playwright-extensao-chrome.md), [`docs/briefing-cenario-b-adn-playwright-extensao-chrome.md`](../briefing-cenario-b-adn-playwright-extensao-chrome.md)  
**Pré-requisitos:** integração ADN base operacional ([`docs/stories/incremento-integracao-nfse-dist-adn.md`](incremento-integracao-nfse-dist-adn.md) — **ADN-03** worker + **PATCH** jobs, **ADN-04** fluxos públicos mínimos); worker [`workers/nfse-portal-bridge`](../workers/nfse-portal-bridge/) a consumir fila `adn_sync_jobs`.  
**Autor:** SM (River / AIOS)  
**Data:** 2026-04-30  
**Versão do conjunto:** **0.4** — polimento PO pós-9,5/10: terminologia (*dispensa*, *padrão*), **NFR21** com números fechados no PR + `adn-rate-limit`.  
**Estado do conjunto:** **Ready for development** — critérios de *validate-story-draft* atendidos; assinatura formal `@po` conforme política do projecto. Rota `GET …/recent-jobs`: encoding de `cursor` fechado no PR com `@architect` (ver **ADN-B-03**).

---

## Índice

| ID | Título resumido | Dependências principais |
| -- | ----------------- | ------------------------ |
| **ADN-B-01** | Worker: selecção `ADN_DOWNLOAD_ENGINE`, `summary_json` canónico (**FR-ADN-B-04**), falhas com `failureCategory`, compatível **NFSE_BRIDGE_SKIP_NFSE_DIST** | — |
| **ADN-B-02** | Motor B (subprocesso): CLI/contrato B2, env, timeout, saída para `data/{cnpj}/` | **ADN-B-01** |
| **ADN-B-03** | API pública: listagem de jobs ADN ao nível da **organização** (para alimentar Execuções) | **ADN-04** (padrões ACL/404 FR45) |
| **ADN-B-04** | UI: página **Execuções** com motor + falha segura conforme spec UX | **ADN-B-03** (ou mock contratual até lá) |
| **ADN-B-05** | Ops: runbook motor cenário B + registo gate **O5** / **FR-ADN-B-08** (template) | **ADN-B-02** (referência de versões) |

**Ordem sugerida:** **ADN-B-01** → **ADN-B-02** em paralelo com **ADN-B-03** → **ADN-B-04** → **ADN-B-05**.

**Paralelização:** **ADN-B-03** pode arrancar logo após **ADN-B-01** se o contrato `summary_json` estiver estável (campos da arquitectura §4).

---

## Rastreio PRD / arquitectura → stories

| ID story | FR / NFR / secção |
| -------- | ----------------- |
| ADN-B-01 | **FR-ADN-B-01**, **FR-ADN-B-04**, **FR-ADN-B-07**, **NFR-ADN-B-02**, **NFR-ADN-B-04** (serialização quando aplicável + doc) |
| ADN-B-02 | **FR-ADN-B-02**, **FR-ADN-B-03**, **FR-ADN-B-05**, **NFR-ADN-B-01**, **NFR-ADN-B-03**, **NFR-ADN-B-05** |
| ADN-B-03 | **FR-ADN-B-04** (exposição ao cliente), **NFR-ADN-B-06** (sem alterar HMAC interno), **NFR21** (rate limit / 429; ver tabela de NFR em [`prd-integracao-nfse-dist-adn`](../prd-integracao-nfse-dist-adn.md)) |
| ADN-B-04 | PRD §6 UX, spec UX glossário + matriz falhas |
| ADN-B-05 | **O5**, **FR-ADN-B-08**, **NFR-ADN-B-05** |

---

## ADN-B-01 — Worker: motor configurável + `summary_json` canónico

### Narrativa

Como **operador de infraestrutura**, quero alternar entre o motor **NFSE_dist** e o motor cenário B **só por variáveis de ambiente**, para poder fazer rollback instantâneo sem deploy do portal.

Como **produto**, quero que cada job concluído ou falhado registe **`downloadEngine`** e categorias de falha **seguras**, para a UI e o suporte diagnosticarem sem segredos.

### Escopo técnico (resumo)

- [`poll_jobs.py`](../workers/nfse-portal-bridge/poll_jobs.py): após preparar certificado / `clients.json`, ler **`ADN_DOWNLOAD_ENGINE`** (default `nfse_dist`). Se `nfse_dist`, manter chamada actual a `run_download_workflow_once`. Se valor cenário B acordado (ex. `playwright_extension`), invocar função/módulo que por ora pode delegar a **ADN-B-02** ou falhar com `failureCategory` `unknown` se subprocesso não configurado.
- Em **`patch_job` de sucesso** (resumo actual com `engine: "NFSE_dist"`): acrescentar **`downloadEngine: "nfse_dist"`** e manter **`engine`** se necessário para retrocompatibilidade ([arquitectura §4](../architecture-cenario-b-adn-playwright-extensao-chrome.md)).
- **`fail_job`**: estender para aceitar opcionalmente **`failureCategory`** e **`userSafeDetail`** truncados; persistir em `summary_json` conforme PRD.
- Documentar no docstring do worker a semântica **`NFSE_BRIDGE_SKIP_NFSE_DIST=1`** vs motor B (**FR-ADN-B-07**): recomendação arquitectónica — skip **ambos** os motores de descarga.

### Critérios de aceitação

1. Com `ADN_DOWNLOAD_ENGINE` **ausente** ou `nfse_dist`, comportamento actual do worker **inalterado** para utilizadores (mesmos artefactos possíveis).
2. `PATCH` interno de job **completed** inclui **`downloadEngine`** no `summaryJson` para fluxo NFSE_dist.
3. Falhas chamam `patch_job` com `summaryJson` contendo **`failureCategory`** quando mapeável (**session**, **portal**, **extension**, **disk**, **timeout**, **unknown**) e mensagem **sem** paths UNC/HTML.
4. Testes unitários mínimos (onde aplicável) ou script smoke documentado para combinação skip+motor.
5. **Regressão NFSE_dist:** checklist ou comando smoke documentado no README do worker que, com `nfse_dist` e sem skip, executa pelo menos o caminho **claim → NFSE_dist ou skip documentado → PATCH** sem regressão de imports (evidência em PR ou `docs/qa/`).
6. **NFR-ADN-B-04:** com motor `playwright_extension`, **não** iniciar segundo subprocesso browser enquanto um job browser estiver **running** no mesmo processo `poll_jobs`, **ou** documentar e aplicar `ADN_BROWSER_MAX_CONCURRENT=1` com comportamento verificável (logs “browser busy skip” ou fila).

### Fora de âmbito

- Implementação Playwright completa (story **ADN-B-02**).

### CodeRabbit / qualidade

- Verificar que **nenhum** segredo (thumbprint completo, PFX path sensível) entra em `summary_json`.

---

## ADN-B-02 — Motor B: subprocesso Playwright (contrato B2)

### Narrativa

Como **engenharia**, quero um **executável isolado** (Node ou Python) que o worker invoque com argumentos estáveis, para versionar Chromium/Playwright independentemente do Python do bridge.

### Timebox e critério de fatia zero (feedback PO)

- **Spike máximo sugerido:** **5 dias úteis** para primeiro comando estável + documentação env (ajustável em sprint planning).
- **Fatia zero aceitável:** em staging Windows, o subprocesso **ou** produz artefacto válido na pasta acordada **ou** termina com **exit≠0** e o pai persiste **`failureCategory`** ≠ genérico (ex.: `extension`, `session`) — ou seja, **falha mapeável conta como demonstração do contrato**, desde que runbook descreva o estado da sessão gov.br.

### Escopo técnico (resumo)

- Novo pacote sob **`workers/`** (ex. `workers/adn-playwright-motor/`) com `package.json`, script de entrada, dependência `playwright`, README com variáveis **`ADN_BROWSER_*`** da [arquitectura §3](../architecture-cenario-b-adn-playwright-extensao-chrome.md).
- Contrato: argumentos **`--output-dir`**, **`--cnpj`**, **`--job-id`** (correlacionar logs); exit codes convencionados ou stderr prefixado para mapeamento **`failureCategory`** no pai.
- Timeout: respeitar **`ADN_BROWSER_PHASE_TIMEOUT_SEC`** no pai (kill subprocesso → **timeout**).
- Saída: ficheiros sob `NFSE_DIST_ROOT/data/{cnpj}/` (ou caminho acordado) para **`sync_data_directory`** não distinguir origem.

### Critérios de aceitação

1. Em ambiente de **staging** Windows, comando documentado produz pelo menos **um** XML ou PDF de teste na pasta esperada **ou** falha controlada com exit≠0 **mapeável** para `failureCategory` (cumpre **fatia zero** acima).
2. Perfil Chrome (`ADN_CHROME_USER_DATA_DIR`) e pasta de extensão **nunca** referenciados no `summary_json`.
3. Logs locais redigidos (**NFR-ADN-B-02**); debug só com **`ADN_BROWSER_DEBUG=1`**.
4. Tabela **exit code / prefixo stderr → `failureCategory`** documentada no README do pacote para o pai aplicar sem interpretação ad hoc.

### Dependências

- **ADN-B-01** (hook no `poll_jobs` chama subprocesso quando motor B activo).

### Fora de âmbito

- Publicar extensão na Chrome Web Store; supõe path local descompactado operacional.

---

## ADN-B-03 — API: listagem de jobs ADN por organização

### Narrativa

Como **utilizador com sessão na organização**, quero ver **execuções recentes de todas as empresas monitoradas** da org num só sítio, para não precisar abrir empresa a empresa.

### Escopo técnico (resumo)

- Hoje [`handleGetAdnSync`](../frontend/src/server/api/v1/handlers/adn-sync.ts) lista jobs **por empresa**. Introduzir **`GET /api/v1/organizations/:organizationId/adn/recent-jobs`** (nome final alinhado ao `@architect`) que:
  - Valida **mesmo gate ADN** que rotas existentes (`resolveAdnPublicAccess` / **FR45** 404 se feature off).
  - **Paginação:** query `limit` (**padrão 25**, máximo **100**) e `cursor` opcional; ordenação **fixa:** `created_at DESC`, desempate por `id DESC`. **Encoding do `cursor`:** fechar no PR (opaque vs `createdAt`+`id`) com `@architect`; referência única em comentário OpenAPI ou `docs/api/`.
  - **NFR21 / abuso:** aplicar **rate limit** na mesma família das rotas ADN públicas — reutilizar padrão em [`adn-rate-limit`](../frontend/src/lib/adn-rate-limit.ts) + [`distributed-rate-limit`](../frontend/src/lib/distributed-rate-limit.ts) (chave por utilizador + `organizationId` ou equivalente documentado). **Valores concretos** (pedidos por minuto e/ou janela deslizante, nome do bucket GET) são **definidos e documentados no PR**, coerentes com limites já usados em rotas ADN existentes (ex. POST sync). Resposta **429** com corpo estável e, quando aplicável, **`Retry-After`** (alinhado a testes existentes em `adn-api.integration.test.ts` para POST; estender ou criar bucket **GET** dedicado no PR).
  - Corpo: lista de jobs com `companyId`, `status`, `trigger`, `summaryJson`, `createdAt`, `updatedAt`; opcional **`companyCnpjMasked`** ou label para coluna **Execuções** — **sem** expor campos internos não previstos no spec UX.

**Contrato de resposta (exemplo ilustrativo — alinhar tipos na implementação):**

```json
{
  "jobs": [
    {
      "id": "uuid",
      "companyId": "uuid",
      "companyCnpjMasked": "12.***.***/0001-99",
      "status": "completed",
      "trigger": "manual",
      "summary": {
        "downloadEngine": "nfse_dist",
        "artifactsXml": 3
      },
      "createdAt": "2026-04-30T12:00:00.000Z",
      "updatedAt": "2026-04-30T12:05:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### Critérios de aceitação

1. Utilizador **sem** membership na org → **403**; org com `adn_sync_enabled=false` → **404** (consistente com política ADN existente).
2. Resposta inclui **`summary`** (ou equivalente) suficiente para **`downloadEngine`** / **`failureCategory`** quando presentes no JSON.
3. Teste de integração ou contrato (Vitest) cobre pelo menos ACL + 404 flag + **paginação** (`limit` respeitado).
4. Documentar na story ou OpenAPI parcial em `docs/api/` os query params **`limit`** / **`cursor`**.
5. **NFR21:** quando o cliente exceder o **limite documentado no PR** para este **GET**, resposta **429** com mensagem segura e **`error_code`** estável (nome exacto no PR); incluir **pelo menos um** teste de integração que force **429** (ou dispensa formal `@po`+`@qa` com evidência manual no PR).

### Dependências

- Modelo `adn_sync_jobs` já existente (**ADN-01**).

---

## ADN-B-04 — UI: página Execuções + motor e falhas (spec UX)

### Narrativa

Como **operador fiscal**, quero na lista **Execuções** ver uma linha secundária **Motor: Recolha padrão / Recolha automatizada** e mensagens de falha **compreensíveis**, para saber se o problema foi sessão, portal ou automatização.

### Pré-requisito de contexto (feedback PO)

- A página deve obter **`organizationId`** coerente com a **organização activa na sessão** (padrão Better Auth / sessão: campo `activeOrganizationId` após [`session-active-organization`](../../frontend/src/server/api/v1/handlers/session-active-organization.ts) ou fluxo equivalente do incremento **organização vs empresas monitoradas**). Se não houver org seleccionada, mostrar estado vazio ou CTA para seleccionar org (copy neutra), **sem** chamar **ADN-B-03** sem contexto.

### Escopo técnico (resumo)

- [`execucoes/page.tsx`](../frontend/src/app/(dashboard)/execucoes/page.tsx): substituir ou complementar dados de `localStorage` com fetch a **ADN-B-03** quando **`organizationId`** da sessão existir e ADN disponível (**FR45**).
- Módulo de mapeamento **`downloadEngine`** → rótulos PT e **`failureCategory`** → copy do [spec UX §4–5](../front-end-spec-cenario-b-adn-playwright-extensao-chrome.md) (sem “Playwright” na UI pública).
- Se API indisponível ou sem dados, manter fallback ou empty state do spec §9.

### Critérios de aceitação

1. Com job que tenha `summary.downloadEngine=nfse_dist`, UI mostra **Recolha padrão** (ou equivalente aprovado).
2. Com `playwright_extension`, UI mostra **Recolha automatizada**.
3. Falha com `failureCategory=session` mostra copy da matriz — **sem** stack, **sem** JSON bruto.
4. Acessibilidade: anúncio coerente se linha expandível (spec §10).
5. **Sem `organizationId` na sessão:** utilizador vê estado guiado (empty / mensagem), **sem** erro de rede genérico como único feedback.

### Dependências

- **ADN-B-03** (ou contrato mock estável até API pronta — **explicitar no PR** se temporário).
- Incremento **login / org activa** já utilizável no dashboard (**LER** / **ORG** — ver [`incremento-login-empresas-roles.md`](incremento-login-empresas-roles.md) / [`incremento-dois-niveis-organizacao-vs-empresas-fiscais.md`](incremento-dois-niveis-organizacao-vs-empresas-fiscais.md)).

### Testes (fora do MVP obrigatório)

- **E2E smoke** Playwright na app (não confundir com motor ADN): opcional; se não implementado no mesmo PR, registar issue ou **dispensa formal** `@po`+`@qa` com smoke manual listado.

---

## ADN-B-05 — Runbook ops + registo compliance (O5)

### Narrativa

Como **equipa de operações**, quero um **runbook** com versões, rollback e localização de perfil; como **compliance**, quero um **template** para evidência **FR-ADN-B-08** antes de produção com extensão de terceiros.

### Escopo

- Ficheiro **`docs/runbooks/adn-motor-cenario-b.md`** (ou nome acordado): env vars, ordem de rollback, serialização de jobs browser, referência **NFR-ADN-B-05** (versões Playwright/Chromium).
- Template Markdown ou checklist: data, responsável, **dispensa** ou **aprovação** para **O5**.

### Critérios de aceitação

1. Runbook referenciado desde [`poll_jobs`](../workers/nfse-portal-bridge/poll_jobs.py) docstring ou README do worker.
2. Template **não** contém afirmação legal de conformidade gov.br — apenas registo de processo.

### Dependências

- **ADN-B-02** mínimo para números de versão reais no runbook.

---

## Notas para `@dev` / `@architect`

- **IDs estáveis:** usar prefixo **`ADN-B-*`** nas branches/PRs para rastreio.
- **POC primeiro:** **ADN-B-02** pode entregar “happy path” mínimo antes de UI completa; **ADN-B-04** pode usar dados mock do contrato **ADN-B-03** até integração E2E.
- **CodeRabbit:** em alterações ao worker, validar ausência de dados sensíveis em payloads `PATCH` e logs.

---

## Definição de fecho do incremento (DoD conjunto)

O incremento **motor cenário B + transparência na UI** considera-se **entregue para staging** quando:

1. **ADN-B-01** e **ADN-B-03** estão merged com testes mínimos referidos nas AC.
2. **ADN-B-04** consome a API real ou mock **contratualmente equivalente** ao exemplo de **ADN-B-03**, com mapeamento UX validado pelo spec.
3. **ADN-B-02** cumpre **fatia zero** (artefacto ou falha mapeável) **ou** está explicitamente **deferido** para sprint seguinte com **dispensa formal** `@po`; neste caso **ADN-B-01** deve manter `nfse_dist` como único motor em produção.
4. **ADN-B-05** existe como runbook + template **O5** antes de activar motor B em produção com extensão de terceiros (**FR-ADN-B-08**).

---

## Registo de versões (changelog do conjunto)

| Versão | Data       | Notas |
| ------ | ---------- | ----- |
| 0.1    | 2026-04-30 | Primeira fatia SM (PRD + arquitectura + UX). |
| 0.2    | 2026-04-30 | Refinamento PO: API paginada, sessão org, regressão NFSE_dist, fatia zero motor B, DoD conjunto. |
| 0.3    | 2026-04-30 | Fecho PO 9→10: **NFR21** no GET org-wide, estado **Ready**, `cursor` + rate limit documentados. |
| 0.4    | 2026-04-30 | Polimento PO 9,5→10: *dispensa* / *padrão*, **NFR21** com limites fechados no PR + alinhamento `adn-rate-limit`. |

---

## Dev Agent Record

### Completion Notes

- **ADN-B-01–B-05** implementados: worker com `ADN_DOWNLOAD_ENGINE`, `summary_json` com `downloadEngine` / `failureCategory`, motor Node `workers/adn-playwright-motor` (fatia zero), `GET …/adn/recent-jobs` com cursor + rate limit, UI Execuções com `useAppSession`, runbook e template O5.
- Testes: `workers/nfse-portal-bridge` — `python -m pytest tests/ -q`. Integração ADN (`adn-api.integration.test.ts`): no CI (job `quality`) já existe `DATABASE_URL` para Postgres — os testes de integração incluem `adn-api.integration.test.ts` quando não estão em skip.
- **Correcções pós-QA:** lock entre processos (`filelock`, `.adn_browser_worker.lock` / `ADN_BROWSER_LOCK_PATH`); heurística `failureCategory` **portal** em `infer_failure_category_from_exception` (HTTP 503/429, indisponível, etc.); Execuções com padrão **disclosure** (`<details>`) + `aria-live` no carregamento; `.gitignore` do ficheiro de lock.

### File List

- `workers/nfse-portal-bridge/poll_jobs.py`, `download_engine.py`, `tests/test_download_engine.py`, `requirements.txt`, `README.md`
- `workers/adn-playwright-motor/package.json`, `package-lock.json`, `cli.js`, `README.md`
- `frontend/src/server/api/v1/handlers/adn-public-access.ts`, `adn-recent-jobs-org.ts`, `frontend/src/lib/adn-rate-limit.ts`, `adn-executions-display.ts`, `adn-recent-jobs-client.ts`
- `frontend/src/app/api/v1/organizations/[organizationId]/adn/recent-jobs/route.ts`, `frontend/src/app/(dashboard)/execucoes/page.tsx`
- `frontend/src/app/api/v1/adn-api.integration.test.ts`, `frontend/.env.example`
- `docs/api/adn-recent-jobs-get.md`, `docs/runbooks/adn-motor-cenario-b.md`, `docs/templates/adn-o5-evidence-template.md`
- `.gitignore` (entrada `.adn_browser_worker.lock`)

### Change Log

- 2026-04-30: Incremento cenário B ADN (motor configurável, API org-wide, UI Execuções, runbook O5).
- 2026-04-30: Correcções QA — lock `filelock`, heurística portal, a11y Execuções (`details` + live region).

---

## QA Results

**Revisão:** Quinn (QA / AIOS) · **Data:** 2026-04-30  
**Âmbito:** implementação actual no repositório (worker Python, motor Node, API Next, UI Execuções, docs).

### Decisão de gate: **CONCERNS** (aprovável com ressalvas)

O conjunto cumpre a maior parte dos critérios ADN-B-01 a ADN-B-05; as ressalvas são sobretudo **evidência de testes com Postgres**, **a11y §10** e **mapeamento `portal` em falhas genéricas Python**.

### Rastreio por fatia

| ID | Avaliação | Notas |
| -- | --------- | ----- |
| **ADN-B-01** | **PASS** com ressalvas | `ADN_DOWNLOAD_ENGINE`, `downloadEngine` no PATCH completed, `fail_job` com `failureCategory` / sanitização UNC/HTML, skip **ambos** os motores com `NFSE_BRIDGE_SKIP_NFSE_DIST`, lock + `ADN_BROWSER_MAX_CONCURRENT`, pytest em `workers/nfse-portal-bridge/tests/`, README com regressão. **Ressalva:** NFR-ADN-B-04 entre **vários processos** `poll_jobs` na mesma VM não usa lock de ficheiro — apenas sequencial no processo + doc; aceitável se operação documentar um worker por host. **Ressalva:** `infer_failure_category_from_exception` não produz `portal` (só motor stderr / exit). |
| **ADN-B-02** | **PASS** | Pacote `workers/adn-playwright-motor`, CLI com `--output-dir` / `--cnpj` / `--job-id`, tabela README ↔ `download_engine.py`, timeout no pai, fatia zero com XML de teste ou falha mapeável (`ADN_PLAYWRIGHT_FATIA_ZERO_FAIL`). Perfil/extensão não vai para `summary_json` do portal. |
| **ADN-B-03** | **PASS** com ressalvas | `resolveAdnOrganizationPublicAccess`, GET paginado, cursor base64url `{ ca, id }` documentado em `docs/api/adn-recent-jobs-get.md`, rate limit dedicado (`adnRecentJobsRateKey`, default 60/min), 429 + `ADN_RATE_LIMIT` + `Retry-After`. Corpo com `summary` (equivalente a `summaryJson`). **Ressalva:** testes em `adn-api.integration.test.ts` **exigem `DATABASE_URL`** — executar em CI ou ambiente com Postgres para evidência automática. |
| **ADN-B-04** | **CONCERNS** | `useAppSession` / `activeOrganizationId`, fetch API real, rótulos motor e matriz de falhas sem “Playwright”, sem JSON bruto na falha, estado sem org sem chamada à API. **Gap:** spec UX §10 (linha expandível + anúncio) — implementação usa tabela estática e `title` no `<tr>`, sem padrão expandível/acessível explícito; considerar melhoria ou dispensa PO em issues. E2E app Playwright continua opcional (story). |
| **ADN-B-05** | **PASS** | `docs/runbooks/adn-motor-cenario-b.md`, template O5 sem afirmação legal gov.br, referência em docstring/README do bridge. Versões Playwright/Chromium dependem de registo operacional (esperado). |

### Segurança / CodeRabbit

- **PASS** esperado para exposição em `summary_json`: sanitização de caminhos no worker; não foi detectado thumbprint/PFX no PATCH nesta revisão estática. Recomendação: correr CodeRabbit nos ficheiros do worker antes do merge.

### Evidência de testes

| Tipo | Estado |
| ---- | ------ |
| Pytest (`download_engine`) | OK (5 testes; reproducível com `pip install -r workers/nfse-portal-bridge/requirements.txt`). |
| Vitest integração ADN | **Requer `DATABASE_URL`** — não validado nesta revisão sem DB; recomendado job CI. |

### Recomendações (não bloqueantes)

1. Correr `npx vitest run src/app/api/v1/adn-api.integration.test.ts` com Postgres em CI ou local.
2. Opcional: `aria-live` ou padrão expansível se produto quiser fechar §10 ao pé da letra.
3. Opcional: heurística `portal` em `infer_failure_category_from_exception` se houver texto 503/429 do NFSE_dist (baixo risco se UI já trata `portal` vindo do motor B).

---

— River (SM) / AIOS — refinamento PO v0.4
