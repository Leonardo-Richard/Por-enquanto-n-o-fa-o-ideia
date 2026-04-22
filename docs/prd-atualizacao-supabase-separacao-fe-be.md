# PRD — Atualização Supabase, ambiente e separação frontend / backend

**Produto:** Portal de automação de notas fiscais (por empresa) — ver [Project Brief](brief.md).  
**Documento base técnico:** [Briefing Supabase / FE-BE](briefing-atualizacao-supabase-separacao-fe-be.md).  
**Tipo:** Brownfield (melhoria de plataforma e integração, sem alterar a proposta de valor principal do MVP).  
**Versão:** 1.0 · **Data:** 2026-04-22 · **Autor:** PM (Morgan) / fluxo AIOS

---

## 1. Análise de contexto e âmbito

### 1.1 Fonte de análise

- **Brief de produto:** `docs/brief.md` (cadastro multi-empresa, automação, agendamento, autenticação, LGPD).
- **Briefing técnico:** `docs/briefing-atualizacao-supabase-separacao-fe-be.md`.
- **Análise complementar:** inspeção prévia do repositório (Next.js App Router, Drizzle em `packages/db`, Route Handlers em `apps/web/src/app/api/`, Better Auth).

### 1.2 Estado atual (resumo)

Monorepo com aplicação web que persiste dados via **PostgreSQL** acessado pelo servidor com **Drizzle** (`DATABASE_URL`). O “backend” de produto está materializado como **rotas HTTP** (`app/api/...`), não como serviço separado em outro deploy. O project brief exige **dados por conta**, **jobs** e **confiabilidade** — o alinhamento a um **projeto Supabase** na nuvem reforça hospedagem gerida, backups e escalonamento do Postgres.

### 1.3 Tipo de melhoria

| Dimensão | Classificação |
|----------|----------------|
| Tipo | Integração com sistema externo (Supabase como hospedeiro Postgres) + disciplina arquitetural (camadas) |
| Impacto no código | Moderado (configuração, env, possível cliente browser, revisão de imports e testes) |
| Impacto no utilizador | Indireto: maior estabilidade e paridade dev/prod quando a base cloud for a referência |

### 1.4 Objetivos de produto desta iniciativa

- Garantir que **cadastros, sessões e dados multi-empresa** residam num **Postgres gerido** (projeto Supabase) alinhado ao ambiente de deploy.
- Reduzir risco de **vazamento de credenciais** e de **acesso direto à base a partir do browser** sem políticas adequadas.
- Manter **contratos de API** e fluxos já entregues (login, empresas, membros, etc.) **compatíveis** após a migração de ambiente.
- Clarificar regras de **frontend vs backend** para acelerar evolução do MVP (automação, agendamentos) sem dívidas de segurança.

### 1.5 Contexto e motivação

O brief assume utilizadores que confiam no portal para **dados fiscais e empresariais**. Apontar `DATABASE_URL` e variáveis públicas Supabase para o **mesmo projeto** evita inconsistência entre o que o servidor grava e o que eventuais clientes Supabase leem. A separação FE/BE assegura que reforços de **autorização** e **auditoria** permaneçam no servidor, coerentes com LGPD e riscos listados no brief.

### 1.6 Registo de alterações (changelog)

| Data | Versão | Descrição | Autor |
|------|--------|-----------|--------|
| 2026-04-22 | 1.0 | Versão inicial do PRD | PM |

---

## 2. Requisitos funcionais (FR)

- **FR1:** O ambiente de execução do servidor deve utilizar uma `DATABASE_URL` válida para o **Postgres do projeto Supabase** alvo (mesmo projeto que `NEXT_PUBLIC_SUPABASE_URL`), com ligação TLS conforme documentação Supabase (ex.: `sslmode=require` na URI quando aplicável).
- **FR2:** Ficheiros de exemplo de configuração (ex.: `.env.example`) devem listar **todas** as variáveis necessárias para: servidor (`DATABASE_URL`, segredos de auth existentes), e cliente opcional (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), com comentários que indiquem **o que pode** e **o que não pode** ir para o bundle do browser.
- **FR3:** O arranque da aplicação em modo “cloud alvo” deve falhar de forma **explícita** se `DATABASE_URL` estiver ausente ou inválida (comportamento já desejável; mantém-se e valida-se contra Supabase).
- **FR4:** Nenhum componente de UI em `apps/web/src/app/**`, `components/**` ou `hooks/**` deve importar `getDb()`, `createDb` ou módulos que exijam `DATABASE_URL` no bundle cliente.
- **FR5:** Toda a persistência de dados de negócio e operações privilegiadas deve ocorrer através de **Route Handlers** (`app/api/**/route.ts`), **Server Actions** que delegam em serviços servidor, ou código em `packages/db` / `src/lib` **apenas** invocado a partir do servidor.
- **FR6:** Os contratos JSON das rotas existentes sob `api/v1/*` (e rotas de auth) devem manter **compatibilidade** com clientes atuais (mesmos campos obrigatórios e códigos HTTP de sucesso/erro documentados ou já utilizados pelo frontend), salvo versão explícita da API acordada fora deste PRD.
- **FR7:** Deve existir documentação operacional mínima (README ou secção em `docs/`) descrevendo: obter URI do **pooler** no dashboard Supabase, definir variáveis em `.env.local` e em produção, e **aplicar migrações** ao projeto remoto antes de tráfego real.
- **FR8 (opcional / decisão em PR):** Se for introduzido `@supabase/supabase-js` no frontend, o seu uso deve ficar restrito a capacidades explicitamente necessárias (ex.: Realtime ou Storage) e a dados protegidos por **RLS** e políticas revistas; caso não haja requisito, o cliente não deve ser adicionado “por conveniência”.

