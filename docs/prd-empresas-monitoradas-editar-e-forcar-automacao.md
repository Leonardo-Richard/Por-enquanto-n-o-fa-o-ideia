# PRD — Incremento: Empresas monitoradas — edição explícita e execução manual (ADN)

**Documento:** requisitos de produto derivados do project brief `docs/briefing-empresas-monitoradas-editar-e-forcar-automacao.md`.  
**Normativa integrada:** `docs/prd.md` (**FR16**, **FR17** — listagem e edição de empresas), `docs/prd-nav-sidebar-empresas-monitoradas.md` (**FR49–FR52**, **FR51** em especial), `docs/prd-integracao-nfse-dist-adn.md` (quando existir contrato ADN em produção). Em caso de conflito entre **FR51** (referência a “disparo de teste”) e este incremento, **prevalece este PRD** quanto à natureza do disparo (**servidor / ADN** vs simulação local).

**Change log (este incremento):**

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 1.0    | PRD inicial: decisões fechadas sobre ADN vs mock, edição via ficha, layout e acções; **FR53–FR57**, **NFR26–NFR29**; épico **EM-01**. |

---

## 1. Objetivos de produto

1. Tornar **óbvias** na vista **Empresas monitoradas** (rota **`/empresas-monitoradas`**) e no bloco equivalente no **Painel** as acções **editar empresa** e **executar automação agora**, sem depender de uma pill única ambígua.
2. Alinhar **“executar agora”** ao **pedido real** de sincronização **ADN** (`POST /api/v1/organizations/{organizationId}/monitored-companies/{companyId}/adn/sync`), com o mesmo comportamento de autorização, **202**, **403** e **429** já estabelecido na ficha da empresa (`AdnSyncPanel`).
3. Manter **edição canónica** na ficha **`/empresas/[id]`** (reutilização de **FR17** e validações existentes), expondo na lista um **CTA explícito** de edição.
4. **Métrica de sucesso (qualitativa):** operadores reportam que distinguem **edição** de **disparo**; redução de confusão entre “job simulado no browser” e “job enfileirado no portal”.

---

## 2. Contexto e problema (síntese do brief)

- A lista (`MonitoredCompaniesSection`) obtém dados reais via **`GET .../monitored-companies`**, mas cada linha é um **botão** que chama **`runSync`** do **`PortalProvider`** — **simulação** em `localStorage`, **sem** chamada ao backend ADN.
- A **edição** e o **POST ADN** já existem em **`/empresas/[id]`**; a lista **não** os comunica de forma explícita.
- **Risco de produto:** o utilizador acredita que o clique na pill **produz efeito no servidor**, quando em muitos casos apenas anima o estado local de “execuções”.

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| **Significado de “Executar agora” / “Forçar automação”** | **Fluxo ADN único:** `POST .../adn/sync` com corpo e cabeçalhos alinhados ao `AdnSyncPanel` (incl. **Idempotency-Key**). **Não** utilizar `runSync` do `PortalProvider` como acção primária na lista de empresas monitoradas. |
| **Simulação local (`runSync`)** | **Fora** da lista de monitoradas após este incremento. Se a equipa precisar de **demo offline**, tratar em **épico separado** com flag de ambiente ou secção dedicada em **Configurações** — **não** misturar com a lista fiscal. |
| **Onde editar** | **Navegação** para **`/empresas/{id}`** via botão ou link **«Editar»** (texto ou ícone com `aria-label`). **Sem** modal de edição completa no MVP deste PRD. |
| **Confirmação antes do POST ADN** | **Manter** `window.confirm` (ou equivalente acessível **acordado com @qa** na story) **na primeira versão**, para **paridade** com a ficha da empresa; evolução para toast/undo fica como melhoria pós-MVP. |
| **Papel (admin org)** | **Paridade** com `AdnSyncPanel`: utilizador **sem** permissão de pedir sync ADN deve ver o controlo **desactivado** ou **oculto**, com mensagem curta quando fizer sentido (ex.: tooltip ou texto inline na linha), **sem** erro silencioso após clique. |
| **Feature ADN desactivada (404)** | Comportamento alinhado ao painel: estado **«funcionalidade indisponível»** ou equivalente **já usado** na ficha; **não** mostrar botão “Executar” que falhe sem contexto. |
| **Layout** | **Uma linha por empresa** (lista semântica `<ul>` ou **tabela** responsiva): colunas mínimas **identificação** (nome comercial e/ou código sistema + CNPJ mascarado), **acções** (Editar, Executar agora). Coluna **estado do último job** é **opcional** no MVP se o `GET .../adn/sync` já for reutilizado sem custo excessivo; caso contrário, **fase 1.1**. |

