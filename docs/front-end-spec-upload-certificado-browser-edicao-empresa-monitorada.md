# Especificação de front-end e UX — Upload de certificado e-CNPJ pelo browser (edição da empresa monitorada)

**Produto:** Portal de Automação de Notas Fiscais.  
**Fonte de produto:** `docs/prd-upload-certificado-browser-edicao-empresa-monitorada.md` (**CE-BR1–CE-BR8**, **BR-NFR1–BR-NFR8**, §6 UX).  
**Especificações base:** `docs/front-end-spec.md`, `docs/front-end-spec-integracao-nfse-dist-adn.md`, `docs/front-end-spec-importacao-certificado-empresa-monitorada-adn.md`.  
**Implementação de referência (layout actual):** `apps/web/src/app/(dashboard)/empresas/[id]/adn-sync-panel.tsx`, `adn-certificate-readiness-card.tsx`.

**Autor:** Uma (UX / AIOS)  
**Data:** 2026-04-24  
**Versão:** 1.0

### Hierarquia normativa

1. Este documento descreve a **UI/UX do incremento “browser → cofre”** previsto no PRD de upload. **Só se aplica** quando o produto tiver **ADR** aprovado e **feature** correspondente activa (nome técnico: *placeholder* `CERT_UPLOAD_UI_ENABLED` ou equivalente definido por **@architect**).  
2. Com a feature **desactivada**, prevalece integralmente `docs/front-end-spec-importacao-certificado-empresa-monitorada-adn.md` (**CE-NFR1** — sem inputs de segredo).  
3. Com a feature **activa**, o **organismo de upload** (§5) **é permitido**; o **Alert** educativo e o **link do runbook** do spec anterior **mantêm-se** (complementaridade: expectativa “o worker ainda executa a recolha” + acção “registar certificado”).  
4. Em conflito de tokens ou padrões de componente, prevalece `docs/front-end-spec.md` e o spec ADN geral.

### Change log

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 1.0    | Spec inicial: IA, fluxos, organismos, estados, copy, a11y, rastreio CE-BR. |

---

## 1. Objectivos de UX

1. **Confiança e transparência:** em **≤ 45 segundos**, o admin percebe que o ficheiro é **enviado de forma segura**, **guardado cifrado** e **consumido pelo servidor de recolha** — sem achar que o browser “substitui” o worker (**PRD §6.1**).  
2. **Tarefa única por ecrã:** concluir primeiro registo ou **rotação** com o mínimo de passos, com **confirmação explícita** em acções destrutivas (**CE-BR4**, **CE-BR5**).  
3. **Erros acionáveis:** mensagens alinhadas ao tom **CE-FR10** + extensões deste spec (**§7**), **sem** paths internos, thumbprints completos nem conteúdo de ficheiros (**CE-BR3**, **BR-NFR3**).  
4. **Acessibilidade:** **WCAG 2.2 AA** em formulário, modais, estados de carregamento e anúncios de sucesso/erro (**PRD §6.4**).  
5. **Segurança na superfície:** **nunca** persistir PFX nem senha em `localStorage` / `sessionStorage` / URL; limpar campo de senha após envio bem sucedido ou ao desmontar (**BR-NFR1**, **BR-NFR4**).

---

## 2. Personas e permissões (UI)

| Persona | O que vê / faz |
| -------- | --------------- |
| **Admin com mutação** | Secção completa: estado de readiness + **Registar / Substituir** + **Revogar** (quando existir certificado). |
| **User só leitura** | Mesmo bloco ADN que hoje; **sem** formulário de upload; opcionalmente texto curto “Apenas administradores podem registar o certificado.” (**CE-BR6**). |
| **Operador de infra** | Continua a usar o **runbook**; link canónico permanece visível para cenários avançados. |

---

## 3. Arquitectura da informação

### 3.1 Onde vive

