# PRD — Incremento: navegação sidebar — «Empresas monitoradas» (em substituição de «Organização»)

**Documento:** requisitos de produto derivados do project brief `docs/briefing-nav-sidebar-empresas-monitoradas.md`.  
**Normativa integrada:** `docs/prd.md` (visão geral), `docs/prd-atualizacao-dois-niveis-organizacao-vs-empresas-fiscais.md` (**FR33–FR40**, terminologia **organização** vs **empresas monitoradas**), `docs/front-end-spec-dois-niveis-organizacao-vs-empresas-fiscais.md` (rótulos e shell). Em caso de conflito com copy ou rotas já fechadas numa versão posterior do spec, **prevalece o spec de dois níveis** até harmonização.

**Change log (este incremento):**

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 1.0    | PRD inicial: requisitos FR49–FR52, NFR24–NFR25, decisão de destino da navegação, épico e histórias. |

---

## 1. Objetivos de produto

1. Eliminar **ambiguidade** entre «organização (tenant)» e «empresas com CNPJ monitorado»: o segundo item do menu lateral (e o bloco equivalente no header móvel) deixa de sugerir gestão genérica de «Organização» quando o destino era o **picker de organização**.
2. Dar ao operador um **atalho explícito** para a **lista de empresas monitoradas** da **organização ativa**, alinhado ao trabalho diário (consultar CNPJs, disparar teste mensal, ir ao cadastro).
3. **Preservar** o fluxo de **troca de contexto de tenant** via **«Trocar organização»** → `/empresas`, sem regressões em redirecionamentos `?next=` que apontem para o picker.
4. **Métrica de sucesso:** redução de cliques errados para o picker quando a intenção é ver CNPJs; feedback qualitativo de que o menu «faz sentido» com o modelo de dois níveis (**FR38** / **FR39**).

---

## 2. Contexto e problema (síntese do brief)

- Hoje `DashboardShell` define o segundo item do `nav` como **«Organização»** com `href="/empresas"`.
- A rota `/empresas` implementa o **picker** («Escolha sua organização»), não a lista fiscal.
- A lista de CNPJs vive na secção **«Empresas monitoradas»** do **Painel** (`/dashboard`), com dados via `useMonitoredCompanies` e API `GET /api/v1/organizations/{organizationId}/monitored-companies`.

---

## 3. Decisões de produto fechadas

| Tema | Decisão |
| ---- | ------- |
| **Rótulo do item de menu** | **«Empresas monitoradas»** (PT-BR), salvo limitação extrema de largura em viewport muito estreita — nesse caso **«Monitoradas»** apenas com aprovação explícita no PR de UI. |
| **«Trocar organização»** | Mantém destino **`/empresas`** (picker); copy inalterada neste incremento. |
| **Destino do novo item de menu** | **Rota dedicada** **`/empresas-monitoradas`** que apresenta a lista e ações mínimas **equivalentes** à secção homónima do Painel (ver secção 6). **Motivo:** estado ativo do `nav` distinto de «Painel», URL partilhável e semântica clara; evita discussão de realce quando só existe hash em `/dashboard`. |
| **Painel** | Continua a mostrar a secção de empresas monitoradas **como hoje** (sem remoção obrigatória neste incremento); duplicação de **dados** é aceite na UI (duas vistas) desde que a **fonte de dados** seja a mesma API/hook — **não** duplicar regras de negócio. |
| **Fluxos `?next=/empresas`** | **Não** alterar comportamento do picker nem query params sem análise de regressão; fora do escopo deste PRD salvo bug encontrado em QA. |

**Alternativa técnica aceite (se a equipa justificar custo de nova rota):** implementar **âncora** `/dashboard#empresas-monitoradas` com `id` estável na secção do painel **e** regra de estado ativo no `nav` que considere pathname `/dashboard` **mais** hash (ou só pathname se o produto aceitar realce em «Painel» e «Empresas monitoradas» em simultâneo — **não preferido**). Se esta alternativa for escolhida, atualizar este PRD (versão 1.1) com a decisão.

---

## 4. Fora de âmbito

- Alterações ao modelo de dados, RLS ou contrato da API de monitored companies.
- Remover ou renomear a rota `/empresas` (picker).
- Superadmin, convites, memberships — exceto impacto colateral de **navegação** já coberto por guards existentes.
- Redesign completo do Painel ou do shell.

---

## 5. Requisitos funcionais (incremento)

Novos identificadores para rastreio (**FR49–FR52**). Integração futura no `docs/prd.md` recomendada na próxima revisão consolidada.

