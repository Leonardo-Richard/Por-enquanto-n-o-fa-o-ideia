# PRD — Importação e configuração do certificado e-CNPJ (empresa monitorada → recolha ADN)

**Fontes:** `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` (project brief / briefing operacional), `docs/briefing-integracao-nfse-dist-adn.md`, `docs/prd-integracao-nfse-dist-adn.md` (**NFR19**, **FR48**, decisão “certificado só no worker”), [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) (comportamento de referência).

**Normativa:** Em caso de conflito sobre **onde** e **como** o certificado pode existir (browser vs worker vs repositório), **prevalece** `docs/prd-integracao-nfse-dist-adn.md` (**NFR19**) e o PRD principal (`docs/prd.md`) quanto a segredos e fronteiras de produto.

**Change log:**

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 1.0    | PRD inicial a partir do briefing: objetivos, CE-FR1–CE-FR12, CE-NFR1–CE-NFR8, UX mínima, épicos e stories. |

---

## 1. Objetivos de produto

1. Tornar **reproduzível e auditável** o processo pelo qual cada **empresa monitorada** (CNPJ contribuinte) passa a ter **certificado e-CNPJ (A1)** disponível no **ambiente do worker** de recolha ADN, de modo compatível com o cliente de referência **NFSE_dist** (loja Windows + thumbprint **ou** PFX em disco + `senha_cert`).
2. Reduzir falhas de primeira execução (“TLS falhou”, “certificado não encontrado”, thumbprint vs PFX incoerentes) através de **documentação**, **checklists** e **critérios de verificação** alinhados ao código upstream.
3. Garantir que **nenhuma** orientação de produto sugira upload de PFX ou chave privada **no portal web** ou em canais inseguros; o utilizador final **admin** só vê fluxos e estados que **não** expõem segredos criptográficos.
4. **Métrica de sucesso (MVP deste incremento):** equipa interna ou parceiro consegue, seguindo apenas artefactos versionados em `docs/`, cumprir o checklist do briefing e obter **200/204** na distribuição ADN sem erro fatal de TLS, com artefactos sob `data/<CNPJ>/` no worker de referência (paridade com smoke do briefing).

---

## 2. Contexto e problema

A recolha de **XML** (DF-e) e **PDF** (DANFSE) no ADN exige **mTLS** com certificado **ICP-Brasil e-CNPJ** do **mesmo** contribuinte. O repositório **NFSE_dist** encapsula duas modalidades técnicas; a detecção automática por CNPJ no *Subject* do certificado **falha** em cenários reais se o operador não souber que deve fixar **thumbprint** e **cert_store**.

**Problema:** sem PRD, o briefing operacional não tem **priorização**, **donos**, **critérios de aceite** para evoluções (ex.: ligação ao portal, runbooks por ambiente) nem **requisitos não funcionais** explícitos de segurança e conformidade com **NFR19**.

**Solução de produto (MVP):** PRD que fixa requisitos de **documentação**, **governação de segredos** e **preparação para** integração futura (cofre no worker, `clients.local.json` fora do Git), sem obrigar, no MVP, a uma UI nova no portal além do que já estiver previsto no incremento ADN.

---

## 3. Fora de âmbito (MVP deste PRD)

- Implementação de **cofre** específico (Azure Key Vault, HashiCorp Vault, etc.) — apenas requisitos e interfaces conceituais (**CE-NFR**).
- **Emissão** ou **renovação** do certificado junto da AC — permanece processo externo; o PRD exige **checklist de validade** e lembrete operacional.
- Alteração do código do **NFSE_dist** upstream — fora de escopo; eventual **fork** ou patch é épico técnico separado.
- **Upload de PFX** por drag-and-drop no browser — **explicitamente proibido** no MVP (**CE-NFR1**).

---

## 4. Personas

