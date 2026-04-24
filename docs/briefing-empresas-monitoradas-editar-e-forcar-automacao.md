# Briefing: Empresas monitoradas — edição e execução manual da automação

## 1. Objetivo

Definir o âmbito e os critérios de sucesso para evoluir a página **`/empresas-monitoradas`** (e o bloco partilhado **Empresas monitoradas** no Painel) de modo que, **por cada empresa monitorada**, o utilizador possa:

1. **Editar** os dados da empresa (ou abrir o fluxo de edição canónico com um gesto explícito).
2. **Forçar a automação a correr** de imediato (execução manual / “run now”), com feedback claro e alinhado ao backend real, quando aplicável.

Este documento é **somente briefing**; não substitui user story nem PRD e não inclui implementação.

**Referências existentes:** `docs/stories/incremento-nav-sidebar-empresas-monitoradas.md`, `docs/briefing-nav-sidebar-empresas-monitoradas.md` (se existir), componente `MonitoredCompaniesSection`, rota `empresas/[id]`.

---

## 2. Problema / oportunidade (produto)

Hoje a lista apresenta entradas no formato de **“pills”** (`Job mensal · CNPJ mascarado`). O utilizador percebe pouco **o que é clicável**, não vê **edição** como ação primária e não distingue bem **“teste simulado no browser”** de **“pedido real de sincronização / job”**.

Objetivo de UX: **ações visíveis e previsíveis** (ex.: editar, executar agora), com hierarquia clara e acessível (`aria-label` por ação, não só no agregado da linha).

---

## 3. Contexto técnico atual (brownfield)

### 3.1 UI e dados

| Peça | Comportamento actual |
|------|----------------------|
| `apps/web/src/components/monitored-companies-section.tsx` | Lista vinda de `GET /api/v1/organizations/{organizationId}/monitored-companies?...` via `useMonitoredCompanies`. Cada item é um **`<button>`** que chama `runSync(companyId, "monthly", cnpjMasked)`. |
| `apps/web/src/app/(dashboard)/empresas-monitoradas/page.tsx` | Reutiliza `MonitoredCompaniesSection` com `showSectionHeading={false}`; copy de página alinhada ao spec NAV. |
| `apps/web/src/context/portal-provider.tsx` → `runSync` | **Simulação local:** adiciona execução em estado `running` e após ~900 ms marca `success`, persiste em `localStorage`. **Não** chama API de job ADN nem altera servidor. |
| `apps/web/src/app/(dashboard)/empresas/[id]/page.tsx` | Edição completa (nome, código sistema, dia de corrida mensal) com **`PATCH /api/v1/companies/{id}`**. |
| `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx` | Fluxo **real** de pedido de sync: `GET`/`POST` em `/api/v1/organizations/{organizationId}/monitored-companies/{companyId}/adn/sync` (202, rate limit, perfis admin, etc.). |

Conclusão: a **fonte de verdade** para dados da empresa e para **enfileirar** trabalho ADN já existe; a lista de monitoradas **não expõe** edição nem o POST ADN de forma explícita, e o “job mensal” na lista está ligado ao **mock** do portal.

---

## 4. Decisões de produto a fechar (antes ou durante a story)

Enumeradas para `@po` / equipa fecharem; o `@dev` não deve adivinhar silenciosamente.

1. **“Forçar automação” significa o quê?**
   - **A)** Apenas o fluxo **ADN** (`POST .../adn/sync`), igual ao painel na ficha da empresa; ou  
   - **B)** Manter também uma **simulação** para demos offline (improvável em produção); ou  
   - **C)** Dois níveis na UI (“Teste local” vs “Pedir sync no portal”) — só se houver requisito explícito.

   **Recomendação de briefing:** **A** como comportamento por omissão em ambientes com ADN activo; descontinuar ou esconder o `runSync` simulado na lista quando existir integração real, para não induzir erro.

2. **Edição: onde ocorre?**
   - **Navegação** para `/empresas/{id}` com CTA “Editar” (menor custo, reutiliza validação e cópia existentes); ou  
   - **Modal / painel lateral** na própria lista (mais trabalho, duplicação de formulário).

   **Recomendação de briefing:** começar por **link/botão “Editar” → ficha**; evoluir para modal só se UAT exigir “sem sair da página”.

