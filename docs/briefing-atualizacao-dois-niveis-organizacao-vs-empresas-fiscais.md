# Briefing: dois níveis de “empresa” — organização cliente do portal vs. empresas da automação fiscal

**Tipo:** clarificação de domínio de produto + impacto em dados, UX e documentação  
**Data:** 2026-04-22  
**Público:** PM (`@pm`), arquitetura (`@architect`), SM (`@sm`) — base para PRD, modelo de dados e histórias  
**Contexto:** corrigir ambiguidade entre (A) quem **contrata / utiliza** o site e (B) quais **CNPJs / cadastros fiscais** entram na **automação de notas**.

---

## 1. Problema (o que estava confuso)

Na conversa ficou implícito um único conceito de “empresa”. Na realidade do produto existem **dois conceitos distintos**:

1. **Organização que utiliza o portal** — a “companhia” (cliente B2B da plataforma): contrata o serviço, paga (futuro), define políticas, convida utilizadores e escolhe em qual **contexto de trabalho** opera o dia a dia.
2. **Empresas cadastradas para automação** — os **CNPJs monitorados** (com código do sistema de origem, agendamento, jobs, etc.) cujas **notas fiscais** a automação deve **obter e organizar**.

Misturar os dois gera decisões erradas em modelo de dados, permissões e textos da interface (“empresa” pode significar coisas diferentes).

---

## 2. Definições canônicas (glossário sugerido)

| Termo sugerido (produto) | O que é | Exemplo |
| ------------------------ | ------- | ------- |
| **Organização cliente** (ou **conta organização**) | Entidade que **usa o site** como ferramenta; âmbito de **login, convites, papéis** e **lista de utilizadores**. Pode ser contabilidade, escritório, holding, etc. | “Escritório Silva & Associados” |
| **Empresa monitorada** (ou **empresa fiscal** / **CNPJ na automação**) | Cadastro **criado pelos utilizadores** da organização cliente; é o alvo da **coleta de NF**, pastas, jobs e regras de `system_code` / `monthly_run_day`. | CNPJs de clientes do escritório, filiais, etc. |

**Regra de ouro:** a **automação fiscal** opera sempre sobre **empresas monitoradas**, nunca “no ar” sem vínculo a uma **organização cliente** que detenha o cadastro e a responsabilidade de uso.

---

## 3. Relação entre os níveis

```text
Organização cliente (utiliza o portal)
  └── Utilizadores (membros, Admin, User, …)
  └── Empresas monitoradas (CNPJ + código do sistema + …)
        └── Jobs / execuções / agente / pastas locais
```

- Uma **organização cliente** possui **N** empresas monitoradas (0 no início é válido — onboarding).
- Uma **empresa monitorada** pertence a **exatamente uma** organização cliente (multi-tenant claro; sem “CNPJ órfão” partilhado entre organizações, salvo regra explícita futura de plataforma).

---

## 4. Alinhamento com documentação e código atuais

- **`docs/brief.md`** e **`docs/prd.md`** descrevem sobretudo o fluxo de **cadastro de CNPJs e automação** — isso corresponde ao nível **empresa monitorada**, hoje modelado em grande parte como `companies` ligadas a `account_id` / conta.
- **`docs/briefing-atualizacao-login-empresas-roles.md`** fala em **“empresa selecionada”** e **tenant** — no glossário deste briefing, isso deve ser lido como **organização cliente** (contexto após login), **não** como sinónimo de cada CNPJ da automação.

**Implicação:** o PRD e a arquitetura devem **nomear explicitamente** os dois níveis (rótulos de UI + entidades no modelo). Se a tabela atual `companies` mistura “tenant” e “CNPJ monitorado”, o incremento deve **separar** ou **documentar** qual coluna/FK representa qual conceito, para evitar regressão semântica.

---

## 5. Objetivos da atualização (produto)

1. **Linguagem consistente** em telas, emails e docs internos: utilizador entende **em que organização** está e **quais CNPJs** estão sob automação.
2. **Autorização correta:** permissões de Admin/User aplicam-se ao **espaço da organização cliente**; operações sobre **empresas monitoradas** respeitam o mesmo âmbito (nunca cruzar organizações).
3. **Rastreabilidade:** jobs e auditoria referenciam **organização** + **empresa monitorada** quando relevante para suporte e LGPD.

---

## 6. Requisitos funcionais (alto nível)

- **RF-O1:** Após autenticação, o utilizador opera no contexto de **uma organização cliente** (picker / empresa ativa — já previsto no incremento de login; o briefing de login deve usar o vocabulário deste documento).
- **RF-O2:** CRUD de **empresas monitoradas** (CNPJ, código do sistema, agendamento, ativo) ocorre **sempre** dentro da organização cliente corrente.
- **RF-O3:** A automação (cadastro imediato, mensal, agente) associa execuções à **empresa monitorada** e, implicitamente, à **organização cliente** dona do cadastro.
- **RF-O4:** Superadmin de plataforma (se existir) distingue **listar organizações clientes** de **inspecionar CNPJs monitorados** dentro de cada uma — política detalhada no PRD.

---

## 7. UX — exemplos de copy (não vinculativos)

- Seletor pós-login: **“Escolha sua organização”** ou **“Em qual empresa você está trabalhando?”** — desde que fique claro que é o **tenant**, não o CNPJ da NF.
- Área de cadastros fiscais: **“Empresas na automação”**, **“CNPJs monitorados”** ou **“Clientes fiscais”** — evitar só “Empresas” sem qualificador.

---

## 8. Decisões a fechar no PRD (não bloqueiam este briefing)

1. Nomes finais em PT-BR para menu e entidades (`Organização`, `Conta`, `Workspace`, etc.).
2. Migração de dados se hoje existir uma única tabela `companies`: renomear conceito vs. dividir tabela — **@architect**.
3. Limite de empresas monitoradas por organização (plano comercial) — fora do núcleo técnico, mas afeta mensagens de erro.

---

## 9. Critérios de aceite (macro)

- Nenhum ecrã crítico usa “empresa” de forma ambígua sem contexto **ou** o produto define legenda/tooltip que amarra ao glossário.
- APIs e logs permitem responder: **“qual organização cliente?”** e **“qual CNPJ monitorado?”** para uma execução dada.
- Documentação em `docs/brief.md` / PRD passa a refletir os **dois níveis** com os termos escolhidos.

---

## 10. Próximos passos (AIOS)

1. **`@pm`** — atualizar PRD (FRs e glossário); ajustar histórias que hoje falam só em “empresa”.
2. **`@architect`** — modelo de dados (`organization_id` vs. renomeações), FKs de `jobs`, RLS se aplicável.
3. **`@sm`** — fatiar (ex.: “migração semântica + copy”, “APIs com organization scope”, “relatórios/admin”).

---

*Documento de briefing de descoberta; não substitui PRD nem migrações. Gerado para clarificar a distinção entre **organização que utiliza o portal** e **empresas cadastradas para a automação de notas fiscais**.*
