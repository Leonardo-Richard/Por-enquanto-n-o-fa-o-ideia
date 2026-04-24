# ORG-08 — evidência checklist WCAG (spec dois níveis §9)

Referência: `docs/front-end-spec-dois-niveis-organizacao-vs-empresas-fiscais.md` §9.

| Critério (resumo) | Área | Estado |
| ----------------- | ---- | ------ |
| Ordem de foco previsível | Picker org, shell, dashboard | Verificar manualmente em `/empresas` (picker), `/dashboard` e `/empresas-monitoradas` |
| Nomes acessíveis em controlos | “Trocar organização”, lista fiscal | Labels alinhados ao copy deck `org.*` |
| Contraste texto/UI | Banner `org-fiscal-copy-v1` | Conferir tema claro/escuro |
| Mensagens de estado | Erros API → UI | `messageFromApiJson` / toasts existentes |

**Nota para PR:** anexar 1–2 capturas do picker e do shell com o item de navegação **«Empresas monitoradas»** (`/empresas-monitoradas`) ou referência a este ficheiro no corpo do PR.

---

## Smoke NAV — sidebar «Empresas monitoradas» (NAV-02 / NAV-03 opcional)

Referência: `docs/stories/incremento-nav-sidebar-empresas-monitoradas.md` (DoD macro + matriz §8).

| Passo | Verificação |
| ----- | ------------- |
| 1 | Com org activa, abrir `/empresas-monitoradas` — existe um único `h1` com texto **«Empresas monitoradas»** (assert manual ou DevTools). |
| 2 | Matriz de realce no `DashboardShell`: `/dashboard` → só Painel; `/empresas-monitoradas` → só segundo item; `/empresas` e `/empresas/nova` → **nenhum** dos quatro itens principais activo; `/execucoes` → Execuções; `/configuracoes` → Configurações. |
| 3 | Sem org activa, aceder a rota protegida (ex. `/empresas-monitoradas`) → redireccionamento para `/empresas?next=…` sem regressão do fluxo `?next=` após escolher org. |
| 4 | **UAT qualitativo (PRD):** no PR ou comentário de QA, um parágrafo a confirmar que o segundo item do menu não se confunde com o picker e que **«Trocar organização»** continua o caminho claro para mudar de tenant. |