| ID | Descrição |
| -- | ----------- |
| **FR49** | O segundo item da navegação principal do shell autenticado (`DashboardShell`, desktop e variante móvel) deve exibir o rótulo **«Empresas monitoradas»** (ou variante aprovada na secção 3) e navegar para o destino acordado (**`/empresas-monitoradas`** por defeito, ou alternativa documentada na secção 3). **Não** deve rotular-se «Organização» nem apontar para o picker `/empresas`. |
| **FR50** | O link **«Trocar organização»** no cabeçalho do aside deve permanecer com destino **`/empresas`** e manter a função de abrir o **picker** de organizações acessíveis. |
| **FR51** | Na vista **empresas monitoradas** (rota dedicada ou secção com âncora), o utilizador autenticado com organização ativa deve ver a **lista de empresas** da organização corrente (CNPJ mascarado ou formato já usado no Painel), estado vazio com copy e ligação para **«Nova empresa monitorada»** (`/empresas/nova`), e — quando aplicável ao código existente do Painel — ação de **disparo de sincronização de teste** (job mensal) por empresa. |
| **FR52** | O item de menu **«Empresas monitoradas»** deve entrar em estado **ativo** (realce já usado no shell) quando `pathname` corresponder à rota dessa vista; se a alternativa por âncora for adoptada, definir regra explícita de activação documentada na story sem ambiguidade para QA. |

---

## 6. Paridade mínima Painel ↔ nova rota

A página em **`/empresas-monitoradas`** deve cumprir **FR51** com **paridade funcional mínima** relativamente à secção «Empresas monitoradas» de `apps/web/src/app/(dashboard)/dashboard/page.tsx`:

- Listagem alimentada pela mesma fonte (ex.: `useMonitoredCompanies` + `effectiveOrganizationId`).
- Atalho/acções de cadastro coerentes com o Painel (`/empresas/nova`).
- Comportamento quando **não** há organização activa: reutilizar padrão já usado noutras rotas do dashboard (redirect, mensagem ou skeleton) — **decisão de implementação** registada na story.

**Opcional (não bloqueante para MVP deste incremento):** link «Voltar ao painel» ou breadcrumb; o menu já oferece «Painel».

---

## 7. Requisitos não funcionais (incremento)

| ID | Descrição |
| -- | ----------- |
| **NFR24** | **Acessibilidade:** item de navegação activo com indicação clara para tecnologias assistivas (ex.: `aria-current="page"` no `Link` activo, se compatível com Next.js e padrão do projecto). |
| **NFR25** | **Consistência:** textos em **PT-BR**; terminologia alinhada a **FR38** / **FR39** (não usar «empresa» isolada para significar organização). |

---

## 8. UX (sumário)

- **Antes:** segundo item = «Organização» → picker (confusão).
- **Depois:** segundo item = «Empresas monitoradas» → lista de CNPJs da org activa; troca de org continua explícita no link verde **«Trocar organização»**.

---

## 9. Épico e histórias (para @sm / @dev)

### Épico NAV-01 — Navegação shell: empresas monitoradas

**Objetivo:** Entregar navegação clara entre Painel, lista de empresas monitoradas e picker de organização, sem regressão nos fluxos de sessão.

| ID | História (resumo) | Critérios de aceite (mínimos) |
| -- | ----------------- | ------------------------------ |
| **NAV-01.1** | Como **operador autenticado**, quero **abrir «Empresas monitoradas» a partir do menu**, para **ver os CNPJs da organização activa sem passar pelo picker**. | Cumpre **FR49**, **FR51**, **FR52**; paridade da secção 6; mobile e desktop. |
| **NAV-01.2** | Como **operador**, quero **«Trocar organização»** a manter-se disponível, para **mudar de tenant sem perder o atalho correcto**. | Cumpre **FR50**; smoke em `/empresas?next=…` se existir caso de teste no repositório. |
| **NAV-01.3** | (Opcional) **Documentação / QA** — Actualizar referências em `docs/qa` ou specs que mencionem o item antigo «Organização» na sidebar. | **NFR25**; checklist de regressão visual. |

---

## 10. Riscos e dependências

| Risco | Mitigação |
| ----- | ---------- |
| Duplicação de UI entre Painel e `/empresas-monitoradas` | Extrair componente partilhado na mesma PR ou tecnicamente logo a seguir; evitar divergência de regras. |
| `pathname.startsWith("/empresas")` activar também `/empresas/nova` e `/empresas/[id]` | Rever lógica de **estado activo** do `nav` ao introduzir `/empresas-monitoradas` — não assumir prefixo único sem ajuste. |

**Dependências:** organização activa na sessão (já requerida pelo Painel); sem nova API.

---

## 11. Próximos passos sugeridos

1. **@sm:** gerar ou actualizar story em `docs/stories/` com tarefas técnicas (nova rota, `nav`, testes manuais).  
2. **@dev:** implementar conforme **FR49–FR52**; preferência de rota na secção 3.  
3. **@qa:** validar **FR52** com rotas `/empresas/nova` e `/empresas/[id]` para garantir realce correcto apenas no item pretendido.

---

## 12. Referências de código e documentos

- Briefing: `docs/briefing-nav-sidebar-empresas-monitoradas.md`
- Shell: `apps/web/src/components/dashboard-shell.tsx`
- Picker: `apps/web/src/app/(dashboard)/empresas/page.tsx`
- Painel (secção referência): `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Hook: `apps/web/src/hooks/use-monitored-companies.ts`

---

*PRD elaborado no âmbito AIOS (PM).*