---

## 4. Fora de âmbito

- Novo modelo de dados ou migrações SQL para “empresa monitorada” (continua a ser a entidade **company** na organização).
- Alterar o contrato público do **POST/GET** ADN (salvo bugfix acordado com arquitectura).
- Substituir totalmente o **`PortalProvider`** / histórico local de “execuções” no Painel (pode coexistir para outras demos até remoção futura).
- Modal de edição inline, bulk actions, ou reordenação de lista.

---

## 5. Requisitos funcionais (incremento)

Novos identificadores para rastreio (**FR53–FR57**). Integração futura no `docs/prd.md` recomendada na próxima revisão consolidada.

| ID | Descrição |
| -- | ----------- |
| **FR53** | Na vista **`/empresas-monitoradas`** e no bloco **Empresas monitoradas** do Painel (mesmo componente ou paridade explícita documentada), **cada** empresa listada deve apresentar uma acção **«Editar»** (ou equivalente acessível) que navegue para **`/empresas/{id}`** da mesma empresa. |
| **FR54** | Cada empresa listada deve apresentar uma acção **«Executar agora»** / **«Sincronizar ADN»** (rótulo alinhado à copy da ficha) que, quando a funcionalidade ADN estiver **activa** e o utilizador **autorizado**, execute **`POST .../monitored-companies/{companyId}/adn/sync`** e trate **202**, **403** e **429** de forma **coerente** com `AdnSyncPanel`. |
| **FR55** | Quando a funcionalidade ADN não estiver disponível (**404** ou estado `feature_off` equivalente), a UI **não** deve oferecer botão de execução que sugira sucesso; deve reflectir o mesmo padrão informativo usado na ficha da empresa. |
| **FR56** | A listagem continua a ser alimentada por **`GET .../monitored-companies`** com paginação, pesquisa e tratamento de erro de rede **inalterados** em comportamento observável (mensagens, retry, estado vazio com **«Nova empresa monitorada»** → `/empresas/nova`). |
| **FR57** | **Acessibilidade:** cada controlo de acção deve ter **rótulo ou `aria-label` próprio**; não usar um único `<button>` envolvendo a linha inteira se existirem múltiplas acções (evitar conflito teclado/rato). |

---

## 6. Requisitos não funcionais (incremento)

| ID | Descrição |
| -- | ----------- |
| **NFR26** | **Manutenibilidade:** a lógica cliente de pedido ADN deve ser **partilhada** entre a ficha e a lista (hook ou módulo comum), evitando duplicação divergente de `fetch`, headers e parsing de erros. |
| **NFR27** | **Consistência de copy:** textos em **PT-BR**; mesmas mensagens de erro/sucesso que a ficha, salvo harmonização explícita no PR. |
| **NFR28** | **Rate limit:** **não** implementar retries automáticos agressivos em 429; respeitar **Retry-After** quando existir, como na ficha. |
| **NFR29** | **Segurança / multi-tenant:** respeitar **organização activa** e regras de sessão já usadas em `handleGetMonitoredCompanies` (sem expor empresas de outra organização). |

---

## 7. Relação com **FR51** (NAV)

**FR51** referia “disparo de sincronização de teste (job mensal) por empresa” em paridade com o Painel. **Após este incremento**, essa paridade significa:

