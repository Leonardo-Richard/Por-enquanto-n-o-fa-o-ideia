# Briefing: item da sidebar — de «Organização» para lista de empresas monitoradas

**Data:** 2026-04-24  
**Pedido:** No menu lateral do dashboard (shell autenticado), substituir o botão/entrada **«Organização»** por uma entrada que leve o utilizador à **lista de empresas monitoradas** (CNPJs da organização ativa), em linha com o que já aparece no **Painel**.

---

## 1. Contexto e problema

Hoje o item de navegação rotulado **«Organização»** aponta para a rota **`/empresas`**, que na implementação atual é o **picker de organização** («Escolha sua organização»), não a lista fiscal de CNPJs.

Referência no código:

```9:14:apps/web/src/components/dashboard-shell.tsx
const nav = [
  { href: "/dashboard", label: "Painel" },
  { href: "/empresas", label: "Organização" },
  { href: "/execucoes", label: "Execuções" },
  { href: "/configuracoes", label: "Configurações" },
] as const;
```

Isto gera **ambiguidade**: o rótulo sugere «gestão de organização», mas a rota é **troca de contexto de tenant**. A lista de **empresas monitoradas** (CNPJs) está concentrada na secção homónima do **Painel** (`/dashboard`), alimentada por `useMonitoredCompanies` e pela API `GET /api/v1/organizations/{id}/monitored-companies`.

O utilizador quer que o **atalho da sidebar** reflita o trabalho quotidiano: abrir a **lista de empresas monitoradas**, não confundir com o picker.

**Importante — não misturar com «Trocar organização»:** no mesmo shell existe o link **«Trocar organização»**, também para `/empresas`, com semântica correta de **mudança de organização ativa**. Este briefing **não** pede remoção desse link; apenas altera o **item do menu principal** (`nav`).

---

## 2. Objetivo do produto

1. O segundo item da sidebar (desktop e navegação móvel do mesmo componente) deve ter rótulo e destino alinhados com **empresas monitoradas** (CNPJs no contexto da organização ativa).
2. Manter **Painel** como visão geral; o novo destino pode ser **dedicado** ou **âncora no painel**, conforme decisão de UX (secção 4).
3. Preservar acesso claro ao **picker** via **«Trocar organização»** (e fluxos `?next=` existentes, se aplicável).

---

## 3. Estado atual (resumo técnico)

| Elemento | Comportamento atual |
|----------|---------------------|
| Sidebar `nav` — «Organização» | `href="/empresas"` → picker de organizações |
| «Trocar organização» | `href="/empresas"` → idem (correto para troca de org) |
| Lista de CNPJs + ações rápidas | `apps/web/src/app/(dashboard)/dashboard/page.tsx` — secção «Empresas monitoradas», dados via `useMonitoredCompanies` |
| Cadastro nova empresa | `/empresas/nova` (já referenciado no painel) |
| Detalhe por empresa | `/empresas/[id]` (fiscal / ADN, etc.) |

---

## 4. Opções de implementação (para @dev / @sm)

Escolher **uma** abordagem e documentar na story/PR.

1. **Nova rota dedicada** (ex.: `/monitoradas` ou `/empresas-monitoradas`)  
   - **Prós:** URL semântica, `h1` próprio, estado ativo da sidebar sem colidir com `/dashboard`.  
   - **Contras:** Duplicação ou extração de componente partilhado com o painel; mais uma página a manter.

2. **Âncora no Painel** (ex.: `/dashboard#empresas-monitoradas`)  
   - **Prós:** Reutiliza UI existente; zero duplicação de lista.  
   - **Contras:** Exige `id` na secção do painel e scroll; item ativo da sidebar pode precisar de regra especial (painel + âncora vs só `/dashboard`).

3. **Reutilizar rota existente não-picker**  
   - Hoje **não** existe listagem só de monitoradas fora do painel; `/empresas` é picker. **Não** recomendado apontar o menu para `/empresas` com outro rótulo sem refatorar rotas.

**Recomendação de análise:** se o objetivo é só «ir ver a lista», a opção **2** é a mais barata; se o objetivo é «secção própria no IA/navegação», a opção **1** é mais clara a longo prazo.

---

## 5. Copy e consistência (PT-BR)

Sugestões de rótulo para o item de menu (escolher uma e alinhar com `docs/front-end-spec-dois-niveis-organizacao-vs-empresas-fiscais.md`):

- **Empresas monitoradas** (alinhado ao `h2` do painel e às métricas).
- Alternativa mais curta: **Monitoradas** (menos explícito; preferir o nome completo se couber).

**Não** usar «Organização» neste item após a mudança, para não colidir com o conceito de tenant.

---

## 6. Critérios de aceite (checklist)

- [ ] O segundo item do `nav` em `DashboardShell` deixa de dizer «Organização» com destino ao picker; passa a refletir **empresas monitoradas** e o destino acordado (secção 4).
- [ ] **«Trocar organização»** continua a levar ao picker (`/empresas`).
- [ ] Estado **ativo** (realce verde) funciona ao visitar a lista (rota ou painel com âncora, conforme opção).
- [ ] Navegação **móvel** (mesmo array `nav` no header) comporta-se igual à sidebar.
- [ ] Sem regressão em fluxos de login `?next=/empresas` destinados ao picker (não alterar sem revisão).
- [ ] (Opcional) Atualizar evidência QA / copy em `docs/qa` se existir checklist que mencione o item «Organização» na sidebar.

---

## 7. Fora de âmbito (explícito)

- Alterar o modelo de dados ou a API de monitored companies.
- Remover o picker de `/empresas` ou renomear essa rota (mudança maior de arquitetura de URLs).
- Alterações no superadmin ou convites — apenas navegação shell.

---

## 8. Referências de código

- Shell e menu: `apps/web/src/components/dashboard-shell.tsx`
- Picker de organização: `apps/web/src/app/(dashboard)/empresas/page.tsx`
- Painel e lista atual: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Hook da lista: `apps/web/src/hooks/use-monitored-companies.ts`

---

*Briefing preparado para apoiar story/PR de UX navegação; implementação fica a cargo do agente de desenvolvimento.*
