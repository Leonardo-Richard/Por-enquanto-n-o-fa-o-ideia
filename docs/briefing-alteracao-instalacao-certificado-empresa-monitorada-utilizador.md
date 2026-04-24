# Briefing: alteração — utilizador capaz de instalar o certificado da empresa monitorada

## 1. Objetivo deste documento

Capturar o **pedido de evolução de produto** segundo o qual o **utilizador do portal** (tipicamente **admin da organização**) deve ser **capaz de instalar** (ou completar de ponta a ponta, com feedback claro) o **certificado digital e-CNPJ** associado a uma **empresa monitorada**, de forma coerente com a recolha **ADN** (mTLS).

Este ficheiro é **briefing de descoberta / alteração**: delimita o problema, contrasta com a norma actual, propõe leituras do pedido e **decisões em aberto** para `@po` e `@architect`. **Não** altera por si só o PRD nem o briefing canónico de operação do worker.

**Referências vinculativas actuais:**

- [Briefing operacional — certificado + ADN](briefing-importacao-certificado-empresa-monitorada-adn.md) (runbook; instalação na **VM / worker**).  
- [PRD — certificado empresa monitorada](prd-importacao-certificado-empresa-monitorada-adn.md) — **CE-NFR1** (proibição de PFX/senha no browser e em `NEXT_PUBLIC_*`).  
- [PRD — integração ADN](prd-integracao-nfse-dist-adn.md) — **NFR19** (segredos fora do browser; cofre/worker).  
- Stories: [incremento-certificado-adn-guia-portal.md](stories/incremento-certificado-adn-guia-portal.md) (**CER-04** alerta + link ao guia; certificado **não** na página).

---

## 2. Estado actual (linha de base)

| Aspecto | Comportamento / norma actual |
|--------|----------------------------|
| **Onde vive o certificado** | Ambiente do **servidor de recolha** (worker alinhado a [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist)): loja Windows + thumbprint **ou** PFX em disco + `clients.local.json`. |
| **Papel do portal** | Regista empresas monitoradas, exporta metadados (**FR48** sem segredos), explica que o certificado **não** se instala “nesta página”; liga ao **guia técnico** (**CE-FR9**). |
| **Upload de PFX no browser** | **Explicitamente fora do âmbito** do MVP do PRD certificado (**CE-NFR1**). |

**Conclusão:** hoje “instalar o certificado” é, em linguagem de produto, **tarefa de infra / operador** no worker; o **utilizador do portal** é orientado, mas **não** executa a instalação criptográfica através da aplicação web.

---

## 3. Pedido de alteração (formulado pelo negócio)

**Desejo:** o utilizador (admin) deve poder **instalar** o certificado **da** empresa monitorada (isto é, em correlação 1:1 com o CNPJ / registo monitorado), sem depender apenas de documentação externa ou de fila para equipa de infra — ou, no mínimo, a experiência deve comunicar que a instalação ficou **concluída e válida** para aquela empresa.

Este briefing assume que o pedido é **sincero** (reduzir fricção operacional, self-service, traçabilidade por empresa). Exige **desambiguar** o verbo “instalar” antes de `@dev` implementar (ver secção 4).

---

## 4. Leituras possíveis do verbo “instalar” (para fechar com `@po`)

Enumeradas para escolha explícita; cada uma tem impacto diferente em PRD, segurança e arquitectura.

1. **Leitura A — Instalação técnica continua no worker; UX “instalar” no portal = guia + verificação**  
   O utilizador **não** envia chave pelo browser; o portal oferece **checklist**, **estado** (“certificado OK / pendente / erro”) por empresa, e talvez **webhook** ou integração com pipeline que aplica alterações no worker. **Alinhamento:** máximo com **NFR19** / **CE-NFR1** actuais.  
   *Risco:* ainda pode exigir alguém com acesso à VM para o passo físico do PFX ou da loja.

2. **Leitura B — Upload ou entrega de material criptográfico através do portal para cofre backend**  
   O admin **carrega** PFX (ou equivalente) **num endpoint seguro**; o backend armazena em **cofre** (HSM / Key Vault / segredo gerido) e o worker consome por CNPJ/empresa.  
   *Implica:* novo **épico** de segurança (cifra em trânsito e em repouso, rotação, auditoria, responsabilidade legal do operador do certificado ICP-Brasil), revisão de **CE-NFR1** e possível **ADR**.  
   *Benefício:* self-service real “na linha” empresa monitorada ↔ certificado.