- **Página:** detalhe da empresa monitorada (`/empresas/[id]`), **dentro** da região **Sincronização ADN** (mesmo `h2` / `section` que o [spec ADN](front-end-spec-integracao-nfse-dist-adn.md)).  
- **Recomendação de composição:** expandir o **card de prontidão do certificado** existente (`AdnCertificateReadinessCard`) para incluir, **abaixo** do estado + link do guia, o **organismo “Registo do certificado”** (§5.2) **quando** `CERT_UPLOAD_UI_ENABLED` e papel com mutação. **Evitar** um segundo `h3` de nível ambíguo; usar **`h3` único** *Certificado para o ADN* ou manter título actual do card e subsecção com `fieldset` + `legend` para o formulário.  
- **Ordem vertical (feature activa):** (1) estado readiness + CTA “Verificar” (se existir); (2) **Alert** informativo (runbook — reutilizar copy do [spec certificado §5.1](front-end-spec-importacao-certificado-empresa-monitorada-adn.md) com **terceira frase** opcional sobre upload seguro — ver §3.2); (3) **Registo do certificado** (formulário); (4) restantes CTAs ADN (sync, notas, export).  
- **Breadcrumb:** inalterado.

### 3.2 Evolução do Alert informativo (com feature activa)

Manter as **duas frases** canónicas do spec actual. **Acrescentar** (terceira frase, **opcional** se PM aprovar densidade):

- *“Se a sua organização activou o registo pelo portal, pode enviar o ficheiro do certificado abaixo — o ficheiro é guardado de forma cifrada e só o servidor de recolha o utiliza.”*

Se PM preferir **menos texto**, usar **apenas** tooltip no botão primário “Enviar certificado” com *“Enviado por ligação segura; armazenamento cifrado.”*

---

## 4. Fluxos de utilizador

### 4.1 Primeiro registo (feliz)

**Pré:** org com ADN activo; utilizador com mutação; sem certificado no cofre ou estado “pendente”.

1. Abre detalhe da empresa → secção **Sincronização ADN**.  
2. Lê o Alert (expectativa worker + guia).  
3. Em **Registo do certificado**, escolhe ficheiro **.pfx** / **.p12** (accept MIME/acordo **@architect**).  
4. Introduz **palavra-passe** do contentor.  
5. Clica **Enviar certificado** → botão entra em **loading**; `aria-busy="true"` na região do formulário.  
6. **Sucesso:** mensagem **não modal** preferencial (`Alert` `default` com `role="status"` + ícone *Check*) *“Certificado registado. O servidor de recolha pode demorar alguns minutos a ficar pronto.”*; limpar senha e *input* ficheiro; **disparar** refresh do readiness (mesmo mecanismo que `bumpReadiness` após sync).  
7. **Insucesso:** ver §7.

### 4.2 Rotação (substituir certificado existente)

**Pré:** já existe certificado activo (estado UI derivado da API).

1. Mostrar resumo **não sensível:** *“Certificado activo — válido até [data]”* se API fornecer **NotAfter** mascarado (só data, sem thumbprint).  
2. Botão **Substituir certificado** abre **`Dialog`** modal com: texto de risco curto + *“O certificado actual deixa de ser usado após a confirmação bem sucedida do novo.”*  
3. No modal: mesmo par ficheiro + senha; botões **Cancelar** (foco inicial) e **Confirmar substituição** (primário).  
4. Sucesso: fechar modal; toast ou `Alert` *“Novo certificado registado.”*; refresh readiness (**CE-BR4**).

### 4.3 Revogação

1. Botão **Revogar certificado** (`variant="outline"` + cor destrutiva de token, **não** primário vermelho no primeiro nível).  
2. **`Dialog`** de confirmação: checkbox *“Compreendo que a recolha ADN falhará até novo registo”* **obrigatório** para activar **Confirmar revogação**.  
3. Sucesso: estado UI *sem certificado*; `Alert` informativo reforça runbook (**CE-BR5**).

### 4.4 Sem permissão (403)

- Formulário **omitido**. Texto neutro: *“Não tem permissão para registar o certificado. Peça a um administrador da organização.”*  
- **Não** revelar se já existe ou não certificado no cofre se a API assim o exigir por segurança (alinhamento **@architect**).

### 4.5 Processamento assíncrono (opcional BR-NFR8)

Se o backend devolver **202 Accepted** / job pendente:

