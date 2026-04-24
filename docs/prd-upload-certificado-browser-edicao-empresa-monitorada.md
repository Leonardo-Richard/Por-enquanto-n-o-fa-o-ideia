# PRD — Upload de certificado e-CNPJ pelo browser (edição da empresa monitorada)

**Fonte de descoberta:** `docs/briefing-proposta-upload-certificado-browser-edicao-empresa.md`  
**Relaciona-se com:** `docs/prd-importacao-certificado-empresa-monitorada-adn.md` (CE-FR*, CE-NFR1), `docs/prd-integracao-nfse-dist-adn.md` (**NFR19**, **FR48**), `docs/architecture-importacao-certificado-empresa-monitorada-adn.md`, `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` (runbook worker).  
**Normativa:** Este PRD descreve uma **evolução de produto** que **altera a fronteira** “sem bytes de certificado no browser” assim que aprovado e implementado com cofre e ADR. Até ao merge do **ADR** correspondente e actualização das arquitecturas, o comportamento canónico continua o definido em **CE-NFR1** / **NFR19**.

**Autor:** Morgan (PM / AIOS)  
**Data:** 2026-04-24  
**Versão:** 1.0

**Change log**

| Data       | Versão | Descrição | Autor |
| ---------- | ------ | ---------- | ----- |
| 2026-04-24 | 1.0    | PRD inicial a partir do briefing: objectivos, CE-BR*, BR-NFR*, épicos, stories, conflitos normativos. | PM |

---

## 1. Objectivos e contexto

### 1.1 Objectivos (o que o produto deve ganhar)

1. Permitir que um **admin** (ou papel equivalente com permissão de mutação de dados da empresa) **associe** o certificado **e-CNPJ (A1)** à **empresa monitorada** directamente no **portal web**, na **experiência de edição** dessa empresa, reduzindo dependência de SSH/RDP e de edição manual de `clients.local.json` na VM.
2. Garantir que o material criptográfico **nunca** fique em repositório Git, **nunca** em `NEXT_PUBLIC_*`, e **nunca** em logs de aplicação em claro (**paridade de rigor** com CE-NFR1, com **novo destino** autorizado: cofre).
3. Manter **coerência de CNPJ** entre ficheiro PKCS#12, registo da empresa no portal e validação ADN (**alinhamento** a CE-FR2 / CE-BR2).
4. Integrar o resultado com o **estado de prontidão** do certificado e com a **recolha ADN** (worker continua a executar mTLS; o portal torna-se **canal de aprovisionamento** controlado).
5. Preservar **FR48**: exportações e artefactos versionáveis **sem** segredos de certificado.

### 1.2 Contexto

O briefing de análise regista que o MVP actual **proíbe** upload de PFX no browser (**CE-NFR1**) e que a arquitectura assume que a UI **não** transporta bytes de certificado. Operadores e admins relatam **atrito**: o passo crítico está “fora” do produto, o que atrasa *onboarding* e aumenta erros de alinhamento thumbprint/PFX.

Este PRD formaliza a **intenção de produto** de aceitar o **envio** do certificado pelo browser **desde que** exista **cofre**, **transporte cifrado**, **controlo de acesso multi-tenant**, **auditoria** e **ADR** que reconcilie a decisão com **NFR19** (reformulando-a para: segredos **não** permanecem no cliente nem em storage público sem cifra; **podem** transitar uma vez por canal servidor+cofre auditável).

### 1.3 Fora de âmbito (v1 deste PRD)

- **Emissão** ou **renovação** do certificado junto da AC (continua externa).
- **Opção D** do briefing (integração com provedor cloud de certificado) — backlog futuro, não obrigatória para v1.
- Alteração ao código **upstream** do NFSE_dist — fora; eventual *wrapper* ou job de sincronização é épico técnico dependente do **ADR**.
- **Self-hosted** sem cofre: o PRD assume **cofre gerido** disponível; variantes *on-prem* exigem extensão em ADR separada.

---

## 2. Personas e permissões

| Persona | Necessidade |
| -------- | ------------ |
| **Admin da organização** | Registar ou substituir certificado da empresa sem aceder à VM. |
| **Operador de infra** | Visibilidade de *pipelines* de sincronização cofre → worker; alertas de falha. |
| **Suporte interno** | Diagnóstico com **códigos de erro** estáveis (reutilizar espírito **CE-FR10**); **sem** ver segredos. |
| **Auditor / segurança** | Rastreio de “quem carregou o quê e quando” (metadados, não chave privada). |

**Regra de autorização:** apenas identidades com a mesma **política de mutação** já exigida para dados fiscais da empresa (paridade com handlers de empresas monitoradas) podem iniciar upload ou revogação (**CE-BR6**).

---

## 3. Requisitos funcionais (**CE-BR**)