3. **Leitura C — “Instalar” = emitir / renovar via AC integrada**  
   Integração com autoridade certificadora ou fluxo de **CSR** no portal. **Fora do âmbito** do PRD certificado actual (renovação junto da AC é processo externo). Só relevante se o pedido de negócio for explícito.

4. **Leitura D — Delegação a parceiro / “instalação gerida”**  
   Botão “Solicitar instalação” abre ticket ou automatismo para equipa certificada; o portal mostra **SLA** e estado. Pouca mudança criptográfica; mais **workflow** e CRM.

**Recomendação de briefing (não vinculativa):** começar por **A** se o objectivo for **clareza e observabilidade** sem reabrir **NFR19**; migrar para **B** só após **ADR** + ameaças modeladas + dono de segurança, porque contradiz o MVP actual do PRD na letra de **CE-NFR1** (proibição de canal web para PFX) **salvo** se o PRD for alterado para “upload **apenas** para serviço backend cofrado, nunca exposto ao cliente”.

---

## 5. Critérios de sucesso sugeridos (a aprovar)

Independente da leitura escolhida, convém fechar **mensuráveis**:

1. **Correlação:** qualquer acção ou estado de certificado está **ligada** ao identificador da **empresa monitorada** (e CNPJ de 14 dígitos).  
2. **Segurança:** nenhum thumbprint completo, senha ou caminho de PFX em logs **INFO** ou JSON público (alinhado a **CE-NFR5** / matriz **CE-FR10**).  
3. **Utilidade:** após o fluxo “concluído”, o **smoke ADN** (200/204, sem falha TLS fatal) é **atingível** sem passos não documentados.  
4. **Acessibilidade:** se houver UI nova, CTAs e estados com **a11y** consistente com **CER-04** / painel ADN existente.

---

## 6. Impacto em artefactos existentes

| Artefacto | Se Leitura A | Se Leitura B |
|-----------|--------------|--------------|
| `docs/briefing-importacao-certificado-empresa-monitorada-adn.md` | Actualizar secção “relação com o portal” + checklist se houver **estado** no portal. | Reescrever fronteira browser vs backend; cofre; fluxo de rotação. |
| `docs/prd-importacao-certificado-empresa-monitorada-adn.md` | Pequeno delta (CE-FR9 + estados). | **Revisão** de **CE-NFR1**, novos CE-FR, épicos. |
| Stories **CER-*** | Novas stories (estado certificado, healthcheck). | Novas stories (API upload, cofre, worker). |
| `adn-sync-panel.tsx` / APIs ADN | Extensão de copy + possível **badge** de preparação certificado. | Novos endpoints, políticas de armazenamento, quotas. |

---

## 7. Riscos e perguntas em aberto

1. **Custódia da chave:** quem é responsável legal/operacional se o certificado transitar pelo portal (Leitura B)?  
2. **Multi-tenant:** o certificado é por **empresa fiscal** / CNPJ; como evitar **mistura** entre organizações na UI e no cofre?  
3. **Paridade NFSE_dist:** qualquer automação deve manter **precedência thumbprint vs PFX** (**CE-FR1**) no worker.  
4. **MVP vs roadmap:** esta alteração **absorve** ou **substitui** a narrativa “certificado só no servidor” da **CER-04**?

---

## 8. Próximos passos sugeridos (workflow)

1. **`@po`** — Escolher **uma** leitura da secção 4 (ou híbrido A+estado detalhado) e registar **data + decisão** neste ficheiro (linha de change log abaixo) ou em PRD.  
2. **`@architect`** — Se B: modelo de ameaças mínimo (STRIDE resumido), escolha de cofre, contrato API.  
3. **`@pm`** — Se B ou C: actualização de PRD e possível ADR; se A: user story única “estado + verificação certificado por empresa”.  
4. **`@sm`** — Quebrar em stories após decisão; evitar duplicar runbook canónico sem **ADR** (regra **CER-01**).

---

## 9. Change log (briefing de alteração)

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 0.1    | Versão inicial: pedido “utilizador instala certificado”; leituras A–D; impacto e riscos. |

---

— Documento preparado no âmbito do agente **analyst** (Atlas): enquadramento e opções para decisão de produto; não dispensa PRD/stories actualizados após escolha da leitura.