- Mostrar **barra de progresso** indeterminada ou passo *“A validar o certificado…”* com link **Actualizar estado**.  
- Não fechar o formulário até estado final; ou fechar com banner persistente *“Validação em curso — pode sair desta página; voltaremos a actualizar o estado automaticamente.”* (polling gentil, intervalo mínimo definido por **@architect**).

---

## 5. Ecrãs e componentes

### 5.1 Tokens e base

- Reutilizar **Card**, **Alert**, **Button**, **Input**, **Label**, **Dialog**, **Progress** (shadcn) conforme `docs/front-end-spec.md`.  
- Espaçamento: alinhar ao painel ADN existente (`rounded-xl`, `p-6`, tipografia `text-sm` / `text-xs` para texto secundário).

### 5.2 Organismo — **Registo do certificado**

| Elemento | Especificação |
| -------- | -------------- |
| **Contenedor** | `fieldset` com `legend` visualmente claro: **“Registo do certificado”** (ou integrado ao título do card pai). |
| **Input ficheiro** | `type="file"`; `accept` restrito a extensões acordadas; **etiqueta** explícita *“Ficheiro do certificado (.pfx ou .p12)”*; texto de ajuda *“Tamanho máximo: [X] MB.”* (**BR-NFR6**). |
| **Senha** | `type="password"`; `autoComplete="new-password"` (evitar sugestões do gestor para credencial errada); botão **mostrar/ocultar** senha com `aria-pressed` e ícone `aria-hidden`. |
| **Acções** | **Enviar certificado** (primário); **Limpar** (terciário/link) repõe ficheiro + senha sem enviar. |
| **Erro inline** | `Alert` `destructive` **dentro** do `fieldset`, associado com `aria-describedby` ao primeiro campo com erro. |
| **Loading** | Desactivar inputs; **Enviar** com *spinner*; foco mantido no botão ou mover para região `role="status"` após sucesso (decisão: mover foco ao resumo de sucesso — melhor para leitores de ecrã). |

### 5.3 Estados visuais (resumo)

| Estado | Tratamento UI |
| ------ | --------------- |
| `idle` | Formulário editável. |
| `uploading` | Loading, inputs desactivados. |
| `processing` | Progress indeterminado + copy §4.5. |
| `success` | Mensagem de sucesso + reset form + refresh readiness. |
| `error` | Matriz §7 + foco no primeiro controlo corrigível. |

### 5.4 Wireframe (baixa fidelidade — texto)

```
┌─ Sincronização ADN ─────────────────────────────┐
│ [Readiness: pendente / OK / …]   [Verificar]     │
├──────────────────────────────────────────────────┤
│ ℹ Certificado digital (+ 3ª frase opcional)      │
│ … [Como configurar no servidor de recolha] →     │
├──────────────────────────────────────────────────┤
│ Registo do certificado                            │
│ [ Ficheiro: Escolher ficheiro… ]  ajuda tamanho   │
│ [ Palavra-passe do ficheiro        ] [👁]        │
│ [ Enviar certificado ]  Limpar                    │
├──────────────────────────────────────────────────┤
│ (se activo) Certificado até 31/12/2026          │
│ [ Substituir certificado ]  [ Revogar ]          │
├──────────────────────────────────────────────────┤
│ [Sincronizar agora] …                             │
└──────────────────────────────────────────────────┘
```

---

## 6. Microcopy — matriz alinhada a CE-FR10 + upload

**Regra:** mensagens **genéricas** para erros de servidor não mapeados (*“Não foi possível concluir o registo. Tente novamente ou contacte o suporte.”*).

| Código / causa (interno) | Copy ao utilizador (pt-BR) | Acção na UI |
| -------------------------- | --------------------------- | ------------ |
| Senha incorrecta / PFX corrupto | **“Não foi possível ler o certificado. Verifique a palavra-passe e o ficheiro.”** | Focar senha; link guia. |
| CNPJ do certificado ≠ empresa | **“Este certificado não corresponde ao CNPJ desta empresa.”** | Trocar ficheiro; mostrar CNPJ da empresa (máscara **00.000.000/0000-00**). |
| Ficheiro demasiado grande | **“O ficheiro excede o tamanho máximo permitido ([X] MB).”** | — |
| Tipo de ficheiro não suportado | **“Use um ficheiro .pfx ou .p12.”** | — |
| Limite de pedidos (rate limit) | **“Foram feitos demasiados envios. Aguarde alguns minutos e tente novamente.”** | — |
| Certificado não encontrado (worker, pós-upload) | Reutilizar **CE-FR10:** *“Não foi possível validar o certificado da empresa no servidor de recolha.”* | Guia + *Actualizar estado*. |
| Revogação concluída | **“O certificado foi removido. A recolha ADN fica indisponível até novo registo.”** | — |
| Sem permissão | **“Não tem permissão para registar o certificado.”** | — |

