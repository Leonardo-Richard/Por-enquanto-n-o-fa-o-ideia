# PRD — Instalação de certificado e-CNPJ pela experiência do utilizador (empresa monitorada × ADN)

**Produto:** Portal de Automação de Notas Fiscais  
**Fonte primária:** [`docs/briefing-alteracao-instalacao-certificado-empresa-monitorada-utilizador.md`](briefing-alteracao-instalacao-certificado-empresa-monitorada-utilizador.md)  
**Documentos relacionados (norma e continuidade):**

- [`docs/prd-importacao-certificado-empresa-monitorada-adn.md`](prd-importacao-certificado-empresa-monitorada-adn.md) — requisitos **CE-FR\*** / **CE-NFR\*** (MVP documentação + guia no portal).  
- [`docs/briefing-importacao-certificado-empresa-monitorada-adn.md`](briefing-importacao-certificado-empresa-monitorada-adn.md) — runbook operacional único (modalidades A/B, **CE-FR1**).  
- [`docs/prd-integracao-nfse-dist-adn.md`](prd-integracao-nfse-dist-adn.md) — **NFR19**, **FR48**, **FR41–FR42**.  
- Stories: [`docs/stories/incremento-certificado-adn-guia-portal.md`](stories/incremento-certificado-adn-guia-portal.md) (**CER-04** e conjunto **CER**).

**Normativa de conflito:** Em caso de conflito sobre **fronteira browser ↔ backend ↔ worker**, prevalecem, por ordem: **NFR19** e **CE-NFR1** do PRD de integração / certificado **até** este PRD registar uma **emenda aprovada** (secção 5.2) com data e versão. O presente PRD **não** revoga documentos anteriores sem essa emenda.

**Change log:**

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 1.0    | PRD inicial a partir do briefing de alteração: trilhos A–D, fases, requisitos UIP-FR e UIP-NFR, épicos e stories. |

---

## 1. Resumo executivo

O negócio pretende que o **admin da organização** (utilizador do portal) seja **capaz de instalar** — ou **concluir com visibilidade** — o certificado **e-CNPJ (A1)** associado a cada **empresa monitorada**, alinhado à recolha **ADN** (mTLS). O briefing desdobra **quatro leituras** do verbo “instalar”. Este PRD:

1. Fixa **fases de entrega** com **MVP recomendado** na **Leitura A** (estado + verificação + guia; sem upload de material criptográfico no browser).  
2. Define requisitos **UIP-FR** / **UIP-NFR** para o MVP e para **extensões** (Leituras B–D) como **roadmap condicionado** a decisão de produto e **ADR** de segurança quando aplicável.  
3. Mantém **paridade** com o comportamento de referência **NFSE_dist** no worker (**CE-FR1**).

---

## 2. Objetivos de produto

1. **Reduzir fricção:** o admin deixa de depender apenas de documentação estática para saber se “o certificado daquela empresa está pronto” para o ADN.  
2. **Correlação 1:1:** qualquer estado, acção ou erro de certificado no portal está **ligado** ao identificador da **empresa monitorada** e ao **CNPJ** (14 dígitos), sem ambiguidade multi-tenant.  
3. **Segurança preservada no MVP:** no **Fase 1**, nenhum PFX, chave privada ou senha transita pelo browser nem aparece em `NEXT_PUBLIC_*` (**CE-NFR1** inalterado na letra).  
4. **Métrica de sucesso (Fase 1):** após o operador concluir a instalação técnica no worker (runbook existente), o portal reflecte **estado “pronto”** ou **“erro categorizado”** coerente com **CE-FR10** / mapeamentos **CER-05**, e o smoke ADN (**CE-FR7**) é **atingível** sem passos não documentados.  
5. **Métrica de sucesso (Fase 2, se aprovada):** admin consegue **entregar** certificado ao sistema via canal **aprovado em ADR** (upload para cofre ou equivalente), com auditoria e rotação documentadas (**UIP-NFR6–8**).

---

## 3. Contexto e problema

### 3.1 Linha de base

Hoje a **instalação criptográfica** ocorre no **servidor de recolha** (worker). O portal **orienta** (**CE-FR9**, **CER-04**) mas **não** oferece self-service de instalação nem **estado verificável** por empresa na mesma narrativa que o pedido de negócio descreve.

### 3.2 Problema

Admins **não distinguem** facilmente “empresa criada no portal” de “empresa pronta para ADN com TLS válido”. Suporte e operações gastam tempo a **confirmar** manualmente logs e ficheiros no worker.

### 3.3 Solução (encapsulada em fases)

- **Fase 1 (MVP deste PRD):** experiência de **instalação assistida** no portal = **checklist**, **estado** e **verificação** (e opcionalmente integração com pipeline / webhook **fora de escopo obrigatório** do MVP salvo story dedicada).  
- **Fases 2–4:** ver secção 5 (trilhos B–D).

