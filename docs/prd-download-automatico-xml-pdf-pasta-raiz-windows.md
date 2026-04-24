# PRD — Espelho local automático de XML e PDF (pasta raiz Windows)

**Documento:** requisitos de produto para o incremento descrito em `docs/briefing-download-automatico-xml-pdf-pasta-raiz-windows.md`.

**Normativa integrada:**

| Documento | Relação |
| --------- | ------- |
| `docs/prd.md` | **FR6** (estrutura de pastas `{CNPJ}/{código-sistema}`), **FR7** (pasta raiz — aqui **estendido** com persistência servidor + worker), **FR8** (pairing do agente — fase 2 deste PRD). |
| `docs/prd-integracao-nfse-dist-adn.md` | **FR41–FR48**, ingestão Storage, jobs ADN; este PRD **não** altera o contrato de ingestão — **acrescenta** espelho em disco quando aplicável. |
| `docs/architecture-integracao-nfse-dist-adn.md` | Worker, Storage, URLs assinadas; espelho em disco é responsabilidade do **processo com filesystem**. |

**Em caso de conflito** entre “o backend não valida o path” (**FR7** do PRD principal, redacção original) e a necessidade de **segurança e multi-tenant** neste incremento, **prevalece este PRD** para o âmbito **espelho local / `local_download_root`** até harmonização numa revisão consolidada do `docs/prd.md`.

**Change log:**

| Data       | Versão | Descrição |
| ---------- | ------ | --------- |
| 2026-04-24 | 1.0    | PRD inicial a partir do briefing: objectivos, FR58–FR63, NFR30–NFR34, fases, UX, épicos, riscos. |

---

## 1. Objetivos de produto

1. Após uma recolha ADN **bem-sucedida** (worker + ingestão ao portal), garantir que **XML e, quando existir, PDF** com a **mesma chave de acesso** fiquem também gravados no disco local na árvore acordada: **`{pasta_raiz}/{CNPJ 14 dígitos}/{código-do-sistema}/{chave_44}.xml|.pdf`**, em **paralelo** com os blobs no Storage (sem substituir **FR44**).
2. Tornar a **pasta raiz** uma preferência **persistida no servidor** por **organização**, visível e editável por perfil autorizado, com **mensagem de produto clara** sobre onde o espelho se aplica (máquina do worker vs agente futuro).
3. Harmonizar a UI de **Configurações** com a fonte de verdade servidor, evitando divergência prolongada entre `localStorage` e Postgres.
4. **Métrica de sucesso (fase 1):** num ambiente de demonstração com worker na mesma VM que o caminho configurado, após job `completed`, ficheiros presentes no disco e metadados no portal; eventos de auditoria quando aplicável.
5. **Métrica de sucesso (fase 2, opcional):** agente local emparelhado (**FR8**) consome URLs assinadas e grava na mesma árvore quando o worker **não** corre no PC de arquivo.

---

## 2. Contexto e problema

O utilizador configura **“Pasta raiz no Windows”** (ex.: `C:\NFs`) nas **Configurações**, mas o valor **só** é guardado em **`localStorage`**. O schema Postgres já prevê `organizations.local_download_root`, **sem** API nem uso no worker. O worker envia bytes ao Storage **sem** copiar para o caminho esperado pelo operador.

**Problema:** expectativa de “o site grava em `C:\NFs`” — o **browser não escreve** em caminhos arbitrários do SO. Sem um processo com filesystem (worker co-localizado ou agente), o requisito de **automação de arquivo local** não se cumpre.

**Solução de produto (fase 1 — MVP do incremento):** persistir `local_download_root`, o worker (ou módulo invocado após ingestão) **lê** a raiz da organização e **copia** os ficheiros já obtidos pelo NFSE_dist / fluxo de upload, mantendo a árvore **FR6**. **Fase 2:** agente local alinhado a **Epic 3** do PRD principal.

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| **Fonte de verdade da raiz** | Coluna **`organizations.local_download_root`** (texto); editável via API por **admin da organização** (mesmo perfil que gere `adn_sync_enabled`, salvo decisão explícita de restringir a superadmin). |
| **Árvore de pastas** | `{root}\{cnpj_digits}\{system_code}\{access_key}.xml` e `.pdf`; `system_code` sanitizado para filesystem (reutilizar regras de **FR6** / especificação técnica). |
| **Momento do espelho** | **Após** bytes estáveis no worker (ficheiros em `data/<CNPJ>/` ou buffers equivalentes) **e** conclusão bem-sucedida do envio ao portal **por nota** ou **em lote ao final do job** — decisão de implementação desde que **paridade XML+PDF** e atomicidade relativa a falhas em disco sejam respeitadas (ver **FR62**). |
| **Falha em disco** | Não marcar o job como **`completed`** sem registo se o espelho for **obrigatório** para a org (flag futura); na **fase 1**, default: espelho **best-effort** com **`summaryJson`** a contar ficheiros espelhados e erros, **ou** estado **`partial`** se a política org assim o definir (ver **FR62**). |
| **Worker na cloud** | Se `local_download_root` apontar para caminho inacessível ao processo, a UI e documentação devem deixar claro que **fase 1** exige worker **na mesma máquina** que o disco; caso contrário, **fase 2 (agente)**. |
| **Feature flag** | Reutilizar **espírito** de **FR45**: espelho só quando `adn_sync_enabled` (ou flag dedicada `adn_local_mirror_enabled` se a equipa quiser granularidade) estiver activa. |

