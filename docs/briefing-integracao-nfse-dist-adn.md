# Briefing: integração da automação de recolha NFS-e (ADN) com o portal

## 1. Objetivo

Traduzir o brainstorm sobre integração do repositório **[NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist)** (download de XML da distribuição DF-e e PDF DANFSE no Ambiente Nacional) no **Portal de Automação de Notas Fiscais** (`apps/web`, multi-tenant organização / empresas fiscais).

Este documento é **somente briefing**: fixa âmbito, restrições, direcções de arquitetura e critérios de sucesso. **Não** substitui PRD, story de implementação nem desenho detalhado de API.

---

## 2. Contexto de produto e repositório

- O portal é um monorepo **Turborepo** + **Next.js** + **Postgres (Supabase)** com ACL multi-tenant (organizações e empresas monitoradas).
- A recolha fiscal no ADN depende de **certificado e-CNPJ (A1)** e de cliente capaz de **mTLS** / Schannel em ambiente controlado.
- O **NFSE_dist** é um cliente **Python** orientado a **Windows**, invocando **`curl.exe` (Schannel)** e certificado na loja Windows (`CurrentUser` / `LocalMachine`) ou **PFX**, com configuração `clients.json` / `clients.local.json`, paralelismo configurável de PDFs e registo de falhas em dead-letter (`logs/pdf_dead_letter.jsonl`).

Conclusão: a integração “no site” é, na prática, **orquestração + persistência + UI** sobre um **worker** que executa (ou evolui a partir de) essa lógica — não um módulo colado no bundle do browser.

---

## 3. Restrições e premissas técnicas

| Restrição | Implicação |
|------------|------------|
| Certificado e-CNPJ | Tratar como **segredo de infraestrutura**; nunca expor chave privada ao cliente web. |
| NFSE_dist actual | **Windows** + `curl.exe`; não assumir execução nativa em Linux/Vercel sem redesenho ou substituição do transporte TLS. |
| ADN | Risco de **429 / 503**; paralelismo elevado de PDFs aumenta pressão; utilizadores devem ver estados “em fila / parcial / concluído”. |
| Multi-tenant | Cada CNPJ / empresa monitorada pertence a uma **organização**; artefactos e jobs devem ser **namespaced** (ex.: `organization_id` + `company_id`). |

---

## 4. Direcção de arquitetura recomendada (MVP → produção)

### 4.1 Padrão alvo: worker assíncrono + portal

1. **Worker** (VM Windows dedicada ou ambiente equivalente) executa o fluxo de download (existente ou encapsulado via `python main.py` / processo agendado).
2. **Portal** expõe **API servidor** para ingestão de metadados e ficheiros (ou upload directo para **object storage** com URL assinada), com **autenticação forte** (token de serviço rotativo, mTLS interna, ou segredo partilhado só em servidor).
3. **Base de dados** regista **jobs de sincronização** (estado, intervalo de datas, último sucesso, erros).
4. **Armazenamento de blobs** (ex.: **Supabase Storage**) guarda XML/PDF com prefixo por tenant; **RLS** e políticas alinhadas ao modelo ORG/empresa.

### 4.2 Geração de configuração a partir do portal

- **`clients.json`**: derivado da BD — CNPJs e nomes das empresas monitoradas (sem segredos).
- **`clients.local.json`**: gerado no worker a partir de cofre (thumbprint / loja / PFX); **não** versionar; modelo alinhado ao `clients.example.json` do repositório upstream.

### 4.3 MVP de produto: reduzir risco do ADN

- Priorizar **XML (DF-e)** como primeira entrega estável; **PDF (DANFSE)** em segundo plano, **on-demand** por nota ou com **workers** baixos (`NFSE_DIST_PDF_WORKERS`), até métricas de erro estabilizarem.
- Ingerir **dead-letter** para tabela de erros com acção **“reprocessar”** na UI (admin / gestor da empresa).

### 4.4 Evolução (opcional, pós-MVP)

- **Serviço em container Linux** com mTLS e PFX a partir de secret manager, reduzindo dependência de Windows/Schannel — **projecto separado** com paridade de comportamento e testes de regressão.

---

## 5. Contrato conceptual API / worker (para detalhar numa story)

Campos mínimos sugeridos (nome exacto fica para OpenAPI / story):

| Direcção | Responsabilidade |
|----------|------------------|
| Portal → Worker (opcional) | Enfileirar job: `company_id`, janela de datas, prioridade, idempotency key. |
| Worker → Portal | Reportar conclusão parcial/total; enviar lista de objectos (chave de acesso, tipo mime, path no storage, hash). |
| Worker → Storage | Upload de ficheiros com ACL derivada do vínculo organização/empresa. |

**Idempotência:** guardar hash ou identificador oficial da nota para evitar duplicar registos ao re-correr jobs.

---

## 6. Segurança, compliance e auditoria

- Rotacionar certificados com **procedimento documentado**; auditar quem disparou sincronização e resultado.
- Logs do worker: **sem** PFX em claro; redacção de paths sensíveis em tickets.
- Alinhar retenção de XML/PDF à **política de dados** do produto (LGPD: minimização, base legal, prazo de conservação).

---

## 7. UX / transparência operacional

- Estados visíveis: **Agendado**, **A correr**, **Concluído (N notas)**, **Parcial**, **Falhou** (com mensagem segura para o utilizador).
- Indicador **“Última sincronização”** por empresa monitorada.
- **Feature flag** por organização para fase beta da integração ADN.

---

## 8. Observabilidade

- Métricas: duração do job, contagem de 429/503, taxa de dead-letter, tamanho total ingerido.
- Correlacionar com variáveis de ambiente do worker (`NFSE_DIST_PDF_WORKERS`, `NFSE_DIST_PDF_MAX_ATTEMPTS`).

---

## 9. Critérios de sucesso (briefing)

1. Pelo menos **uma** empresa monitorada em produção interna com XML ingerido e listado no portal (metadados + link seguro para download).
2. Job de sincronização **observável** na UI ou via API de estado.
3. **Nenhum** segredo de certificado em repositório git nem em variáveis `NEXT_PUBLIC_*`.
4. Plano documentado para **PDF** e para **escala** (vários CNPJs) antes de abrir a beta a todos os tenants.

---

## 10. Fora de âmbito deste briefing

- Selecção definitiva de fornecedor cloud para o worker (Azure VM, on-prem, etc.).
- Reimplementação completa do protocolo ADN em Node — apenas mencionada como evolução.
- Substituir o **NFSE_dist** por integração de terceiro (contabilidade / middleware) — alternativa válida em RFP, não prescrita aqui.

---

## 11. Handoff sugerido

- **@pm / PRD:** priorização MVP (XML primeiro), requisitos de UI e política de retenção.
- **@architect / @sm:** story técnica com modelo de dados (`nfse_sync_jobs`, tabela de artefactos/erros), contrato de API interna e políticas Storage/RLS.

---

## 12. Referências

- Repositório de referência: [github.com/RafaelOliveiraCf/NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) (README: requisitos Windows, `curl`, certificados, variáveis de ambiente, dead-letter).
- Produto local: `README.md` (portal, Supabase, multi-tenant).

— Documento derivado do brainstorm Atlas (analyst) / AIOS.
