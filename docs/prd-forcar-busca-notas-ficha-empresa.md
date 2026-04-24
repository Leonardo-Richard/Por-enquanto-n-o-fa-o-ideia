# PRD — Forçar busca de notas na ficha de edição da empresa monitorada

**Documento:** requisitos de produto derivados do project brief `docs/briefing-forcar-busca-notas-ficha-empresa.md`.

**Normativa integrada:**

| Documento | Relação |
| --------- | ------- |
| `docs/prd.md` | **FR17** (edição na ficha), **FR6**–**FR8** (estrutura local, pasta raiz, agente), **FR15** (estado de execução visível na web). |
| `docs/prd-empresas-monitoradas-editar-e-forcar-automacao.md` | **FR54** / fluxo **`POST .../adn/sync`** como disparo canónico; este PRD **aprofunda a ficha** sem contradizer a lista. |
| `docs/prd-download-automatico-xml-pdf-pasta-raiz-windows.md` | **FR58–FR63**, **NFR30–NFR34** (`local_download_root`, worker, espelho em disco); este PRD liga **intenção do utilizador na ficha** a esse modelo. |
| `docs/prd-integracao-nfse-dist-adn.md` | Jobs ADN, ingestão; **sem** alteração do contrato público de sync salvo harmonização explícita. |

**Em caso de conflito** entre “botão que sugere download imediato no PC” e a realidade de que **o browser não grava em caminhos arbitrários**, **prevalece a transparência**: copy e estados devem reflectir **enfileiramento + processo com filesystem** conforme `docs/prd-download-automatico-xml-pdf-pasta-raiz-windows.md`.

**Change log:**

| Data       | Versão | Descrição |
| ---------- | ------ | --------- |
| 2026-04-24 | 1.0    | PRD inicial a partir do briefing: objectivos, decisões fechadas, **FR64–FR68**, **NFR35–NFR38**, épico **BNF-01**. |

---

## 1. Objetivos de produto

