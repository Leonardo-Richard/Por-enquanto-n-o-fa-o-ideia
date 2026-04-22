# PRD — Integração: recolha NFS-e via ADN (worker + portal)

**Documento:** requisitos de produto para o incremento descrito em `docs/briefing-integracao-nfse-dist-adn.md`, alinhado ao **PRD principal** (`docs/prd.md`), ao modelo **organização / empresas monitoradas** (`docs/prd-atualizacao-dois-niveis-organizacao-vs-empresas-fiscais.md`, **FR33–FR40**) e às regras de **sessão e ACL** (`docs/prd-atualizacao-login-empresas-roles.md`, **FR19–FR32**) onde aplicável.

**Referência técnica externa:** [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) — cliente Python em Windows (`curl.exe` / Schannel), certificado e-CNPJ (loja Windows ou PFX), distribuição DF-e (XML) e DANFSE (PDF), dead-letter e variáveis de paralelismo.

**Em caso de conflito** entre “coleta genérica” do PRD principal e este documento sobre **origem ADN / worker / certificado**, **prevalece este PRD** para o âmbito da integração ADN até harmonização numa versão consolidada do `docs/prd.md`.

**Change log:**

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-22 | 1.0    | PRD inicial: objetivos, FR41–FR48, NFR19–NFR23, UX, épicos sugeridos, riscos. |

---

## 1. Objetivos de produto

1. Permitir que **empresas monitoradas** (CNPJ no âmbito da **organização** ativa) tenham **notas fiscais eletrónicas de serviço** recolhidas a partir do **Ambiente Nacional (ADN)** — distribuição DF-e (XML) como **MVP**, com caminho claro para DANFSE (PDF).
2. Garantir que o utilizador do portal **nunca** manipule certificado e-CNPJ no browser; toda a criptografia cliente–ADN ocorre num **worker** sob controlo da infraestrutura.
3. Oferecer **transparência operacional**: estados de sincronização, última execução bem-sucedida, falhas parciais e possibilidade de **reprocessar** falhas administráveis (conforme papel).
4. Manter **isolamento multi-tenant**: artefactos, metadados e jobs são sempre rastreáveis a **`organization_id`** + **empresa monitorada** (alinhado a **FR37**).
5. **Métrica de sucesso (MVP):** pelo menos uma empresa monitorada em ambiente controlado com **XML ingerido**, **listagem no portal** (metadados + acesso seguro ao ficheiro) e **job observável** (UI ou API), sem segredos de certificado em git ou `NEXT_PUBLIC_*`.

---

## 2. Contexto e problema

O portal já prevê **jobs de coleta** e cadastro fiscal (**FR9**, **FR10**, **FR36**). A ligação concreta ao **ADN** exige um ambiente com **mTLS** compatível com a stack de referência (Windows + Schannel no repositório **NFSE_dist**). Executar isso dentro do **runtime serverless** típico do Next.js em cloud **não** é premissa segura sem worker dedicado.

**Problema:** utilizadores esperam “o site busca as minhas NFS-e”; sem um desenho explícito, há risco de (a) expor certificados, (b) violar limites do ADN (**429/503**), (c) misturar blobs entre organizações.

**Solução de produto (MVP):** **worker assíncrono** (evolução do **NFSE_dist** ou invólucro) + **portal** (API, Postgres, Storage, UI) como sistema distribuído com contrato claro e **feature flag** por organização.

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| **MVP de artefactos** | Entregar primeiro **XML (DF-e)** estável; **PDF (DANFSE)** em fase 1b (on-demand por nota ou paralelismo muito baixo), com plano escrito antes de beta ampla. |
| **Certificado** | Apenas em **cofre / worker**; rotação e instalação documentadas; **proibido** em variáveis públicas ou repositório. |
| **Worker** | **Windows** na fase inicial (paridade com **NFSE_dist**); evolução Linux/container fica como épico opcional, sem bloquear MVP. |
| **Ingestão** | Worker envia **metadados + hashes + referência de storage** ao portal (ou usa **URL assinada** para upload directo a Storage); detalhe de protocolo em story técnica (**@architect**). |
| **Idempotência** | Identificador oficial da nota (ex.: chave de acesso) + hash do conteúdo evitam duplicar linhas ao reexecutar jobs. |
| **Beta** | **Feature flag** por **organização** até critérios de escala e PDF cumpridos (**briefing** secção 9.4). |
| **Dead-letter** | Falhas persistentes da pipeline de PDF (e equivalentes XML, se aplicável) devem ser **visíveis** ao gestor com acção **Reprocessar** (quando tecnicamente válido). |