| Persona | Necessidade |
| -------- | ----------- |
| **Operador de infra / DevOps** | Passos claros por SO, variáveis, paths, verificação de logs; política de não versionar segredos. |
| **Admin da organização (portal)** | Entender que a recolha ADN depende de **worker** e certificado **fora** do site; aceder a **guia** ou link oficial sem ver chaves. |
| **Suporte interno** | Diagnosticar “certificado errado / loja errada / thumbprint” com matriz de causas raiz documentada. |

---

## 5. Requisitos funcionais

Identificadores **CE-FR** (certificado × empresa monitorada × ADN).

| ID | Descrição |
| -- | ----------- |
| **CE-FR1** | O produto deve manter documentação versionada que descreva as **duas modalidades** do NFSE_dist: (A) loja Windows + `thumbprint` + `cert_store`; (B) `certificates/<CNPJ>.pfx` + `senha_cert` em `clients.local.json`, incluindo a regra de precedência (**thumbprint** activa `curl`/Schannel em detrimento do PFX). |
| **CE-FR2** | A documentação deve exigir **CNPJ com 14 dígitos** coerente entre empresa monitorada (portal), `clients.json` e nome do ficheiro PFX quando aplicável. |
| **CE-FR3** | O produto deve documentar o procedimento de **instalação** do `.pfx` em `CurrentUser` vs `LocalMachine`, com aviso sobre **contexto do processo** (tarefa agendada vs utilizador interactivo) alinhado ao README upstream. |
| **CE-FR4** | A documentação deve explicar a limitação da **detecção automática** por *Subject* (PowerShell) e mandar **thumbprint explícito** quando o CNPJ não constar no *Subject*. |
| **CE-FR5** | O produto deve incluir **checklist** reproduzível (equivalente ao §5 do briefing) com caixas de verificação lógicas: CNPJ, validade do certificado, modalidade A ou B, ficheiros presentes, teste menu **1**, revisão de `logs/execucao.log`, ajuste de workers PDF em caso de **429/503**. |
| **CE-FR6** | A documentação deve referenciar **explicitamente** o repositório [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist), `clients.example.json` e `Manual.pdf` como fontes de verdade complementares quando existirem divergências de versão. |
| **CE-FR7** | O produto deve declarar **critérios de smoke** mensuráveis: resposta HTTP **200** com payload processável ou **204** sem documentos novos; ausência de erro fatal TLS no log; presença de saída sob `data/<CNPJ>/` após execução bem sucedida. |
| **CE-FR8** | A documentação deve relacionar este fluxo com **FR48** (export conceptual `clients.json` **sem** segredos) e **NFR19** (segredos só no worker/cofre), para que operadores não misturem export do portal com `clients.local.json`. |
| **CE-FR9** | Quando o incremento ADN no portal expuser **“Sincronização ADN”** ou equivalente (**FR41–FR42**), a UI ou ajuda contextual deve **ligar** (hyperlink ou texto curto) ao runbook de certificado **sem** solicitar upload de certificado no browser (**CE-NFR1**). |
| **CE-FR10** | O produto deve definir **mensagens de erro amigáveis** (tabela mínima) para as falhas mais frequentes na fase de importação/configuração: certificado não encontrado; PFX inexistente ou senha errada; thumbprint inválido; `curl.exe` ausente; loja incorrecta. |
| **CE-FR11** | A documentação deve cobrir **rotação de certificado**: substituição do PFX ou thumbprint, validação de data **NotAfter**, e reexecução do smoke após rotação. |
| **CE-FR12** | O produto deve exigir que **qualquer** exemplo de `clients.local.json` em repositório use **apenas placeholders** (`THUMBPRINT_EXEMPLO`, senha fictícia); exemplos reais ficam em gestão de segredos fora do Git. |

---

## 6. Requisitos não funcionais