1. Na ficha **`/empresas/[id]`**, oferecer um **CTA explícito** orientado a negócio (**“Buscar notas agora”** / redacção final em PT-BR) que o utilizador associe a **obter notas** e à **gravação no disco**, quando a cadeia técnica (job + worker/agente) estiver disponível.
2. **Reutilizar** o mesmo fluxo de enfileiramento **ADN** já existente (`POST /api/v1/organizations/{organizationId}/monitored-companies/{companyId}/adn/sync`) no **MVP deste incremento**, evitando segundo pipeline ou ZIP no browser **salvo** épico futuro explícito.
3. Exibir **contexto da pasta raiz** da organização (`localDownloadRoot`): estado “definida / não definida” e **texto de ajuda** que distingue **pedido na web** de **escrita no disco** (worker na mesma máquina que o path ou agente — alinhado a **FR63** e ao briefing de download).
4. **Métrica de sucesso (qualitativa):** utilizadores com permissão reportam que sabem **onde** os ficheiros devem aparecer e **que** o clique enfileira trabalho; redução de suporte do tipo “cliquei e não apareceu nada em `C:\`” sem raiz configurada.

---

## 2. Contexto e problema

- O painel **Sincronização ADN** (`adn-sync-panel.tsx`) já expõe ação de **pedir sync** com linguagem técnica (“sincronização ADN”, “fila no portal”).
- A **persistência local** depende de **`local_download_root`** e de processo fora do browser (**FR58–FR61**); o utilizador na ficha **não** vê necessariamente o vínculo entre “sync” e “pasta no meu computador”.
- **Risco:** expectativa de **download instantâneo via browser** para o path configurado — **fora** do modelo actual.

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| **Semântica do novo botão** | **MVP:** mesmo **`POST .../adn/sync`** que `useAdnSyncForCompany` / `AdnSyncPanel`. Pode coexistir com o botão actual de “Pedir sincronização ADN” na **primeira entrega** (dois CTAs) **ou** substituir o primário por copy orientada a “notas” — decisão de UX na story, desde que **um** fluxo óbvio exista e **FR64** seja cumprido. **Pipeline alternativo** (ZIP, só listagem) **fora** deste PRD. |
| **`local_download_root` vazio** | **Não bloquear** o `POST` por omissão (a recolha cloud/Storage mantém valor). A UI deve mostrar **aviso persistente** na secção de notas/automação: raiz **não configurada**; link ou instrução para **Configurações** onde **FR59–FR60** aplicam. Opcional: segunda frase “os ficheiros podem não ser espelhados no disco até definir a pasta raiz”. |
| **`local_download_root` definida** | Mostrar **indicador positivo** (ex.: “Pasta raiz configurada para esta organização”) **sem** exibir o path completo em ecrãs partilhados se **@qa** / privacidade recomendarem mascaramento (últimos segmentos apenas); se política for path completo só para admin, documentar na story. |
| **Papéis e autorização** | **Paridade** com `AdnSyncPanel`: só quem pode **`postAdnSyncRequest`** vê o CTA **activo**; outros — controlo desactivado ou oculto + **mensagem curta** (reutilizar ou factorizar strings). |
| **Confirmação pré-disparo** | **Manter** `window.confirm` na **primeira versão** para paridade com o hook actual; evolução para modal acessível = melhoria, acordada com **@qa**. |
| **Feedback pós-202** | Mensagem de sucesso deve menciar **fila** e, quando aplicável, que os ficheiros aparecem na **árvore local** após o job/processamento, **sujeito** a raiz configurada e a worker/agente conforme arquitectura. |
| **Feature ADN indisponível** | Mesmo tratamento que **FR55** / estados `feature_off` na ficha: **sem** CTA que sugira sucesso imediato. |

---

## 4. Fora de âmbito

- Novo endpoint de “forçar busca” distinto do sync ADN **sem** ADR ou épico separado.
- Alterar **FR6** (layout de pastas), **FR61** (momento exacto do espelho no worker), ou o mock `runSync` do `PortalProvider` (ver briefing de empresas monitoradas).
- Instalador ou pairing completo do agente local (**FR8** em profundidade).

---

## 5. Requisitos funcionais (incremento)

Novos identificadores **FR64–FR68** para rastreio. Recomenda-se integração futura em `docs/prd.md` numa revisão consolidada.

| ID | Descrição |
| -- | ----------- |
| **FR64** | Na ficha **`/empresas/{id}`**, a secção de automação de notas / ADN deve incluir um controlo **«Buscar notas agora»** (rótulo ajustável em copy final) que, quando a funcionalidade ADN estiver **activa** e o utilizador **autorizado**, execute **`POST /api/v1/organizations/{organizationId}/monitored-companies/{companyId}/adn/sync`** com o mesmo contrato que `postAdnSyncRequest` (incl. **Idempotency-Key**), tratando **202**, **403** e **429** de forma **coerente** com o painel ADN existente. |
| **FR65** | Quando **`local_download_root`** da organização estiver **ausente ou normalizado vazio**, a mesma secção deve apresentar **aviso visível** (não só toast) a explicar que o **espelho em disco** pode não ocorrer até configurar a pasta raiz em **Configurações**, **sem** impedir o pedido de sync salvo decisão técnica futura documentada noutro PRD. |
| **FR66** | Quando **`local_download_root`** estiver **definida**, a UI deve indicar que a organização tem **pasta raiz configurada** para espelho local, com nível de detalhe do path conforme regras de privacidade acordadas (mínimo: estado booleano + link para editar em Configurações). |
| **FR67** | A secção deve conter **texto de ajuda curto** (1–3 frases) que distinga: (a) o pedido feito **no browser** enfileira um **job**; (b) os ficheiros no **disco local** dependem da **raiz configurada** e do **worker/agente** alinhados a `docs/prd-download-automatico-xml-pdf-pasta-raiz-windows.md`. |
| **FR68** | **Acessibilidade:** o novo controlo deve ter **`aria-label`** ou rótulo visível **distinto** de “Actualizar estado” / outros botões da secção; durante o pedido, o controlo deve reflectir estado **ocupado** (`busy` / `aria-busy`) de forma coerente com o resto da ficha. |

---

## 6. Requisitos não funcionais (incremento)

| ID | Descrição |
| -- | ----------- |
| **NFR35** | **Manutenibilidade:** reutilizar **`useAdnSyncForCompany`** ou extrair módulo partilhado para o novo CTA e o botão existente, **evitando** duplicação de `fetch`, headers, parsing de erros e intervalos de polling. |
| **NFR36** | **Consistência:** mensagens em **PT-BR**; alinhamento de strings de erro/sucesso com `AdnSyncPanel` / hook, salvo harmonização única no PR. |
| **NFR37** | **Rate limit:** sem retries agressivos em **429**; respeitar **Retry-After** quando existir, como na implementação actual. |
| **NFR38** | **Multi-tenant:** qualquer leitura de `local_download_root` para a UI deve usar apenas a **organização** da empresa em contexto e APIs já autorizadas (sem vazamento cross-org). |

---

## 7. UX (sumário)

| Elemento | Comportamento alvo |
| --------- | ------------------- |
| CTA principal de “notas” | Linguagem de **valor** (buscar / descarregar notas), não só “ADN”. |
| Raiz não configurada | **Banner** ou bloco informativo **antes** ou **junto** ao CTA. |
| Raiz configurada | **Reforço positivo** + link “Alterar em Configurações”. |
| Após sucesso | Copy honesta: fila + disco **assíncrono** / dependente do job. |

---

## 8. Épico e histórias (para @sm / @dev)

### Épico **BNF-01** — Ficha empresa: forçar busca de notas com contexto de pasta local

**Objetivo:** Na edição da empresa monitorada, o utilizador autorizado **força** a mesma recolha ADN já suportada, com **visibilidade** da **pasta raiz** da organização e **expectativas correctas** sobre ficheiros no disco.

| ID | História (resumo) | Critérios de aceite (mínimos) |
| -- | ----------------- | ------------------------------ |
| **BNF-01.1** | Como **admin da organização**, quero **«Buscar notas agora»** na ficha da empresa, para **disparar a recolha sem esperar pelo agendamento**. | **FR64**; 202/403/429 alinhados ao painel ADN. |
| **BNF-01.2** | Como **operador**, quero **ver se a pasta raiz está configurada**, para **saber se devo esperar ficheiros no disco**. | **FR65**, **FR66**; link ou navegação para Configurações. |
| **BNF-01.3** | Como **utilizador**, quero **texto que explique browser vs disco**, para **não assumir download directo pelo site**. | **FR67**; revisão de copy com **@po**. |
| **BNF-01.4** | Como **utilizador de tecnologias assistivas**, quero **rótulos e estado de carregamento claros** no novo botão. | **FR68**. |
| **BNF-01.5** | Como **equipa de qualidade**, quero **zero regressão** na edição da empresa e no painel ADN existente. | **FR17** + testes manuais/e2e mínimos na ficha. |

---

## 9. Riscos e dependências

| Risco | Mitigação |
| ----- | ---------- |
| Duplicação de dois botões “iguais” confunde | Story pode optar por **um** CTA final renomeado; PRD permite fase de transição com copy distinta. |
| Utilizador sem raiz espera ficheiros no PC | **FR65** + **FR67** obrigatórios; métrica de suporte. |
| Divergência de dados `local_download_root` na ficha vs Configurações | Reutilizar mesma API **`GET .../organization-adn-sync-settings`** (ou recurso canónico) com cache/React Query alinhado à página de configurações. |

---

## 10. Prompts de handoff

**Architect (Aria):**  
“Validar se a ficha `/empresas/[id]` deve obter `localDownloadRoot` via `GET organization-adn-sync-settings` existente ou props em `GET company`; garantir que **NFR38** é cumprida e que não há N+1 desnecessário.”

**UX / PO:**  
“Fechar rótulo final (Buscar notas agora vs Sincronizar agora), mascaramento do path, e se o CTA antigo ADN é removido ou coexistente na v1.”

**QA:**  
“Matriz: ADN off, 403, 429, raiz vazia, raiz definida, busy duplo clique, leitor de ecrã no novo botão.”

---

## 11. Próximos passos

1. **@sm:** partir **BNF-01.1–BNF-01.5** em stories com tarefas técnicas.  
2. **@dev:** implementação em `empresas/[id]/page.tsx` e/ou `adn-sync-panel.tsx` conforme story.  
3. Revisão consolidada de IDs **FR64+** em `docs/prd.md` quando a equipa fizer merge normativo.