---

## 4. Fora de âmbito (confirmado)

- Escolha final de **fornecedor** da VM Windows (Azure, on-prem, etc.) — documento assume “worker dedicado”.
- **Reimplementação completa** do protocolo ADN em Node/TypeScript.
- Substituição do **NFSE_dist** por **ERP de terceiros** como fornecedor primário — fora do MVP; pode constar de RFP futura.
- Definição jurídica final de **base legal LGPD** e prazos de retenção — o PRD exige **política documentada** e campos de retenção configuráveis onde já exista padrão no produto; detalhe legal fica com stakeholders.

---

## 5. Personas e fluxos (sumário)

| Persona | Necessidade |
| -------- | ----------- |
| **Operador fiscal** | Ver que a sincronização correu, quantas notas entraram, aceder ao XML/PDF permitido. |
| **Admin da organização** | Disparar ou agendar sincronização (conforme política), ver erros, solicitar reprocessamento, **sem** ver segredos de certificado. |
| **Superadmin / suporte** | Diagnosticar falhas de worker ou ADN com logs redigidos; não contornar ACL de organização para dados fiscais sem trilho de auditoria já definido no produto. |

**Fluxo feliz (MVP):** Admin activa beta para a org → associa credenciais de worker no backoffice operacional (fora do âmbito UI pública se assim decidir arquitetura) → worker corre com `clients.json` derivado das empresas monitoradas → XML guardado em Storage com prefixo tenant → portal lista notas e estado **Concluído**.

---

## 6. Requisitos funcionais (incremento ADN)

Novos identificadores **FR41–FR48** (integração futura no `docs/prd.md` recomendada na próxima revisão major).

| ID | Descrição |
| -- | ----------- |
| **FR41** | O sistema deve suportar **job de sincronização ADN** por **empresa monitorada**, com estados mínimos: **Agendado**, **A correr**, **Concluído**, **Parcial**, **Falhou**; cada transição deve ser persistida com timestamp. |
| **FR42** | Para cada empresa monitorada elegível, a UI ou API deve expor **“Última sincronização ADN”** (data/hora e resultado agregado: p. ex. N XML ingeridos). |
| **FR43** | O portal deve **persistir metadados** por nota recolhida (incluindo identificador único da NFS-e / chave de acesso e ligação à empresa monitorada e organização), permitindo **listagem** filtrada por empresa e intervalo de datas. |
| **FR44** | O utilizador com permissão adequada deve conseguir **descarregar** o XML (e, na fase 1b, PDF) através de **URL segura** (ex.: assinada, TTL curto) ou mecanismo equivalente aprovado na arquitetura — **sem** servir ficheiros privados de bucket com ACL pública aberta. |
| **FR45** | **Feature flag** por **organização**: enquanto desactivada, utilizadores não veem fluxos ADN nem endpoints de domínio correspondentes (**404** ou **403** conforme política de ocultação já usada no produto). |
| **FR46** | **Reprocessar:** a partir de registos de falha administráveis (equivalente ao dead-letter do worker), o Admin deve poder **reenfileirar** reprocessamento **por nota** ou **por lote**, sem duplicar registos de sucesso (**FR41** + idempotência). |
| **FR47** | **Auditoria:** eventos `adn_sync_started`, `adn_sync_completed`, `adn_sync_failed`, `adn_artifact_downloaded` (nomes exemplificativos) devem incluir `actor_user_id`, `organization_id`, empresa monitorada, **job_id**, timestamp — alinhado ao espírito de **FR37** / **NFR4**. |
| **FR48** | O sistema deve permitir **exportar / gerar** a lista de CNPJs e nomes necessários ao worker (**clients.json** conceptual) a partir das **empresas monitoradas** da organização, **sem** incluir segredos de certificado no export. |

---

## 7. Requisitos não funcionais (incremento ADN)

| ID | Descrição |
| -- | ----------- |
| **NFR19** | **Segredo de certificado:** armazenamento apenas em cofre adequado ao worker; rotação sem downtime prolongado documentado; **proibido** `NEXT_PUBLIC_*` ou commits com PFX/thumbprints reais. |
| **NFR20** | **Autenticação worker ↔ portal:** mTLS interna, token de serviço rotativo ou HMAC com segredo servidor — **obrigatório** antes de produção; não aceitar ingestão anónima. |
| **NFR21** | **Limitação de taxa:** o desenho deve respeitar limites do ADN; configurável (análogo a `NFSE_DIST_PDF_WORKERS` / retries); UI comunica **atrasos** e **429** de forma não técnica. |
| **NFR22** | **Observabilidade:** métricas mínimas — duração de job, contagem 429/503, taxa de dead-letter, bytes ingeridos; correlacionáveis a `organization_id` e empresa monitorada. |
| **NFR23** | **LGPD / dados:** política de **retenção** e eliminação de blobs documentada; minimização — não duplicar XML em múltiplos buckets sem justificação. |

