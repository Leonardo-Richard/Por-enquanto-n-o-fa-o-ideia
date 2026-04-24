# Briefing — Download automático de XML e PDF na pasta raiz configurada no site

**Data:** 2026-04-24  
**Pedido:** Após a recolha ADN, gravar automaticamente **XML e PDF** no caminho definido em **Configurações** (ex.: `C:\NFs`), com árvore **`{CNPJ}\{código-do-sistema}\`**, em paralelo ao que já existe no portal (Storage + metadados).

**Normativa de produto:** `docs/prd.md` (FR7 pasta raiz no cliente local, FR8 pairing), Epic 3 — agente desktop; arquitectura ADN: `docs/architecture-integracao-nfse-dist-adn.md` (download via URL assinada no portal).

---

## 1. Contexto e restrição técnica

| Camada | Papel |
|--------|--------|
| **Site (browser)** | Orquestra cadastro, fila ADN e preferências de UI; **não pode** escrever em `C:\NFs` nem em caminhos arbitrários do disco do utilizador. |
| **Portal (API + Storage)** | Hoje: bytes em bucket privado; `GET …/adn/artifacts/{id}/download` devolve **URL assinada** para o browser ou outro cliente. |
| **Worker NFSE** (`workers/nfse-portal-bridge` + NFSE_dist) | Corre na **VM Windows** com certificado; baixa para `third_party/NFSE_dist/data/<CNPJ>/…` e envia ao portal. |

**Conclusão:** “Baixar automaticamente no caminho configurado no site” implica **um processo com capacidade de escrita em disco** (worker na mesma máquina do caminho, ou **agente local** emparelhado — alinhado ao PRD), não apenas a página web.

---

## 2. Estado actual (gap)

1. **Configurações — “Pasta raiz no Windows”** (`apps/web/src/app/(dashboard)/configuracoes/page.tsx`): o valor é guardado via `usePortal().updateSettings` → **`localStorage`** (`apps/web/src/context/portal-provider.tsx`). **Não** é persistido em `organizations.local_download_root` (Postgres).
2. **Schema:** `organizations.local_download_root` já existe em `packages/db/src/schema.ts` (comentário: espelho `{root}/{CNPJ}/{system_code}/{chave}.xml|.pdf`), mas **não há** API pública/admin que a preencha nem leitura no worker.
3. **Worker:** após `run_download_workflow`, o fluxo actual envia ficheiros ao portal (`prepare` → PUT → `commit`); **não** copia para `C:\NFs\…`.
4. **UI de artefactos:** listagem/download no browser pode ser acrescentada (histórico); isso resolve “descarregar pelo site”, **não** o espelho automático em disco sem agente/worker.

---

## 3. Visão alvo (comportamento desejado)

1. O utilizador define a **pasta raiz** (ex.: `C:\NFs`) num sítio **fonte de verdade** partilhada entre portal e máquina que grava ficheiros (recomendado: **coluna na organização**, com validação mínima e audit log).
2. Após cada nota (par **XML + PDF** com a mesma chave de acesso, quando existir PDF):
   - os bytes continuam a ser ingeridos no Storage (rastreio, ACL, re-download); **e**
   - **em paralelo**, o processo autorizado grava:
     - `{local_download_root}\{cnpj_digits}\{system_code}\{chave_44}.xml`
     - `{local_download_root}\{cnpj_digits}\{system_code}\{chave_44}.pdf` (se houver PDF).
3. **Idempotência:** reprocessamento do mesmo job não deve corromper ficheiros (sobrescrever com o mesmo conteúdo é aceitável; detectar divergência de hash opcional).
4. **Fuso / agendamento:** o campo “Fuso horário (agendamento dia 1º)” na UI continua orientado a **agendamento**; o espelho em disco deve seguir o **mesmo gatilho** que dispara a recolha (job `completed` / evento interno), não um relógio separado no browser.

---

## 4. Opções de implementação (escolha de arquitectura)

### Opção A — Espelho no **mesmo** processo que corre o NFSE_dist (rápida para MVP técnico)

- **Onde:** `workers/nfse-portal-bridge` (ou script chamado ao final de `process_one_job`), após `sync_data_directory` ou lendo os ficheiros já presentes em `data/<CNPJ>/`.
- **Config:** ler `organizations.local_download_root` por `organization_id` (e fallback `NFSE_LOCAL_MIRROR_ROOT` em env só dev).
- **Pré-requisito:** o caminho configurado no site tem de ser **o mesmo sistema de ficheiros** onde o worker corre (tipicamente o PC da contabilidade com certificado).
- **Trabalho de produto:** PATCH em `…/organizations/{id}/…` (admin) para persistir a raiz; migrar valor do `localStorage` uma vez (opcional) ou formulário “Guardar no servidor”.

**Prós:** Poucos componentes; XML+PDF “ao mesmo tempo” que o upload ao Storage.  
**Contras:** O caminho mostrado no site só é útil se o utilizador perceber que **só aplica onde o worker está instalado**; não substitui o agente leve em máquinas sem worker.

### Opção B — **Agente local** (alinhado ao PRD / Epic 3)

- Agente em Windows (serviço ou app em segundo plano) com **pairing** (FR8), lê a raiz da **config local** ou sincronizada do servidor.
- Ciclo: após job `completed` (ou polling de `adn_artifacts`), o agente chama `GET …/download` para XML e PDF e grava na árvore `CNPJ\código-do-sistema`.

**Prós:** Caminho “no site” pode ser a **preferência persistida no servidor** que o agente puxa ao iniciar; separa certificado/worker pesado de máquinas só de arquivo.  
**Contras:** Mais entrega (instalador, updates, segurança).

### Opção C — Híbrido (recomendado como **roadmap**)

- **Fase 1:** Opção A + persistência `local_download_root` na API + documentação clara na UI (“aplica-se ao computador onde o worker de recolha está instalado”).
- **Fase 2:** Agente local (Opção B) para utilizadores sem worker no mesmo PC que a pasta de arquivo.

---

## 5. Critérios de aceitação sugeridos (DoD)

1. **Persistência:** Administrador da organização consegue definir `local_download_root` no servidor e consultá-la (sem expor a outros tenants).
2. **Paridade XML+PDF:** Para cada chave com PDF no worker, existem dois ficheiros no disco no destino; só XML quando o PDF falhar (dead-letter upstream), com registo no `summaryJson` do job.
3. **Árvore de pastas:** `{root}\{cnpj_digits}\{system_code}\` criada com permissões seguras; nomes de ficheiro = chave de acesso (44 caracteres) + extensão.
4. **Falhas:** Falha ao escrever disco não deve marcar o job como `completed` sem registo; preferir `partial` ou `failed` com mensagem acionável (disco cheio, caminho inválido, permissão negada).
5. **Segurança:** Não aceitar caminhos UNC arbitrários de outros utilizadores sem política; validar caracteres e comprimento; nunca executar conteúdo dos XML/PDF.

---

## 6. Riscos e decisões em aberto

| Risco | Mitigação |
|-------|-----------|
| Utilizador espera que o **browser** sozinho escreva em `C:\NFs` | Texto de UX explícito + doc; considerar renomear label se a fonte de verdade for servidor. |
| Worker na **cloud** e pasta **local** do utilizador | Opção B obrigatória; Opção A inviável. |
| `localStorage` vs servidor divergentes | Migração única ou “Sincronizar com servidor” na primeira utilização. |
| Migração SQL referida em `docs/qa/adn-staging-setup.md` para `local_download_root` | Confirmar se a coluna já foi aplicada em todos os ambientes; gerar migração em `db/migrations/` se ainda não existir no repositório. |

---

## 7. Referências no código

- UI pasta raiz: `apps/web/src/app/(dashboard)/configuracoes/page.tsx`  
- Preferências só cliente: `apps/web/src/context/portal-provider.tsx` (`localRootPath`)  
- Coluna org: `packages/db/src/schema.ts` → `organizations.local_download_root`  
- Ingestão actual: `workers/nfse-portal-bridge/portal_artifacts.py`, `poll_jobs.py`  
- Download autenticado (bytes no browser): `apps/web/src/server/api/v1/handlers/adn-artifact-download.ts`

---

## 8. Próximos passos recomendados (ordem)

1. Confirmar migração Postgres para `local_download_root` e API PATCH/GET nas definições da organização (RBAC admin).  
2. Implementar **Opção A** no worker: cópia espelhada após sucesso de ingestão, com feature flag env.  
3. Actualizar **Configurações** para gravar na API (e opcionalmente manter `localStorage` como cache offline).  
4. Planear **Opção B** em story à parte (Epic 3) se o mercado exigir PC de arquivo ≠ PC do certificado.

---

*Documento de briefing para evolução de produto/engineering; não substitui PRD nem contratos de API finais.*