---

## 4. Personas e stakeholders

| Persona / papel | Necessidade |
| ---------------- | ----------- |
| **Admin da organização (portal)** | Ver **estado** do certificado por empresa monitorada; seguir passos ou solicitar ajuda; no roadmap avançado, **carregar** ou **pedir** instalação gerida. |
| **Operador de infra / DevOps** | Manter runbook; receber sinais (webhook opcional) quando estado no portal mudar; aplicar PFX/thumbprint no worker. |
| **Suporte interno** | Diagnosticar com **matriz de erros** existente (**CE-FR10**) + estado no portal. |
| **Segurança / compliance** | Aprovar ou bloquear **Fase 2**; custódia de chaves; evidências de auditoria (**UIP-NFR7**). |

---

## 5. Decisão de produto: trilhos e fases

### 5.1 Trilhos (espelho do briefing)

| ID trilho | Nome | Descrição resumida |
| --------- | ---- | ------------------- |
| **A** | Worker + portal (estado) | Instalação técnica **continua no worker**; portal = guia + **estado** + verificação. |
| **B** | Upload para cofre | Admin envia PFX (ou pacote aprovado) a **endpoint seguro** → **cofre** → worker consome por CNPJ. |
| **C** | Emissão / AC | Integração com AC ou CSR no portal. |
| **D** | Instalação gerida | Workflow tipo ticket / parceiro com SLA visível. |

### 5.2 Emenda normativa (apenas se **Trilho B** for aprovado)

Se `@po` aprovar **Trilho B**, deve existir linha neste change log e em **ADR** com: modelo de ameaças resumido; confirmação de que **material criptográfico não** é exposto em respostas JSON públicas nem em `NEXT_PUBLIC_*`; e **emenda** a **CE-NFR1** limitada a: *“é permitido **upload** apenas para serviço backend autenticado, com armazenamento em cofre certificado pela equipa de segurança; proibido processar PFX apenas no browser sem round-trip a cofre.”*

Até essa emenda, **CE-NFR1** permanece na redacção actual do PRD de certificado.

### 5.3 Priorização recomendada (PM)

| Fase | Trilho | Inclusão |
| ---- | ------ | -------- |
| **Fase 1 — MVP** | **A** | Obrigatório neste PRD. |
| **Fase 2** | **B** | Opcional; **gate** = ADR + segurança + emenda **5.2**. |
| **Fase 3** | **D** | Opcional; menor risco criptográfico; depende de processo comercial/OPS. |
| **Fase 4** | **C** | Backlog distante salvo requisito explícito de negócio. |

---

## 6. Fora de âmbito

- **Fase 1:** implementação obrigatória de **cofre** concreto (Key Vault, etc.) — apenas menção como dependência de **Fase 2**.  
- **Fase 1:** alteração ao código **upstream NFSE_dist** — fora de âmbito.  
- **Trilho C** sem PRD comercial separado — fora de âmbito do MVP.  
- Duplicar o **runbook canónico** em segundo ficheiro paralelo — **proibido** sem ADR (regra **CER-01**).

---

## 7. Requisitos funcionais (**UIP-FR**)

Identificadores novos; não substituem **CE-FR\*** — complementam.

### 7.1 Fase 1 (Trilho A) — obrigatórios

| ID | Descrição |
| -- | ----------- |
| **UIP-FR1** | Por cada **empresa monitorada** com ADN activável para a organização, o portal deve expor **estado de preparação de certificado** com pelo menos: `pendente_verificacao`, `pronto`, `erro` (ou granularidade equivalente acordada com UX), sempre **correlacionado** ao `companyId` / CNPJ. |
| **UIP-FR2** | O utilizador admin deve poder **disparar** uma **verificação** (consulta ao backend que reflecte capacidade TLS/cofre/worker — mecanismo técnico em story) **sem** enviar PFX pelo browser. |
| **UIP-FR3** | A UI deve **ligar** ao runbook canónico [`briefing-importacao-certificado-empresa-monitorada-adn.md`](briefing-importacao-certificado-empresa-monitorada-adn.md) (ou URL pública equivalente) e reutilizar / alinhar copy a **CE-FR9**. |
| **UIP-FR4** | Em estado `erro`, apresentar **mensagem segura** alinhada à matriz **CE-FR10** / contratos **CER-05** (sem paths completos, sem thumbprint completo + CNPJ em conjunto em superfície pública — **CE-NFR5**). |
| **UIP-FR5** | O export **FR48** permanece **sem** segredos; a nova UI **não** mistura export com `clients.local.json` (**CE-FR8**). |

