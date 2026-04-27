# Briefing: superadmin cadastra organizações e acessa toda a base

**Tipo:** atualização de produto + autorização + operação administrativa  
**Data:** 2026-04-27  
**Público:** PM (`@pm`), arquitetura (`@architect`), SM (`@sm`) — base para PRD incremental, histórias e critérios de segurança  
**Contexto:** consolidar o papel de `superadmin` como operador de plataforma capaz de **criar organizações** e **acessar qualquer organização** para suporte, onboarding e governança.

---

## 1. Problema

O produto já suporta o conceito de organização e já permite que o `superadmin` liste organizações acessíveis e ative contexto de uma organização sem membership local.  
Porém, falta formalizar e implementar o fluxo de **cadastro de nova organização pelo superadmin** com regras claras de:

1. criação mínima da organização;
2. atribuição inicial de responsáveis;
3. acesso imediato pelo superadmin;
4. trilha de auditoria para operações cross-org.

Sem esse fluxo, o onboarding operacional depende de intervenção técnica, reduz velocidade de ativação de clientes e aumenta risco de processo manual sem padrão.

---

## 2. Objetivo da atualização

1. Permitir que `superadmin` crie organizações no painel administrativo.
2. Garantir que `superadmin` continue acessando todas as organizações (existentes e recém-criadas).
3. Definir política de segurança e auditoria para operações globais.
4. Preservar isolamento tenant para usuários comuns/admins de organização.

**Resultado esperado:** onboarding de organização sem SQL manual, com rastreabilidade completa e sem regressão de permissões por tenant.

---

## 3. Escopo funcional (alto nível)

### 3.1 Cadastro de organização por superadmin

- Formulário com campos mínimos:
  - nome da organização (obrigatório);
  - nome fantasia (opcional);
  - CNPJ (`taxIdDigits`) opcional no MVP, mas validado quando informado.
- Validações:
  - nome obrigatório;
  - CNPJ em formato de 14 dígitos quando preenchido;
  - evitar duplicidade conforme regra definida em PRD (ex.: `taxIdDigits` único quando não nulo).
- Persistência:
  - cria registro em `organizations`;
  - retorna `organizationId` criado;
  - registra evento de auditoria.

### 3.2 Acesso global do superadmin

- `superadmin` visualiza todas as organizações na listagem.
- `superadmin` pode definir qualquer organização como ativa na sessão.
- `superadmin` pode abrir área administrativa da organização sem depender de membership local.

### 3.3 Bootstrap opcional pós-criação

Após criar organização, oferecer ação guiada:
1. vincular usuário existente como `admin` da organização; ou
2. criar convite de admin inicial (se convite já existir no produto).

Se essa etapa não estiver pronta no incremento, criar organização sem admin local deve ser permitido somente para `superadmin`, com alerta de pendência operacional.

---

## 4. Regras de autorização

1. **Superadmin**
   - pode criar organizações;
   - pode listar e acessar todas as organizações;
   - pode abrir gestão de usuários em qualquer organização (conforme política já definida no PRD de login/roles).
2. **Admin/User de organização**
   - não podem criar organizações de plataforma;
   - continuam restritos às organizações onde têm membership.
3. **Mutações de negócio fiscal**
   - manter política atual: mutações de dados fiscais continuam exigindo papel `admin` no tenant, salvo decisão explícita futura para override de superadmin.

---

## 5. Requisitos funcionais propostos

| ID | Descrição |
| -- | --------- |
| **RF-SA1** | O sistema deve disponibilizar endpoint/ação para `superadmin` criar organização com dados mínimos válidos. |
| **RF-SA2** | A organização recém-criada deve aparecer imediatamente na listagem de organizações acessíveis ao `superadmin`. |
| **RF-SA3** | O `superadmin` deve conseguir definir a organização recém-criada como organização ativa na sessão sem membership adicional. |
| **RF-SA4** | O sistema deve bloquear tentativa de criação de organização por usuários sem `isSuperadmin = true` (retorno 403). |
| **RF-SA5** | Toda criação de organização por `superadmin` deve gerar evento de auditoria com `actor_user_id`, `organization_id`, timestamp e metadata de origem. |
| **RF-SA6** | Se houver regra de unicidade de identificador fiscal, o endpoint deve retornar erro de conflito (409) com mensagem clara para o operador. |

---

## 6. Requisitos não funcionais

| ID | Descrição |
| -- | --------- |
| **NFR-SA1** | Operações administrativas globais devem ter logs estruturados e rastreáveis para suporte e compliance. |
| **NFR-SA2** | Fluxo de criação deve responder com feedback claro de sucesso/erro e estado de carregamento. |
| **NFR-SA3** | Testes de autorização devem cobrir cenários positivos (`superadmin`) e negativos (`admin`/`user`). |
| **NFR-SA4** | O incremento não pode quebrar APIs já existentes de listagem e seleção de organização ativa. |

---

## 7. UX e navegação sugeridas

- Entrada no menu administrativo (visível apenas para `superadmin`): **“Organizações”**.
- Tela com:
  - tabela/lista de organizações;
  - busca por nome;
  - ação primária **“Nova organização”**.
- Modal/página de criação:
  - campos mínimos + validação em tempo real;
  - botão **“Criar organização”**;
  - após sucesso: opção **“Acessar agora”** para trocar contexto ativo.

---

## 8. Critérios de aceite (macro)

1. `superadmin` consegue criar organização via UI/API sem intervenção manual em banco.
2. `admin` e `user` não conseguem criar organização (403).
3. organização criada aparece para `superadmin` em listagem e pode ser ativada na sessão.
4. evento de auditoria de criação é gravado e consultável.
5. smoke test de regressão confirma que isolamento entre organizações permanece intacto para não-superadmin.

---

## 9. Riscos e mitigações

| Risco | Mitigação |
| ----- | --------- |
| Criação de organização sem responsável local | Exibir alerta pós-criação e incentivar vinculação imediata de admin da organização. |
| Ambiguidade entre privilégio global e escopo local | Documentar matriz de permissões e manter checagem server-side centralizada em `authz`. |
| Falta de trilha de auditoria para ações sensíveis | Tornar evento de auditoria obrigatório para criação e troca de contexto organizacional. |

---

## 10. Dependências técnicas esperadas

1. Endpoint/handler para `POST /api/v1/organizations` (ou rota equivalente já adotada no projeto).
2. Reuso das funções existentes de sessão/autorização (`isSuperadmin`, organização ativa, guardas de acesso).
3. Atualização do contrato OpenAPI de organizações/sessão.
4. Testes de integração para criação + autorização.

---

## 11. Próximos passos (AIOS)

1. **`@pm`** — incorporar RF-SA1..RF-SA6 e NFR-SA1..NFR-SA4 no PRD incremental.
2. **`@architect`** — definir contrato final do endpoint, validações de unicidade e eventos de auditoria.
3. **`@sm`** — fatiar histórias: API criação, UI admin, testes de autorização e documentação.
4. **`@qa`** — plano de teste para permissão, regressão de isolamento e auditoria.

---

*Documento de briefing para evolução de capacidade administrativa do superadmin. Não substitui PRD, arquitetura detalhada e plano de migração.*
