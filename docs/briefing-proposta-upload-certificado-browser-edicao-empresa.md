# Briefing — Proposta: registo de certificado e-CNPJ pelo browser (ecrã de edição da empresa monitorada)

**Tipo:** briefing de descoberta / mudança de produto (pré-ADR)  
**Pedido de negócio:** permitir que o **utilizador** envie ou registe o **certificado digital da empresa monitorada** a partir do **browser**, na **tela de edição** da empresa, com persistência segura após o registo.  
**Data:** 2026-04-24  
**Autor:** analista (Atlas / AIOS) — documento de entrada para **@pm**, **@architect** e **@po**  
**Estado:** **Proposta** — **não** altera sozinha os PRDs nem a arquitectura vigente até aprovação formal.

---

## 1. Sumário executivo

Hoje o produto assume, de forma **normativa**, que **PFX, chave privada e senha** **não** passam pelo portal web (**CE-NFR1** em `docs/prd-importacao-certificado-empresa-monitorada-adn.md`; **NFR19** em `docs/prd-integracao-nfse-dist-adn.md`; `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` §1–2). O certificado materializa-se apenas no **worker** (Windows + NFSE_dist ou equivalente).

Este briefing regista a **intenção** de inverter parcialmente essa fronteira: **capturar** o certificado (ou credencial equivalente) **na UI de edição da empresa monitorada**, com **HTTPS** e **sessão autenticada**, para **deixar de depender exclusivamente** de operação manual na VM.

**Conclusão para decisão:** trata-se de **mudança de arquitectura e de risco de segurança**, não de “mais um campo no formulário”. Exige **ADR**, revisão de **CE-NFR1** / **NFR19** (ou excepção documentada), desenho de **cofre**, contratos de **rotação/revogação**, e alinhamento **LGPD / ICP-Brasil** (tratamento de credencial de infraestrutura).

---

## 2. Problema que o pedido pretende resolver

| Dor actual (operador / admin) | O que a proposta promete |
| ----------------------------- | ------------------------ |
| Instalação manual na VM, `clients.local.json`, thumbprint vs PFX difíceis de explicar | Fluxo guiado no portal, “um sítio” para associar certificado à empresa |
| Desalinhamento entre CNPJ no portal e material criptográfico no worker | Registo explícito no momento da edição da empresa |
| Suporte lento quando o certificado falha | Menos passos externos — *se* a implementação for robusta |

---

## 3. Estado normativo actual (para não haver ambiguidade)

- **PRD certificado — fora de âmbito MVP:** “**Upload de PFX** por drag-and-drop no browser — **explicitamente proibido** no MVP (**CE-NFR1**).” (`docs/prd-importacao-certificado-empresa-monitorada-adn.md` §3.)  
- **CE-NFR1:** proibido armazenar ou transmitir PFX/chave/senha através do **portal web** ou `NEXT_PUBLIC_*`.  
- **Arquitectura:** “`UI` **não** envia nem recebe bytes de certificado” (`docs/architecture-importacao-certificado-empresa-monitorada-adn.md` §2).

**Implicação:** aceitar esta proposta implica **nova versão** de PRD/arquitectura (e possivelmente **deprecar** ou **restringir** o texto “proibido” a “proibido *sem* cofre e *sem* canal cifrado auditado”, se for o caso).

---

## 4. Visão da solução (alto nível, sem comprometer implementação)