---

## 4. Fora de âmbito (fase 1)

- Instalador MSI do agente local completo (**FR8** em profundidade) — épico separado; este PRD apenas **referencia** a fase 2.
- Validação jurídica de retenção de cópias locais vs apenas cloud.
- Sincronização bidireccional (portal ← disco).
- Encriptação em repouso no disco além das permissões NTFS padrão do cliente.

---

## 5. Personas e fluxos (sumário)

| Persona | Necessidade |
| -------- | ----------- |
| **Admin da organização** | Definir e alterar a pasta raiz no servidor; perceber que o espelho ocorre no **computador onde o worker corre** (fase 1). |
| **Operador fiscal** | Encontrar ficheiros no disco no mesmo padrão que o PRD principal (**FR6**), sem depender só de download manual no browser. |
| **Equipa técnica** | Variável de ambiente opcional para override em dev; logs com contagem de espelhos e erros de I/O. |

**Fluxo feliz (fase 1):** Admin grava raiz `C:\NFs` na API → worker processa job → XML/PDF no Storage **e** em `C:\NFs\<CNPJ>\<system>\*.xml|.pdf` → job `completed` com resumo de contagens.

---

## 6. Requisitos funcionais

Novos identificadores **FR58–FR63** para rastreio. Integração futura no `docs/prd.md` recomendada na próxima revisão consolidada.

