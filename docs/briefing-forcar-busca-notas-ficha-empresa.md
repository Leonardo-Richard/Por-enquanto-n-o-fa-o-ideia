# Briefing: forçar busca de notas na ficha de edição da empresa monitorada

**Data:** 2026-04-24  
**Pedido:** Na aba / ecrã de **edição da empresa monitorada**, disponibilizar um botão que **force a busca de notas** na automação e garanta que os ficheiros sejam **gravados no caminho local** configurado no computador (pasta raiz de download da organização).

Este documento é **somente briefing**; não substitui user story, PRD nem especificação de API.

---

## 1. Objetivo de produto

1. O utilizador, estando na ficha de empresa (`/empresas/[id]`, fluxo canónico de edição já existente), deve conseguir **disparar manualmente** um ciclo de busca/sincronização de notas **sem esperar** pelo agendamento mensal ou por outro gatilho implícito.
2. Após (ou durante) esse ciclo, as notas obtidas devem **materializar-se no disco** sob a **raiz de pastas** que a organização definiu para downloads locais (`local_download_root` / `localDownloadRoot` — ver NFR30 e migração `db/migrations/20260427120000_org_local_download_root.sql`).
3. A UX deve deixar claro **o que acontece no browser vs no computador** (enfileiramento no portal / job em backend vs agente ou serviço que escreve ficheiros), para não prometer downloads directos pelo browser se a arquitectura for outra.

---

## 2. Problema / oportunidade

- Hoje o painel **Sincronização ADN** na mesma ficha (`adn-sync-panel.tsx`, hook `useAdnSyncForCompany`) já permite **pedir sincronização ADN** (`POST .../monitored-companies/{companyId}/adn/sync`), com confirmação e feedback de fila.
- A **persistência em pasta local** é um requisito transversal à organização (definição em configurações ADN / `organization-adn-sync-settings`), mas o utilizador pode não associar o botão actual de sync à **descarga física** no caminho indicado.
- Falta um **CTA explícito** alinhado à linguagem de negócio (“buscar / baixar notas agora para a pasta configurada”) e, se aplicável, **garantias de observabilidade** (estado do job, erros de caminho, permissões no agente local).

---

## 3. Contexto técnico (brownfield) — o que já existe

| Área | Referência / comportamento |
|------|----------------------------|
| Ficha de edição da empresa | `apps/web/src/app/(dashboard)/empresas/[id]/page.tsx` — dados via `GET/PATCH /api/v1/companies/{id}`. |
| Sync ADN na ficha | `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx` + `use-adn-sync-for-company.ts` — `fetchAdnSyncStatus` / `postAdnSyncRequest`. |
| Raiz de download local (org) | Coluna `organizations.local_download_root`, API/handlers em `organization-adn-sync-settings.ts`, validação em `lib/local-download-root.ts`. |
| Briefing relacionado | `docs/briefing-empresas-monitoradas-editar-e-forcar-automacao.md` — distinção entre simulação na lista e POST ADN real na ficha. |

**Hipótese de arquitectura a validar com @architect / backend:** o `POST` ADN enfileira trabalho no servidor; a **escrita no disco do utilizador** provavelmente depende de um **componente fora do browser** (agente de secretária, sync client, ou integração OS) que lê o job e usa `localDownloadRoot`. O briefing assume que esse elo existe ou será especificado — **não** prescreve implementação.

---

## 4. Decisões de produto a fechar

1. **Semântica do botão**  
   - É **sinónimo** do “Pedir sincronização ADN agora” actual (mesmo endpoint, copy diferente)?  
   - Ou é um **segundo pipeline** (ex.: só listagem + pacote ZIP no browser)?

2. **Pré-requisitos visíveis na UI**  
   - Bloquear ou avisar se `localDownloadRoot` estiver vazio ou inválido?  
   - Mostrar o caminho configurado (mascarado?) na própria ficha para reforçar destino.

3. **Papéis**  
   - Reutilizar regra actual: só quem pode `postAdnSyncRequest` (ex.: admin org) vê o botão activo; outros veem mensagem explicativa.

4. **Feedback**  
   - Após 202: mensagem que mencione **fila** e **agente/pasta local** (wording honesto face ao que o sistema faz hoje).  
   - Erros comuns: rate limit, feature off, caminho inacessível no cliente (se houver API de estado do agente).

5. **Acessibilidade**  
   - `aria-label` distinto de outros botões da secção; estado `busy` durante o pedido; não depender só de `window.confirm` se a equipa quiser evoluir para modal acessível (opcional neste incremento).

---

## 5. Proposta de experiência (alvo)

- **Colocação:** secção da ficha onde já vive a automação de notas (por exemplo junto a **Sincronização ADN** ou subtítulo “Notas / automação”), com rótulo do tipo **“Buscar notas agora”** ou **“Forçar download para a pasta configurada”** — copy final com `@po`.
- **Fluxo:** um clique → (confirmação, se mantida a convenção actual) → `POST` de sync (ou contrato unificado) → feedback de sucesso/erro → refresh do estado do último job.
- **Transparência:** texto curto a explicar que o ficheiros aparecem em **`localDownloadRoot` da organização** quando o agente/automação concluir o passo local.

---

## 6. Critérios de sucesso (aceitação sugerida)

1. Utilizador com permissão, na ficha `/empresas/{id}`, consegue **forçar** um pedido de busca/sincronização alinhado ao backend real.  
2. Quando a cadeia completa corre, ficheiros de notas **existem** sob a raiz configurada para a org (validação E2E depende do agente/local — documentar no test plan).  
3. Sem permissão ou sem feature: botão **desactivado** ou ausente, com mensagem clara.  
4. Não regressão: edição de empresa (`PATCH` company) e fluxos ADN existentes mantêm comportamento.

---

## 7. Fora de âmbito (para não inflar a story)

- Alterar o formato de pastas por `systemCode` / CNPJ (já documentado noutros sítios) salvo se for pré-requisito do mesmo incremento.  
- Substituir o mock `runSync` do painel de listagem (`portal-provider`) — tratar noutro epic, ver briefing de empresas monitoradas.

---

## 8. Handoffs sugeridos

- **@pm:** user story + critérios de aceitação finais e copy PT-BR.  
- **@architect:** contrato único “forçar busca” vs reutilização do POST ADN; papel do cliente local e fonte de verdade do caminho.  
- **@qa:** matriz de estados (org sem raiz, ADN off, 429, job running).