---

## 3. Requisitos não funcionais (NFR)

- **NFR1 — Segurança:** Chaves `service_role` e passwords de base **nunca** em repositório, issues ou bundles `NEXT_PUBLIC_*`.
- **NFR2 — Segurança:** A chave publicável/anon só pode expor operações **já autorizadas** por RLS se existir query direta do browser à API Supabase.
- **NFR3 — Confiabilidade:** Em ambientes serverless/edge, usar modo de pooler adequado a **ligações curtas** e alta concorrência (Transaction pooler para Drizzle, conforme orientação Supabase).
- **NFR4 — Observabilidade:** Health check (ex.: rota existente de health) deve refletir conectividade à base quando configurado para o ambiente alvo.
- **NFR5 — Manutenibilidade:** Novas features do MVP (execuções, agendamentos) devem seguir o mapa de camadas definido no briefing (UI → API → `lib`/ `packages/db`).
- **NFR6 — Testes:** Testes de integração e E2E que dependem de `DATABASE_URL` ou URLs devem poder executar contra **Postgres local** ou contra cloud mediante **variáveis explícitas** de CI, sem valores secretos no código.
- **NFR7 — LGPD / dados sensíveis:** Alinhado ao brief — minimização de dados, auditoria de acesso onde já existir padrão; esta iniciativa não remove controlos existentes.

---

## 4. Requisitos de compatibilidade (CR) — brownfield

- **CR1:** Compatibilidade com **Better Auth** e fluxos de sessão atuais até decisão explícita de produto de migrar para Supabase Auth (fora de âmbito deste PRD salvo anexo de decisão).
- **CR2:** Compatibilidade de **schema**: migrações em `db/migrations/` (ou processo adotado pelo projeto) devem ser aplicáveis ao Postgres Supabase sem quebrar dados de utilizadores/empresas já migrados.
- **CR3:** Compatibilidade de **API HTTP** com o frontend e hooks existentes (`packages/shared` / chamadas `fetch` atuais).
- **CR4:** Compatibilidade com **monorepo** atual (sem obrigar extração para segundo repositório como critério de aceite deste PRD).

---

## 5. Fora de âmbito (explícito)

- Substituição de **Better Auth** por **Supabase Auth** sem PRD ou spike dedicado.
- Implementação completa de **RLS** em todas as tabelas se o servidor continuar a ser o único escritor via Drizzle (pode ser faseada pelo @architect / @data-engineer).
- Alteração da **proposta de valor** do MVP (agente local, conectores fiscais) — apenas infraestrutura de dados e fronteiras de código.

---

## 6. Metas de sucesso e métricas

| Métrica | Alvo |
|---------|------|
| Deploy com base Supabase | Build e runtime com `DATABASE_URL` cloud sem erros críticos nas rotas críticas (auth, me, empresas) |
| Falhas de configuração | Zero ocorrências de secrets em histórico git após revisão |
| Dívida de camadas | Zero novos imports de `getDb` a partir de componentes cliente após merge |

---

## 7. Decisões de produto / arquitetura a travar (dependências)

1. **Nível Supabase:** Confirmar **Nível A** (obrigatório) e se **Nível B** (supabase-js no browser) é necessário para o roadmap imediato; **Nível C** (troca de auth) permanece fora até decisão registada.
2. **Ambiente padrão de desenvolvimento:** Postgres local vs remoto — se remoto, política de dados de teste e rotação de credenciais.
3. **CI:** Se os testes de integração devem apontar a instância cloud (custos/latência) ou apenas a Postgres local com schema alinhado.

---

## 8. Épicos e histórias (nível PRD)

### Epic 1 — Fundação Supabase e ambiente

- Aplicar migrações ao projeto Supabase; validar `DATABASE_URL` (pooler); atualizar `.env.example` e documentação de onboarding.
- Critério global: health + login + leitura/escrita mínima num fluxo já existente.

### Epic 2 — Disciplina frontend / backend

- Auditoria de imports: UI e hooks sem acesso direto a DB; persistência só via API/lib servidor.
- Opcional: pacote cliente API tipado partilhado com `packages/shared`.

### Epic 3 — Cliente Supabase no browser (condicional)

- Só se FR8 for aprovado: instalar SDK, RLS necessárias, testes de segurança básicos.

*(Detalhamento em histórias fica a cargo do @sm com base neste PRD.)*

---

## 9. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Schema local ≠ remoto | Checklist de migração + smoke manual pós-push |
| Expor dados via RLS incompleta | Não ativar Nível B até políticas revistas; preferir servidor |
| Misturar dois sistemas de auth | Manter Better Auth até decisão documentada |
| Fuga de secrets | Revisão de PR, git-secrets, env só em plataforma |

---

## 10. Referências

- [Project Brief](brief.md)
- [Briefing técnico](briefing-atualizacao-supabase-separacao-fe-be.md)
- Documentação Supabase: connection pooling, environment variables, RLS

---

— Morgan, planejando o futuro