| ID | Descrição |
| -- | --------- |
| **FR58** | O sistema deve persistir **`local_download_root`** por **organização** em Postgres (`organizations.local_download_root`), com valor **nullable** (espelho desactivado quando vazio ou política org). |
| **FR59** | Utilizador com **permissão de administração da organização** (alinhado a `adn-sync-settings`) deve poder **ler** e **actualizar** `local_download_root` via API versionada (`GET`/`PATCH` no recurso de definições da organização ou endpoint dedicado documentado). |
| **FR60** | A UI de **Configurações** deve **carregar** a raiz a partir do servidor quando existir sessão e org activa, **pré-preencher** o campo e permitir **Guardar** para o servidor; pode manter `localStorage` como **cache** opcional, mas **após primeiro guardar com sucesso** o servidor prevalece. |
| **FR61** | Quando `local_download_root` estiver definido, o **worker** (fase 1) deve **gravar** no disco, para cada nota processada com sucesso no job, ficheiros com nomes **`{chave_44}.xml`** e **`{chave_44}.pdf`** se o PDF existir, sob **`{root}\{cnpj_digits}\{system_code}\`**, criando pastas conforme necessário. |
| **FR62** | Falhas de escrita em disco devem ser **reflectidas** no resultado do job: pelo menos **`summaryJson`** com contadores `mirrorWritten`, `mirrorFailed` e mensagens não sensíveis; a equipa pode adoptar estado **`partial`** quando houver sucesso Storage mas falha espelho — comportamento exacto fechado em story técnica, desde que **nunca** se reporte `completed` sem indicação clara se o espelho falhou em massa (definição de “massa” = >0% ou limiar configurável no worker). |
| **FR63** | A UI deve exibir **texto de ajuda** (configurações e/ou dashboard) a explicar que a pasta raiz **só é usada no computador onde o serviço de recolha ADN está instalado**; referência ao agente local para outros cenários (fase 2). |

---

## 7. Requisitos não funcionais

| ID | Descrição |
| -- | --------- |
| **NFR30** | **Validação de path:** o servidor deve rejeitar valores absurdamente longos, caracteres de controlo e padrões perigosos (ex.: injecção de comandos em campos de texto); **não** é obrigatório validar existência do disco no servidor. |
| **NFR31** | **Multi-tenant:** `local_download_root` só é legível/escritável na API no âmbito da **organização** da sessão; testes de regressão contra vazamento cross-org. |
| **NFR32** | **Auditoria:** alterações a `local_download_root` geram evento de auditoria (`organization_settings_updated` ou equivalente) com `actor_user_id`, `organization_id`, timestamp e **máscara** do path (ex.: últimos segmentos) se necessário para privacidade em logs. |
| **NFR33** | **Idempotência em disco:** reexecução do mesmo job ou mesma chave **sobrescreve** ficheiros com o mesmo nome sem erro bloqueante; opcional: comparar hash e registar aviso se divergir. |
| **NFR34** | **Observabilidade:** métricas ou logs estruturados no worker — duração da fase de espelho, contagem de ficheiros, erros I/O categorizados (permissão, disco cheio, path inválido). |

---

## 8. UX (alto nível)

- **Configurações — Pasta raiz:** label clara (“Pasta raiz no Windows **(servidor / worker)**” ou equivalente aprovado por UX copy); helper text alinhado a **FR63**; botão **Guardar** que persiste na API; feedback de sucesso/erro.
- **Estado vazio:** se não houver permissão, campo só leitura ou oculto conforme papel.
- **Dashboard / Agente no computador:** alinhar copy existente (`apps/web/src/app/(dashboard)/dashboard/page.tsx`) com **FR63**, referenciando a nova persistência.
- **Erros de path (400):** mensagens legíveis (“caminho demasiado longo”, “caracteres não permitidos”) sem stack trace.

*(Design fino: design system existente; spec UX dedicada opcional.)*

---

## 9. Dependências técnicas

| Item | Acção |
| ---- | ----- |
| **Migração SQL** | Garantir coluna `local_download_root` em **todos** os ambientes; se o ficheiro referido em `docs/qa/adn-staging-setup.md` não existir no repo, criar migração `db/migrations/` com `ADD COLUMN IF NOT EXISTS`. |
| **API org** | Estender `adn-sync-settings` ou criar `organization-local-mirror-settings` — **@architect** define contrato único (evitar dispersão). |
| **Worker** | `workers/nfse-portal-bridge`: após `sync_data_directory` (ou leitura dos paths NFSE_dist), módulo `mirror_to_local_root` com testes unitários onde possível. |
| **Feature flag env** | Opcional `NFSE_LOCAL_MIRROR_DISABLED=1` para desligar espelho em ambientes cloud-only. |

---

## 10. Fases e épicos sugeridos

| Fase | Conteúdo | Épico sugerido |
| ---- | --------- | -------------- |
| **1a** | Migração + API GET/PATCH `local_download_root` + UI guardar + auditoria (**FR58–FR60**, **NFR30–NFR32**). | **LM-01** |
| **1b** | Worker espelha disco (**FR61–FR62**, **NFR33–NFR34**). | **LM-02** |
| **2** | Agente local consome `GET …/artifacts/{id}/download` e grava na árvore; pairing **FR8**. | **LM-03** (Epic 3 PRD principal) |

**Histórias exemplo:**

| ID | Narrativa | Cobre |
| -- | ---------- | ----- |
| **LM-01.1** | Como **admin**, quero **guardar a pasta raiz no servidor**, para **o worker usar o mesmo valor**. | **FR58–FR60** |
| **LM-01.2** | Como **auditor**, quero **registo de alterações** ao caminho. | **NFR32** |
| **LM-02.1** | Como **operador**, quero **ver ficheiros no disco** após sync, para **arquivo local imediato**. | **FR61** |
| **LM-02.2** | Como **suporte**, quero **ver no job** se o espelho falhou. | **FR62**, **NFR34** |

---

## 11. Riscos e mitigações

| Risco | Mitigação |
| ----- | --------- |
| Utilizador confunde **browser** com **escrita local** | **FR63** + onboarding curto. |
| Worker remoto e path local | Documentação + fase 2 agente. |
| Antivírus bloqueia escrita em massa | **FR62** + mensagens acionáveis; documentar exclusões em runbook técnico. |
| Conflito com redacção **FR7** original | Harmonizar `docs/prd.md` na próxima revisão (“metadados no pairing” **e** raiz persistida para worker). |

---

## 12. Critérios de aceitação globais (DoD do incremento)

1. Admin consegue persistir e reler `local_download_root` sem comandos SQL manuais.
2. Com worker na mesma VM e raiz válida, após job com XML+PDF, ambos existem no disco nos paths definidos.
3. Testes automatizados ou checklist QA para **NFR31** (isolamento org).
4. `docs/qa/adn-staging-setup.md` actualizado com variáveis e ordem de migração.

---

## 13. Referências

- `docs/briefing-download-automatico-xml-pdf-pasta-raiz-windows.md` — briefing fonte.  
- `packages/db/src/schema.ts` — `local_download_root`.  
- `apps/web/src/app/(dashboard)/configuracoes/page.tsx`, `apps/web/src/context/portal-provider.tsx`.  
- `workers/nfse-portal-bridge/poll_jobs.py`, `portal_artifacts.py`.

---

*PRD elaborado no âmbito do pedido de produto; implementação sujeita a ADR técnico e revisão @architect.*

— **Morgan (PM)** — documento para planeamento e execução.
