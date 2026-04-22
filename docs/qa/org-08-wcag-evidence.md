# ORG-08 — evidência checklist WCAG (spec dois níveis §9)

Referência: `docs/front-end-spec-dois-niveis-organizacao-vs-empresas-fiscais.md` §9.

| Critério (resumo) | Área | Estado |
| ----------------- | ---- | ------ |
| Ordem de foco previsível | Picker org, shell, dashboard | Verificar manualmente em `/organizacao` e `/dashboard` |
| Nomes acessíveis em controlos | “Trocar organização”, lista fiscal | Labels alinhados ao copy deck `org.*` |
| Contraste texto/UI | Banner `org-fiscal-copy-v1` | Conferir tema claro/escuro |
| Mensagens de estado | Erros API → UI | `messageFromApiJson` / toasts existentes |

**Nota para PR:** anexar 1–2 capturas do picker e do shell com contexto “Organização” ou referência a este ficheiro no corpo do PR.