- **Disparo** = enfileiramento **ADN** quando a feature está ligada, com **feedback** alinhado ao servidor;
- **Não** contar o mock `runSync` como cumprimento de intenção de produto para **novas** entregas.

O **histórico local** de execuções no Painel (se ainda existir) pode permanecer **sem** ser alimentado por esta lista, até decisão futura de remoção.

---

## 8. UX (sumário)

| Antes | Depois |
| ----- | ------ |
| Pill “Job mensal · CNPJ” como única superfície clicável, ligada a simulação | Linha clara por empresa com **Editar** e **Executar** (ADN) separados |
| Sem atalho explícito de edição na lista | **Editar** → ficha canónica |
| Risco de interpretação “já sincronizei no servidor” | Copy e estados alinhados ao **job real** (pendente, erro, rate limit) |

---

## 9. Épico e histórias (para @sm / @dev)

### Épico **EM-01** — Lista de empresas monitoradas: acções reais

**Objetivo:** Lista de CNPJs da organização activa com **edição** e **execução ADN** explícitas, sem simulação como caminho principal.

| ID | História (resumo) | Critérios de aceite (mínimos) |
| -- | ----------------- | ------------------------------ |
| **EM-01.1** | Como **operador com org activa**, quero **editar uma empresa a partir da lista**, para **corrigir dados sem procurar noutro ecrã**. | **FR53**; navegação correcta com `company.id`. |
| **EM-01.2** | Como **admin da organização**, quero **pedir sincronização ADN imediata a partir da lista**, para **não ter de abrir a ficha**. | **FR54**, **FR55**; confirmação pré-envio alinhada à ficha. |
| **EM-01.3** | Como **utilizador sem permissão**, quero **ver claramente que não posso disparar**, para **não tentar acções inúteis**. | **FR54** + decisão secção 3 (oculto/desactivado + mensagem). |
| **EM-01.4** | Como **equipa de qualidade**, quero **regressão zero** na listagem e no estado vazio. | **FR56**; teste manual ou e2e mínimo referenciado no PR. |
| **EM-01.5** | Como **utilizador de leitor de ecrã**, quero **rótulos distintos por acção**, para **operar a lista com previsibilidade**. | **FR57**; smoke a11y breve. |

---

## 10. Riscos e dependências

| Risco | Mitigação |
| ----- | ---------- |
| Regressão visual no Painel | Mesmo componente ou PR único com checklist Painel + `/empresas-monitoradas`. |
| Duplicação de lógica ADN | **NFR26** — extrair hook/serviço partilhado com `AdnSyncPanel`. |
| `runSync` ainda referenciado por testes ou demos | Inventário de usos; remover da lista primeiro; documentar no PR se algo ficar temporariamente. |

**Dependências:** rota **`/empresas-monitoradas`** (NAV); API ADN operacional ou feature flag coerente com a ficha.

---

## 11. Próximos passos sugeridos

1. **@po:** `*validate-story-draft` após **@sm** gerar `docs/stories/` para **EM-01**.  
2. **@sm:** `*draft` com tarefas técnicas (refactor `MonitoredCompaniesSection`, hook ADN, QA).  
3. **@dev:** implementar **FR53–FR57**; **@qa:** validar **FR55** / 403 / 429 com utilizadores de perfis distintos.

---

## 12. Referências de código e documentos

- Briefing: `docs/briefing-empresas-monitoradas-editar-e-forcar-automacao.md`
- PRD NAV: `docs/prd-nav-sidebar-empresas-monitoradas.md`
- Componente lista: `apps/web/src/components/monitored-companies-section.tsx`
- Página: `apps/web/src/app/(dashboard)/empresas-monitoradas/page.tsx`
- Hook dados: `apps/web/src/hooks/use-monitored-companies.ts`
- Ficha + PATCH: `apps/web/src/app/(dashboard)/empresas/[id]/page.tsx`
- ADN UI referência: `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`
- Contexto simulação: `apps/web/src/context/portal-provider.tsx` (`runSync`)

---

*PRD elaborado no âmbito AIOS (PM — Morgan), a partir do briefing indicado.*