| ID | Descrição |
| -- | ----------- |
| **CE-BR1** | Na **edição** da empresa monitorada (mesmo fluxo de navegação que dados da empresa e bloco ADN), o utilizador autorizado pode **iniciar** o registo de certificado **vinculado** ao `companyId` e CNPJ dessa empresa. |
| **CE-BR2** | O sistema **valida** o PKCS#12: palavra-passe correcta, cadeia legível, e **correspondência** do titular ao **CNPJ de 14 dígitos** da empresa (Subject/SAN conforme política aprovada pelo **@architect**). Em falha, mensagens alinhadas ao tom **CE-FR10** (sem vazar paths internos). |
| **CE-BR3** | Em caso de **sucesso**, o estado exposto ao portal (ex.: *certificate readiness*, flags ADN) reflecte **material disponível para recolha** ou equivalente acordado com UX, **sem** mostrar thumbprint completo nem bytes do PFX. |
| **CE-BR4** | **Rotação:** novo upload **substitui** o material activo no cofre após validação; versões anteriores são **inactivadas** segundo política de retenção definida no **ADR** (prazo máximo, *soft delete*). |
| **CE-BR5** | **Revogação:** o utilizador autorizado pode **remover** o certificado armazenado para essa empresa; após confirmação, o worker **não** deve conseguir mTLS com material removido até novo registo. |
| **CE-BR6** | **Autorização:** upload, confirmação de rotação e revogação exigem papel com **mutação** na organização/empresa; tentativas sem permissão são **403** e auditadas. |
| **CE-BR7** | **Auditoria:** registo de evento (actor, `organizationId`, `companyId`, tipo de evento, *timestamp*, resultado) **sem** armazenar senha nem conteúdo do PFX em tabelas de auditoria. |
| **CE-BR8** | **FR48** permanece: export JSON e ficheiros versionáveis **não** incluem PFX, senha, thumbprint nem identificadores de segredo do cofre. |

---

## 4. Requisitos não funcionais (**BR-NFR**)

| ID | Descrição |
| -- | ----------- |
| **BR-NFR1** | **Transporte:** apenas **HTTPS** (TLS 1.2+); proibido segredo em query string, fragment ou cabeçalhos personalizados logados. |
| **BR-NFR2** | **Repouso:** PFX ou material equivalente **só** em cofre ou blob **cifrado** com **KMS/HSM**; chaves **não** em variáveis `NEXT_PUBLIC_*`. |
| **BR-NFR3** | **Minimização de logs:** não registar em **INFO** (nem equivalente) combinação thumbprint completo + CNPJ (**paridade CE-NFR5**); não registar nome original do ficheiro do utilizador + CNPJ se permitir inferência indevida. |
| **BR-NFR4** | **Retenção em memória:** processamento da senha e do PFX no servidor em **memória volátil** com política de descarte explícita após escrita no cofre (detalhe de implementação no ADR). |
| **BR-NFR5** | **Multi-tenant:** isolamento estrito por `organizationId` + `companyId`; testes de regressão **não** podem cruzar dados entre tenants. |
| **BR-NFR6** | **Abuso:** limite de taxa por utilizador/IP para endpoints de upload; tamanho máximo de ficheiro (ex.: ordem de megabytes acordada com **@architect**). |
| **BR-NFR7** | **Conformidade:** base legal (LGPD) para tratamento de credencial; retenção documentada; **DPIA** recomendada antes de produção. |
| **BR-NFR8** | **Integridade:** opcional *virus/malware scan* em pipeline assíncrono antes de marcar certificado como “activo” (go/no-go com custo). |

---

## 5. Decisões de produto em aberto (resolver no **ADR** + **@architect**)

1. **Opção A vs B** (upload via API vs URL pré-assinada) — ver tabela no briefing §5.  
2. **Sincronização cofre → worker:** *pull* pelo worker, *push* por job, ou mistura.  
3. **Testes e CI:** estratégia de certificados de teste (mock vs AC de homologação).  
4. **Mensagem exacta** de estados na UI (coordenação com **@po** / copy **CE-FR10**).

---

## 6. Objectivos de UX (alto nível)

### 6.1 Visão

Fluxo **curto**, **linguagem clara** sobre o que acontece com o ficheiro (“é guardado de forma cifrada e só o servidor de recolha pode usá-lo”), **sem** dar falsa sensação de que o certificado “substitui” o worker.

### 6.2 Paradigmas

- **Upload único ou substituição** com confirmação explícita em rotação.  
- **Revogação** com segundo passo (confirmar palavra “REMOVER” ou modal de risco).  
- **Erros** acionáveis (senha incorrecta, CNPJ não coincide, ficheiro corrupto).

### 6.3 Ecrãs conceptuais

1. **Edição da empresa monitorada** — nova secção “Certificado e-CNPJ (ADN)” (ou integrada ao painel ADN existente).  
2. **Estado de sucesso** — ligação ao runbook **opcional** para operador avançado (paridade com guia actual).  
3. **Histórico** (opcional v1.1) — apenas metadados (data de upload, actor), sem segredos.

### 6.4 Acessibilidade e plataformas