1. **Ecrã:** secção na **edição da empresa monitorada** (mesmo contexto que **Sincronização ADN** / readiness): upload de **PFX** (ou PKCS#12) **e** campo para **senha** (ou desbloqueio via fluxo que minimize retenção em memória no cliente — ver §6).  
2. **Transporte:** apenas **HTTPS**; **sem** colocar segredos em query string; **sem** `NEXT_PUBLIC_*` com material criptográfico.  
3. **Destino:** o portal **não** persiste PFX em disco público nem em repositório Git; o destino mínimo aceitável é **cofre gerido** (ex.: KMS + segredo por organização/empresa) ou **blob cifrado** com chave em HSM/KMS, com política de acesso **apenas** pelo serviço que provisiona o worker ou pelo pipeline que gera `clients.local.json`.  
4. **Worker:** continua a precisar do certificado em forma utilizável pelo NFSE_dist (PFX em disco seguro **ou** injecção em loja Windows conforme política). O upload no browser é **origem** do segredo, não substitui o worker.

---

## 5. Opções de desenho (para @architect)

| Opção | Descrição | Prós | Contras |
| ----- | ----------- | ---- | ------- |
| **A — Upload → cofre cloud → worker pull** | API recebe stream multipart, escreve no cofre com ID `companyId`, worker sincroniza | Auditável, rotação centralizada | Custo, latência, IAM complexo |
| **B — Presigned URL (S3/Azure)** | Browser envia directo ao storage privado; API só emite URL e grava metadados | Menos carga no Next.js | Orquestração de vírus/validação no worker; políticas CORS |
| **C — Apenas metadados + “wizard” sem bytes** | UI recolhe thumbprint **público** (não é segredo sozinho) e loja; PFX continua offline | Compatível com CE-NFR1 actual | **Não** cumpre o pedido literal de “colocar certificado” se o utilizador espera enviar PFX |
| **D — Parceiro AC / e-CPF e-CNPJ cloud** | Integração com provedor de certificado na nuvem (sem PFX no browser do cliente) | Melhor UX de longo prazo | Fora de escopo imediato; contratos comerciais |

**Recomendação de análise:** para cumprir o pedido do utilizador com **PFX no browser**, **A** ou **B** são as linhas típicas; **C** é compromisso se o produto quiser evitar chave privada no browser mas ainda “registar” algo na edição.

---

## 6. Requisitos candidatos (rascunho para futura story / PRD)

### Funcionais (prefixo sugerido **CE-BR** — browser register)

| ID | Descrição |
| -- | ----------- |
| **CE-BR1** | Na edição da empresa monitorada, utilizador com permissão de mutação pode **iniciar** o registo de certificado associado ao **CNPJ** dessa empresa. |
| **CE-BR2** | O sistema **valida** que o certificado (cadena + *Subject* / SAN) **corresponde** ao CNPJ da empresa (14 dígitos), com mensagens alinhadas a **CE-FR10** onde aplicável. |
| **CE-BR3** | Após sucesso, o estado de **certificate readiness** e/ou jobs ADN reflectem **configurado** ou equivalente, sem expor thumbprint completo em UI pública. |
| **CE-BR4** | **Rotação:** substituir certificado deve **invalidar** material antigo no cofre após confirmação do novo (política de retenção definida em ADR). |
| **CE-BR5** | **Revogação:** admin pode pedir remoção do material; worker deixa de conseguir mTLS até novo registo. |

### Não funcionais (substituem ou refinam **CE-NFR1** se aprovado)

| Tópico | Exigência típica |
| ------ | ---------------- |
| **Cifra em trânsito e em repouso** | TLS 1.2+; dados em repouso cifrados com chave gerida (KMS). |
| **Minimização** | Não logar nome de ficheiro real + CNPJ + conteúdo; não persistir senha em claro. |
| **Janela de exposição** | Senha do PFX: preferir processamento em **memória volátil** no servidor com descarte explícito; avaliar **Web Crypto** apenas se arquitectura for client-side encryption com chave nunca no servidor (complexo). |
| **Conformidade** | Política de retenção; base legal para tratamento de credencial; eventual DPIA. |
| **Abuso** | Rate limit, tamanho máximo de ficheiro, antivírus opcional no pipeline. |

---

## 7. Riscos e questões em aberto

1. **Conflito directo** com documentação e código que assumem “sem bytes no browser” — necessidade de **ADR** com data e dono.  
2. **Responsabilidade:** quem opera o cofre (equipa portal vs cliente final em self-hosted)?  
3. **Multi-tenant:** isolamento por `organizationId` + `companyId`; proibição de leitura cruzada.  
4. **Testes:** como testar em CI sem PFX reais (fixtures com certificados de teste ICP-Brasil ou mocks legais).  
5. **FR48:** o export JSON continua **sem** segredos; o novo fluxo **não** deve misturar-se ao export.

---

## 8. Próximos passos sugeridos (governança)

1. **@pm** — decidir se o pedido é **in-scope** para roadmap e nível de investimento (cofre + compliance).  
2. **@architect** — escolher opção **A/B** (ou híbrido), diagrama C4 actualizado, ameaças (STRIDE resumido).  
3. **@po** — partir **CE-BR\*** em stories com DoR (cofre provisionado, contratos API, UX erro/sucesso).  
4. Actualizar, **após aprovação**, `docs/prd-importacao-certificado-empresa-monitorada-adn.md`, `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` e referência cruzada em `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` (secção “relação com o portal”).

---

## 9. Referências internas

- `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` — runbook actual (VM / worker).  
- `docs/prd-importacao-certificado-empresa-monitorada-adn.md` — CE-FR*, CE-NFR1.  
- `docs/architecture-importacao-certificado-empresa-monitorada-adn.md` — limites browser ↔ worker.  
- `docs/prd-integracao-nfse-dist-adn.md` — NFR19, FR48.  
- UI actual: `apps/web/src/app/(dashboard)/empresas/[id]/` (painel ADN + readiness).

---

## 10. Change log deste briefing

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 0.1    | Criação: pedido de upload pelo browser na edição da empresa; conflito normativo; opções e requisitos candidatos. |