**429/503 ADN** (sincronização, não upload): glossário ADN geral — **não** misturar com erros de upload.

---

## 7. Acessibilidade (WCAG 2.2 AA)

- **4.1.2 Nome, função, valor:** `legend` + `label` visíveis para todos os inputs; erros com `aria-invalid` e `aria-describedby`.  
- **2.4.3 Ordem de foco:** modal: **Cancelar** antes de **Confirmar** na ordem de tab (ou padrão de risco com foco inicial no cancelar).  
- **3.3.1 Identificação de erros:** mensagens específicas da tabela §6 quando conhecido; caso contrário mensagem genérica + id de pedido **opcional** (*“Referência: …”*) **sem** dados sensíveis.  
- **4.1.3 Mensagens de estado:** `role="status"` no sucesso; erros persistentes com `role="alert"` **só** após submissão (não em cada keystroke).  
- **1.4.3 Contraste:** `destructive` sobre fundo cumpre **4.5:1**.  
- **2.5.5 Tamanho do alvo (opcional AAA):** botões ≥ **24×24** px mínimo; preferir **44×44** em mobile para **Enviar** e **Escolher ficheiro**.  
- **Não** anunciar nome completo do ficheiro do utilizador em *live regions* se contiver PII excessiva — usar *“Ficheiro seleccionado”* + tamanho.

---

## 8. Responsividade

- **Mobile:** empilhar *ficheiro* → *senha* → *acções*; modal em **fullscreen** em `sm` se já for padrão do design system.  
- **Desktop:** largura máxima do formulário igual ao card ADN; *Substituir* / *Revogar* em linha com `gap-3`, quebrar linha `<640px`.

---

## 9. Telemetria UX (opcional)

Eventos **sem** PII: `cert_upload_started`, `cert_upload_succeeded`, `cert_upload_failed` (com código de erro **mapeado**, não stack). Para **@pm** alinhar com métricas do PRD §7.

---

## 10. Rastreio PRD → UX

| Requisito | Onde na UI |
| --------- | ---------- |
| **CE-BR1** | Organismo §5.2 no detalhe da empresa |
| **CE-BR2** | Fluxo 4.1 + matriz §6 |
| **CE-BR3** | Sem thumbprint/PFX na UI; resumo só **NotAfter** se API permitir |
| **CE-BR4** | Fluxo 4.2 |
| **CE-BR5** | Fluxo 4.3 |
| **CE-BR6** | §2 + 4.4 |
| **CE-BR7** | Fora da UI (auditoria backend); UI não mostra conteúdo de auditoria com segredos |
| **CE-BR8** | Copy no export inalterada; nenhum campo export ligado ao upload |
| **BR-NFR1–BR-NFR4** | §1 objectivo 5; sem dados em URL/storage cliente |
| **BR-NFR6** | Ajuda tamanho + copy rate limit §6 |

---

## 11. Handoff

- **@dev:** feature flag; extensão de `AdnCertificateReadinessCard` ou componente irmão; integração com endpoints definidos no ADR; testes de foco e `aria-*`.  
- **@architect:** contrato de estados (`idle` / `processing` / …), limites de ficheiro, códigos de erro estáveis para §6.  
- **@qa:** matriz §6 + permissões + teclado + mobile + regressão com feature **off** (spec antigo intacto).  
- **@pm:** aprovar terceira frase do Alert vs tooltip; aprovar copy exacta §6.

---

— **Uma (UX / AIOS)** — especificação derivada de `docs/prd-upload-certificado-browser-edicao-empresa-monitorada.md`.