- **WCAG AA** para formulários, mensagens de erro e foco.  
- **Web** responsivo; upload desde browsers suportados pelo portal (lista mínima no ADR técnico).

---

## 7. Métricas de sucesso (produto)

| Métrica | Definição inicial |
| ------- | ------------------ |
| **Tempo até primeiro ADN OK** | Redução mediana do tempo entre criação da empresa e primeiro `200/204` de distribuição (baseline a definir com **@po**). |
| **Taxa de falha de upload** | % de uploads falhados por CNPJ/senha/corrupto — monitorizar para melhorar copy. |
| **Tickets de suporte** | Redução de tickets “certificado não encontrado” atribuíveis a configuração manual (avaliar trimestralmente). |

---

## 8. Riscos e mitigações

| Risco | Mitigação |
| ----- | ---------- |
| Vazamento por logs ou *crash dumps* | BR-NFR3, BR-NFR4; revisão de **@architect** em PR. |
| Confusão FR48 vs segredo | **CE-BR8**; testes de export após feature. |
| Regulamentação / responsabilidade do operador do cofre | BR-NFR7; contrato com cliente enterprise. |
| Regressão de **NFR19** mal interpretada | ADR único que redefine fronteira “browser → cofre → worker” como **canal seguro único**. |

---

## 9. Épicos e stories (para **@sm** / **@po**)

### Épico 1 — Governança e arquitectura

- **Story 1.1 — ADR “Browser → cofre → worker”**  
  **Como** equipa de produto, **quero** um ADR aprovado, **para** alterar **NFR19**/CE-NFR1 sem ambiguidade.  
  **AC:** ADR referenciado neste PRD; diagrama C4 actualizado; opção A/B escolhida.

- **Story 1.2 — Provisionamento do cofre**  
  **Como** DevOps, **quero** cofre e IAM por ambiente, **para** permitir desenvolvimento *staging* sem segredos reais em `.env` partilhado.  
  **AC:** *runbook* mínimo em `docs/qa/` ou equivalente; segredos fora do Git.

### Épico 2 — API e modelo de dados

- **Story 2.1 — Endpoint de upload (multipart)** ou **Story 2.1b — Presigned upload** (mutuamente exclusiva conforme ADR).  
  **AC:** CE-BR2, BR-NFR1–BR-NFR2, BR-NFR6; testes de integração com cofre *mock* ou sandbox.

- **Story 2.2 — Revogação e rotação**  
  **AC:** CE-BR4, CE-BR5, CE-BR7.

### Épico 3 — Interface (edição da empresa)

- **Story 3.1 — Secção de upload na edição da empresa**  
  **AC:** CE-BR1, CE-BR6, WCAG AA básico; sem segredos em `localStorage`.

- **Story 3.2 — Estados e erros na UI**  
  **AC:** Mensagens alinhadas a **CE-FR10** onde aplicável; sem thumbprint completo visível (**CE-BR3**).

### Épico 4 — Worker e observabilidade

- **Story 4.1 — Consumo do cofre no worker**  
  **AC:** Paridade com `NFSE_dist` (PFX em disco seguro ou outro mecanismo aprovado no ADR); smoke **CE-FR7** actualizado com nota “origem cofre”.

- **Story 4.2 — Métricas e alertas**  
  **AC:** Dashboards mínimos ou logs estruturados para métricas da secção 7.

---

## 10. Dependências de documentação (pós-implementação)

Quando o **ADR** e a primeira versão **estiverem merged:**

1. Actualizar `docs/prd-importacao-certificado-empresa-monitorada-adn.md` (secção “fora de âmbito” e **CE-NFR1** — referência cruzada “ver PRD upload browser”).  
2. Actualizar `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` (diagrama browser → API → cofre → worker).  
3. Actualizar `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` §6 (“relação com o portal”) com o novo fluxo.

---

## 11. Prompts para outros agentes

**@architect:** Entregar ADR com STRIDE resumido, escolha A/B, modelo de chaves, rotação, ameaça de *replay* de upload, e política de *backups* do cofre.

**@po:** Quebrar épicos 2–3 em stories de sprint com DoR (cofre em staging) e critérios de aceite de copy.

**@qa:** Matriz de testes: permissões, CNPJ errado, senha errada, ficheiro corrupto, tenant cruzado, revogação, export FR48.

---

## 12. Referências

- `docs/briefing-proposta-upload-certificado-browser-edicao-empresa.md`  
- `docs/prd-importacao-certificado-empresa-monitorada-adn.md`  
- `docs/prd-integracao-nfse-dist-adn.md`  
- `docs/architecture-importacao-certificado-empresa-monitorada-adn.md`  
- `docs/briefing-importacao-certificado-empresa-monitorada-adn.md`  
- UI: `apps/web/src/app/(dashboard)/empresas/[id]/`

---

— **Morgan (PM / AIOS)** — PRD criado a partir do briefing; aguardando **ADR** para desbloquear implementação.