### 7.2 Fase 2 (Trilho B) — condicionados a ADR

| ID | Descrição |
| -- | ----------- |
| **UIP-FR6** | Fluxo autenticado de **upload** (ou importação por API segura) de material de certificado para **cofre**, com **limite de tamanho**, **tipos MIME** permitidos e **retenção** definidos em spec de segurança. |
| **UIP-FR7** | Associação explícita upload ↔ **empresa monitorada** (CNPJ) com validação de que o certificado **contém** ou **representa** o contribuinte esperado (regra exacta: `@architect` + ICP-Brasil). |
| **UIP-FR8** | Fluxo de **rotação**: substituir certificado sem perda de visibilidade de estado; notificar admin do resultado. |

### 7.3 Fase 3 (Trilho D)

| ID | Descrição |
| -- | ----------- |
| **UIP-FR9** | Acção “**Solicitar instalação**” (ou equivalente) que cria pedido rastreável (ticket / fila) com **estado** (`aberto`, `em_progresso`, `concluido`, `cancelado`) e **SLA** textual ou calculado quando dados existirem. |

### 7.4 Fase 4 (Trilho C)

| ID | Descrição |
| -- | ----------- |
| **UIP-FR10** | *(Placeholder de roadmap)* Integração com emissão/renovação via AC — só entra no âmbito com PRD de parceria AC e `@po` explícito. |

---

## 8. Requisitos não funcionais (**UIP-NFR**)

| ID | Descrição | Fase |
| -- | ----------- | ---- |
| **UIP-NFR1** | **Multi-tenant:** estados e operações de certificado **isolados** por `organizationId`; testes devem cobrir tentativa de cruzamento de contexto. | 1+ |
| **UIP-NFR2** | **A11y:** novos CTAs e estados em **WCAG 2.1 AA** (foco, contraste, `aria-live` para mudanças de estado críticas), alinhado a **CER-04**. | 1+ |
| **UIP-NFR3** | **Rate limiting** na verificação on-demand (**UIP-FR2**) para evitar abuso e custo no worker. | 1 |
| **UIP-NFR4** | **Observabilidade:** eventos de mudança de estado (sem segredos) disponíveis para suporte; nível de log definido com **CE-NFR5**. | 1+ |
| **UIP-NFR5** | **Fase 2:** trânsito **TLS 1.2+** end-to-end até cofre; PFX **nunca** em log **INFO**; memória volátil mínima no processamento. | 2 |
| **UIP-NFR6** | **Fase 2:** cifra em **repouso** no cofre; chaves geridas pela plataforma escolhida. | 2 |
| **UIP-NFR7** | **Fase 2:** **auditoria** (quem carregou, quando, para qual empresa — sem armazenar senha em claro). | 2 |
| **UIP-NFR8** | **Fase 2:** política de **retenção** e eliminação segura na revogação/substituição. | 2 |

---

## 9. UX e UI

### 9.1 Visão

**Fase 1:** Na área **Sincronização ADN** da empresa monitorada (ou secção adjacente), bloco **“Certificado para o ADN”** com: estado; botão **“Verificar de novo”**; link ao runbook; texto curto recordando que a chave **não** é instalada no browser.

### 9.2 Paradigmas

- **Transparência:** distinguir “configuração no portal” vs “configuração no worker”.  
- **Sem falsos positivos:** estado `pronto` só após critérios objectivos acordados na story técnica (ex.: healthcheck que replica pré-condições **CE-FR7** sem expor segredos).

### 9.3 Estados mínimos (Fase 1)

| Estado (chave) | Significado para o utilizador |
| --------------- | ----------------------------- |
| `pendente_verificacao` | Ainda não foi possível confirmar; siga o guia no servidor ou clique em verificar. |
| `pronto` | O sistema considera o worker preparado para aquele CNPJ (definição técnica na story). |
| `erro` | Há bloqueio; mensagem amigável + código interno estável se aplicável (**CER-05**). |

*(Nomes finais podem ser PT na UI; chaves internas em inglês.)*

---

## 10. Dependências técnicas e integração

- **Painel ADN existente** (`adn-sync-panel.tsx` e APIs **ADN**): extensão natural para **UIP-FR1–FR4**.  
- **Worker / NFSE_dist:** fonte de verdade para TLS; verificações podem ser **proxy** via API portal → worker ou **job** assíncrono — **decisão de arquitectura** em ADR ou `docs/architecture-importacao-certificado-empresa-monitorada-adn.md`.  
- **CER-05:** mapeamento `error_code` deve alimentar **UIP-FR4**.

---

## 11. Épicos e stories (desdobramento)

### Épico UIP-1 — Estado e verificação (Fase 1 / Trilho A)