| ID | Descrição |
| -- | ----------- |
| **CE-NFR1** | **Proibido** armazenar ou transmitir PFX, chave privada ou senha de PFX através do **portal web** ou `NEXT_PUBLIC_*`; instruções operacionais limitam-se a VM/worker seguro. |
| **CE-NFR2** | Ficheiros `clients.local.json` e `*.pfx` devem estar em **`.gitignore`** nos repositórios que os gerem; PRs que os incluam devem falhar em revisão. |
| **CE-NFR3** | Permissões de sistema de ficheiros no worker: apenas contas de serviço necessárias leem PFX e `clients.local.json` (**princípio do mínimo privilégio**). |
| **CE-NFR4** | Backups que contenham PFX devem ser **cifrados**; a documentação deve mencionar o risco de cópia não cifrada. |
| **CE-NFR5** | Logs da aplicação **não** podem gravar thumbprints completos + CNPJ em conjunto em nível **INFO** em ambientes partilhados (orientação; detalhe de máscara em implementação de logging). |
| **CE-NFR6** | Compatibilidade: documentação primária **Windows 10/11** + Python **3.11+** + `curl.exe` no PATH, conforme upstream. |
| **CE-NFR7** | **Rastreabilidade:** alterações ao runbook de certificado entram no **change log** do PRD ou do documento técnico associado, com data. |
| **CE-NFR8** | **LGPD / segurança da informação:** o PRD não expande tratamento de dados pessoais além do necessário; reforça que o certificado é **credencial de infraestrutura**, não dado de utilizador final do portal. |

---

## 7. User Interface Design Goals (MVP)

### Overall UX Vision

**Documentação em primeiro lugar:** linguagem clara para operador, tabelas de decisão (A vs B), avisos de segurança visíveis. No portal, **transparência** sem pedir ficheiros sensíveis: texto do tipo “A recolha ADN corre num servidor seguro; o certificado da empresa é instalado apenas nesse ambiente — ver guia”.

### Key Interaction Paradigms

- **Hiperligação guia ↔ ecrã ADN:** quando existir UI ADN, **CE-FR9** assegura descoberta do runbook.
- **Offline-first para segredos:** tudo que for sensível acontece na VM, não no browser.

### Core artefactos (conceito “ecrã”)

1. **Runbook markdown** (`docs/briefing-importacao-certificado-empresa-monitorada-adn.md` e/ou secção dedicada num guia de operações).  
2. **Secção “Ajuda / Certificado ADN”** (ou equivalente) na experiência de empresa monitorada — *fase alinhada a **CE-FR9**; pode ser story única se ainda não existir navegação.*  
3. **Tabela de mensagens** (**CE-FR10**) incorporada ao runbook ou à base de conhecimento de suporte.

### Accessibility

Conteúdo web derivado: **WCAG AA** para textos de ajuda e links (contraste, foco), alinhado ao PRD principal.

### Target platforms

**Windows** no worker; documentação pode ser lida em qualquer SO.

---

## 8. Premissas técnicas (para arquitetura)

- Monorepo actual continua com **worker externo** para ADN (**briefing integração**).
- O formato `clients.json` / `clients.local.json` permanece o **contrato conceptual** com o NFSE_dist até existir substituição aprovada por ADR.
- `docs/qa/adn-staging-setup.md` permanece referência para **API portal**; este PRD não duplica endpoints internos.

---

## 9. Lista de épicos

1. **Épico 1 — Runbook e requisitos:** consolidar briefing + CE-FR/CE-NFR em documentação única de operação, exemplos seguros e tabela de erros.  
2. **Épico 2 — Descoberta no produto:** ligação da UI ADN (quando existir) ao runbook e textos de **CE-FR9** / **CE-FR10** sem recolha de segredo no browser.

---

## 10. Épico 1 — Runbook e requisitos

**Objetivo:** Entregar um pacote documental que permita a qualquer operador qualificado repetir a importação/configuração do certificado sem ambiguidade e em conformidade com **NFR19** / **CE-NFR1**.

### Story 1.1 — Consolidar runbook único

**Como** operador de infra,  
**quero** um único documento com ordem de passos, modalidades A/B e precedência thumbprint vs PFX,  
**para** executar o procedimento sem consultar múltiplas fontes inconsistentes.