---

## 8. UX (alto nível)

- **Empresa monitorada — detalhe:** secção **“Sincronização ADN”** com estado actual, última execução, botão **“Sincronizar agora”** (se permitido por papel e flag), link para **lista de notas** recolhidas.
- **Lista de notas:** colunas sugeridas — data de emissão, número / chave resumida, tipo (XML/PDF), estado de download; acções: ver metadados, descarregar.
- **Erros:** lista de falhas com mensagem **segura** (sem stack trace); acção **Reprocessar** quando aplicável.
- **Estados de carga:** alinhado a **NFR13** (spinner/skeleton, erro recuperável).

*(Design fino: `docs/front-end-spec.md` e tokens do design system.)*

---

## 9. Dependências e harmonização

| Documento | Relação |
| --------- | ------- |
| `docs/briefing-integracao-nfse-dist-adn.md` | Fonte de briefing; âmbito e critérios de sucesso alinhados. |
| `docs/prd.md` | **FR9**, **FR10**, **FR36** — jobs de coleta e vínculo à empresa monitorada; este PRD **especializa** a origem ADN e o worker. |
| `docs/prd-atualizacao-dois-niveis-organizacao-vs-empresas-fiscais.md` | **FR33–FR40** — todo artefacto ADN pertence à cadeia **organização → empresa monitorada**. |
| `docs/architecture.md` | Actualizar após desenho de Storage/RLS e rotas internas. |

---

## 10. Critérios de aceite globais (incremento)

1. **MVP XML:** pelo menos um fluxo e2e demonstrável: worker → ingestão → registo em BD → listagem na UI com download seguro.  
2. **Segurança:** revisão de secrets (sem certificado em git; worker autenticado).  
3. **Multi-tenant:** utilizador sem acesso à org A **não** lista nem descarrega artefactos da org A (**teste de integração** alinhado a **NFR18**).  
4. **Observabilidade:** dashboard interno ou métricas mínimas exportáveis (**NFR22**).  
5. **Documentação:** operadores têm runbook (reduzir workers em caso de 429, onde ver dead-letter).  
6. **Fase 1b PDF:** documento de “go” assinado antes de activar PDF em massa para todas as orgs com flag.

---

## 11. Riscos e mitigações

| Risco | Mitigação |
| ----- | ---------- |
| ADN indisponível ou agressivo em 429 | MVP XML primeiro; backoff; mensagens claras; métricas **NFR22**. |
| Vazamento de certificado | Revisão de segurança obrigatória; **NFR19**; auditoria. |
| Custos de Storage | Política de retenção; compressão/arquivamento (épico futuro). |
| Complexidade operacional Windows | Runbook; monitorização do worker; caminho documentado para Linux pós-MVP. |

---

## 12. Épicos e histórias sugeridas (para @sm / @architect)

1. **Schema:** `adn_sync_jobs`, tabela de **artefactos / notas**, tabela de **erros / dead-letter** mapeada à UI — migração + índices.  
2. **API interna:** ingestão autenticada worker → portal; idempotência; OpenAPI parcial em `docs/api/`.  
3. **Storage:** bucket/prefixos por tenant; RLS ou camada servidor única; URLs assinadas.  
4. **Worker:** empacotamento do **NFSE_dist** + geração de `clients.json` a partir de API do portal; agendamento.  
5. **UI:** secção sincronização + lista + download + erros + reprocessar.  
6. **Feature flag** por organização + seeds para QA.  
7. **Observabilidade** e alertas mínimos.  
8. **Fase PDF:** limites, on-demand, testes de carga reduzida.

---

## 13. Próximos passos de produto

1. Validar com stakeholders **retenção de dados** e texto legal curto para definições de conta.  
2. Priorizar épicos 1–5 para o primeiro sprint de integração.  
3. Após implementação, abrir PR para referenciar este ficheiro em `docs/prd.md` (tabela de incrementos).

— **Morgan (PM) / AIOS** — documento derivado do briefing `docs/briefing-integracao-nfse-dist-adn.md`.