**Objetivo:** Cumprir **UIP-FR1–UIP-FR5**, **UIP-NFR1–UIP-NFR4**.

| Story | Como / quero / para | AC de alto nível |
| ----- | ------------------- | ---------------- |
| **UIP-1.1** | Como admin, quero **ver o estado** do certificado na ficha da empresa monitorada, para saber se posso sincronizar ADN. | Estado visível; correlacionado à empresa; a11y. |
| **UIP-1.2** | Como admin, quero **verificar** o estado on-demand, para actualizar a UI após o operador configurar o worker. | Botão dispara API; loading/erro; rate limit (**UIP-NFR3**). |
| **UIP-1.3** | Como admin, quero **link e copy** alinhados ao runbook, para completar passos no servidor. | **UIP-FR3**; sem campo de upload. |
| **UIP-1.4** | Como suporte, quero **mensagens** consistentes com **CE-FR10** / **CER-05**, para fechar incidentes. | **UIP-FR4**; sem vazamento de paths/senhas. |

### Épico UIP-2 — Entrega segura ao cofre (Fase 2 / Trilho B)

**Objetivo:** **UIP-FR6–UIP-FR8**, **UIP-NFR5–UIP-NFR8**. **Gate:** ADR + emenda **5.2**.

| Story | Como / quero / para | AC de alto nível |
| ----- | ------------------- | ---------------- |
| **UIP-2.1** | Como admin aprovado, quero **carregar** certificado para o cofre associado à empresa, para self-service real. | Upload autenticado; validação; auditoria (**UIP-NFR7**). |
| **UIP-2.2** | Como admin, quero **substituir** certificado, para rotação sem contactar suporte. | **UIP-FR8**; revogação segura (**UIP-NFR8**). |

### Épico UIP-3 — Instalação gerida (Fase 3 / Trilho D)

**Objetivo:** **UIP-FR9** — integração com ferramenta de ticket ou fila interna; SLA copy.

### Épico UIP-4 — Emissão AC (Fase 4 / Trilho C)

**Objetivo:** **UIP-FR10** — apenas após PRD de parceria.

---

## 12. Riscos e mitigações

| Risco | Mitigação |
| ----- | ---------- |
| Estado `pronto` incorrecto (falso positivo) | Critérios técnicos explícitos na story; testes com worker de staging; **@qa** no gate. |
| Fase 2 sem modelo de ameaças | **Bloquear** desenvolvimento até **ADR** + sign-off segurança. |
| Sobrecarga do worker com verificações | **UIP-NFR3**; cache curta com TTL transparente na UI. |
| Narrativa conflituosa com **CER-04** | Copy unificada: “instalar no **servidor de recolha**”; portal **verifica** — alinhar com `@po`. |

---

## 13. Métricas e aceitação global

| Métrica | Definição | Fase |
| ------- | --------- | ---- |
| **Taxa de resolução em self-service** | % de empresas que passam de `pendente` → `pronto` sem ticket em N dias | 1 |
| **Tempo até primeiro sync ADN válido** | Mediana entre criação empresa e primeiro **200/204** | 1 |
| **Incidentes de vazamento** | 0 PFX/senhas em logs públicos | 1+ |

---

## 14. Próximos passos operacionais

1. **`@po`** — Confirmar **Fase 1** como MVP e posicionar **B/C/D** no roadmap; registar na linha de decisão (tabela abaixo).  
2. **`@architect`** — Desenhar **fonte de verdade** do estado `pronto` (polling worker vs job vs secret scan).  
3. **`@sm`** — Gerar stories **UIP-1.x** com DoR/DoD; actualizar [`incremento-certificado-adn-guia-portal.md`](stories/incremento-certificado-adn-guia-portal.md) ou novo ficheiro de incremento **UIP** sem violar **CER-01**.  
4. **`@dev`** — Implementar após stories priorizadas.

### Registo de decisão (preencher por `@po`)

| Data | Trilho MVP | Trilhos roadmap | Assinatura |
| ---- | ---------- | ----------------- | ---------- |
| *(pendente)* | A (recomendado) | B / D / C conforme tabela §5.3 | *(nome)* |

---

## 15. Prompts para outros agentes

**UX:** Bloco “Certificado para o ADN” com hierarquia: estado → CTA verificar → link runbook → alerta segurança; não solicitar ficheiros na Fase 1.

**Architect:** Contrato API para **UIP-FR2**; para Fase 2, diagrama de dados cofre ↔ worker; ameaças STRIDE resumidas.

**QA:** Matriz de testes multi-tenant; regressão **CER-04**; tentativas de injeção de ficheiros na Fase 2.

---

— **Morgan (PM / AIOS)** — PRD completo derivado do briefing de alteração; pronto para validação `@po` e desdobramento `@sm`.