**Critérios de aceite:**

1. Documento em `docs/` inclui fluxograma textual ou tabela “se tem thumbprint → ramo curl; senão → PFX”.  
2. Referências cruzadas a `briefing-importacao-certificado-empresa-monitorada-adn.md` e `prd-integracao-nfse-dist-adn.md` (NFR19, FR48) estão correctas.  
3. **CE-FR1** a **CE-FR8** e **CE-FR12** estão espelhados ou linkados de forma verificável.

### Story 1.2 — Matriz de erros e smoke

**Como** suporte interno,  
**quero** tabela causa → sintoma → acção para falhas comuns e o script de smoke,  
**para** reduzir tempo de resolução.

**Critérios de aceite:**

1. **CE-FR10** cumprida com pelo menos **cinco** linhas na matriz.  
2. **CE-FR7** reproduzível: passos explícitos para validar `logs/execucao.log` e pasta `data/<CNPJ>/`.  
3. **CE-FR11** documenta rotação em bullets numerados.

### Story 1.3 — Política de segredos e exemplos

**Como** responsável de segurança,  
**quero** `.gitignore` e exemplos apenas com placeholders,  
**para** evitar vazamento acidental.

**Critérios de aceite:**

1. Repositório que versionar templates de `clients.local.json` usa **apenas** placeholders (**CE-FR12**).  
2. **CE-NFR2** verificável em código ou doc “Contributing” / README do worker (onde aplicável).  
3. **CE-NFR3** e **CE-NFR4** mencionados no runbook (parágrafos curtos).

---

## 11. Épico 2 — Descoberta no produto

**Objetivo:** Quando a UI de sincronização ADN estiver disponível (**FR41–FR42**), o utilizador **admin** encontra orientação de certificado **sem** ser solicitado a carregar PFX.

### Story 2.1 — Link contextual para o runbook

**Como** admin da organização,  
**quero** ver na área ADN da empresa monitorada uma explicação curta e link para o guia de certificado,  
**para** saber que o passo crítico ocorre no worker e não no browser.

**Critérios de aceite:**

1. **CE-FR9** cumprido: hyperlink para `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` (ou URL pública equivalente se o doc for publicado noutro sítio).  
2. Texto explicita **CE-NFR1** em linguagem de produto (sem jargão de “mTLS” obrigatório).  
3. Não existe campo de formulário para upload de PFX neste incremento.

---

## 12. Riscos e mitigações

| Risco | Mitigação |
| ----- | ---------- |
| Operador coloca PFX no repositório | **CE-NFR2** + revisão + eventual regra CI `git-secrets`. |
| Certificado correcto mas loja `LocalMachine` inacessível ao processo | Documentar conta de serviço e teste com menu **4** (**CE-FR3**). |
| ADN altera formato JSON | Monitorização de erros no worker; épico técnico separado no backlog do integrador. |

---

## 13. Próximos passos sugeridos

- **@architect:** Actualizar `docs/architecture-integracao-nfse-dist-adn.md` com secção “Materialização de segredos no worker” se ainda não existir, referenciando este PRD.  
- **@sm:** Gerar story técnica única para **Story 2.1** quando a UI ADN da empresa monitorada estiver em desenvolvimento activo.  
- **UX:** Revisar wording de **CE-FR10** para tom de voz do produto.

---

## 14. UX Expert Prompt (breve)

Rever o texto de ajuda da área ADN da empresa monitorada: duas frases + link “Como configurar o certificado no servidor de recolha”, sem solicitar ficheiros sensíveis; WCAG AA nos links.

---

## 15. Architect Prompt (breve)

Garantir que o desenho do worker (secrets, paths `certificates/`, geração de `clients.local.json`) satisfaz **CE-NFR1–CE-NFR4** e não duplica PFX em Storage público; referenciar este PRD na ADR de worker se existir.

---

— **Morgan (PM / AIOS)** — PRD derivado do briefing de certificado; pronto para desdobramento em stories.