3. **“Executar agora” na lista:** reutilizar confirmação (`window.confirm`) da ficha ou adoptar padrão mais leve (toast + undo)? Alinhar com `@qa` para acessibilidade e consistência.

4. **Papel:** só **admin org** pode pedir ADN sync (já reflecto no painel ADN); a lista deve **ocultar** ou **desactivar** o botão com mensagem para não-admins?

---

## 5. Proposta de experiência (alvo)

### 5.1 Layout

- Preferir **linha por empresa** (lista semântica ou **tabela** responsiva) em vez de uma única pill ambígua: colunas sugeridas — **identificador** (nome comercial ou código + CNPJ mascarado), **estado** opcional (último job ADN se disponível via API), **acções**.
- **Acções mínimas:**  
  - **Editar** (ícone lápis ou texto; `href` ou `router.push` para `/empresas/{id}`).  
  - **Executar agora** (ícone play / texto; dispara o mesmo contrato que `AdnSyncPanel.requestSync` — ou extrair hook partilhado).

### 5.2 Estados e feedback

- **Loading** na linha ou spinner no botão enquanto `POST` está em curso.  
- **Sucesso:** mensagem inline ou toast + opcionalmente refrescar estado do último job (`GET .../adn/sync`).  
- **Erro 403 / 429 / 5xx:** mensagens alinhadas ao painel ADN existente (reutilizar strings ou factor comum).

### 5.3 A11y

- Cada botão com `aria-label` específico (não depender só do CNPJ mascarado).  
- Não usar `<button>` englobando toda a linha se houver múltiplas acções (evitar conflito teclado/rato).

---

## 6. Critérios de aceitação (definição de “feito”)

1. Na rota **`/empresas-monitoradas`**, cada empresa listada mostra **acção explícita de edição** que leva ao fluxo canónico de edição (`/empresas/{id}`) ou equivalente aprovado em produto.
2. Cada empresa listada mostra **acção explícita de execução manual** que, para utilizador autorizado e feature ADN activa, resulta em **`POST .../adn/sync`** com tratamento de **202**, **403** e **429** coerente com a ficha da empresa.
3. **Não** há regressão no **`GET` monitoradas** (paginação, erro de rede, estado vazio com link “Nova empresa monitorada”).
4. O Painel, se continuar a usar `MonitoredCompaniesSection`, mantém **paridade de acções** com a página dedicada (ou documenta-se divergência intencional numa nota de release).
5. Evidência **QA** curta: smoke manual ou e2e mínimo (lista + um clique editar + um clique executar com mock de API se necessário em CI).

---

## 7. Riscos e dependências

| Risco | Mitigação |
|-------|-----------|
| Duplicar lógica de `AdnSyncPanel` | Extrair hook `useAdnSyncRequest(organizationId, companyId)` ou serviço cliente partilhado. |
| Confusão entre `runSync` simulado e ADN real | Producto decide descontinuar simulação na lista ou renomear labels até remoção. |
| Rate limit ADN (429) | Reutilizar tratamento e copy existentes; não spammar retries automáticos. |
| Superadmin / org activa | Respeitar `getEffectiveOrganizationId` e regras já usadas em `handleGetMonitoredCompanies`. |

**Dependências:** nenhuma migração de base assumida para o MVP deste briefing; pode depender de story **NAV** já entregue para a rota existir.

---

## 8. Próximos passos sugeridos (fora deste briefing)

1. **`@po`:** validar decisões da secção 4 (principalmente A vs simulação).  
2. **`@sm`:** `*draft` de story incremental (referenciar este ficheiro + `incremento-nav-sidebar-empresas-monitoradas` se ainda for o épico-mãe).  
3. **`@dev`:** implementação em `MonitoredCompaniesSection` + testes; opcional deprecação de `runSync` na lista após acordo.

---

*Briefing preparado no âmbito do agente Analyst (Atlas), AIOS — entrega única conforme pedido; sem alterações de código nesta tarefa.*
