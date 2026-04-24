# Briefing: importação e configuração do certificado e-CNPJ para recolha ADN (XML e PDF)

## 1. Objetivo

Orientar equipas técnicas e operações para que, **segundo o comportamento do repositório original [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist)**, cada **empresa monitorada** (CNPJ contribuinte) tenha o **certificado digital e-CNPJ (A1)** correctamente disponível no ambiente onde corre o cliente de download, permitindo autenticação **mTLS** junto do **Ambiente Nacional de NFS-e (ADN)** e, em consequência, a busca de **XML** (distribuição DF-e) e **PDF** (DANFSE).

Este documento é **briefing operacional**: procedimentos, premissas e verificação. **Não** substitui o [briefing de integração com o portal](briefing-integracao-nfse-dist-adn.md), o PRD ADN nem a story de implementação.

### Ver também (normas de produto e integração)

- [PRD — Integração NFS-e / ADN no portal](prd-integracao-nfse-dist-adn.md) — **NFR19** (certificado e segredos fora do browser) e **FR48** (export JSON de lista para automação **sem** segredos de certificado).  
- [PRD — Certificado e-CNPJ (empresa monitorada)](prd-importacao-certificado-empresa-monitorada-adn.md) e [Arquitectura certificado + portal](architecture-importacao-certificado-empresa-monitorada-adn.md).  
- Comportamento de referência do cliente de recolha: [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) (**CE-FR6**).

---

## 2. Porque o certificado é obrigatório

- O ADN exige **cliente TLS com certificado de ICP-Brasil** associado ao **contribuinte** que consulta a sua distribuição de documentos fiscais electrónicos.
- O [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) **não** obtém notas sem credencial válida: ou usa certificado na **loja de certificados do Windows** (via `curl.exe` / Schannel e **thumbprint**) ou um ficheiro **PFX** no disco, conforme `clients.json` / `clients.local.json` e a lógica em `main.py` / `config.py` / `api_client.py` do repositório original.

**Conclusão:** “Importar” ou disponibilizar o certificado da **mesma empresa** cujo CNPJ está em `clients.json` é **pré-requisito** para qualquer busca de XML/PDF nesse fluxo — não é opcional decorativo do portal de monitorização.

---

## 3. Premissas de ambiente (repositório original)

| Premissa | Detalhe |
|----------|---------|
| Sistema operativo | **Windows** (caminho recomendado e documentado no upstream). |
| `curl.exe` | Presente no **PATH**, com suporte **Schannel** para uso com `--cert Store\\My\\THUMBPRINT`. |
| Python | **3.11+** recomendado no README do NFSE_dist; dependências em `requirements.txt`. |
| CNPJ | **14 dígitos** por cliente (**CE-FR2**); alinhado ao CNPJ da empresa monitorada no produto. |

Execução típica: `iniciar.bat` ou `python main.py` a partir da pasta do NFSE_dist.

---

## 4. Duas modalidades suportadas pelo NFSE_dist

### 4.0 Precedência do ramo TLS (**CE-FR1**)

O `main.py` / `api_client.py` do [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) escolhe o transporte assim:

| Condição no `clients.local.json` (por CNPJ) | Ramo efectivo | Tecnologia típica |
| ------------------------------------------- | -------------- | ----------------- |
| **`thumbprint` definido** (valor não vazio) | Cliente HTTP com certificado na **loja Windows** | `curl.exe` + **Schannel** (`--cert Store\\My\\…`) |
| **Sem `thumbprint` válido** | Cliente HTTP com **PFX** em disco | `requests_pkcs12` + ficheiro `certificates/<CNPJ>.pfx` + `senha_cert` |

**Regra de precedência:** se existir **thumbprint**, o fluxo com **curl / loja** tem prioridade sobre o PFX; só quando **não** há thumbprint é que o PFX em `certificates/` é usado.

### 4.1 Modalidade A — Certificado na loja Windows (preferida no README)

1. **Obter** o certificado **e-CNPJ A1** emitido para o CNPJ da empresa (ficheiro `.pfx` fornecido pela AC ou procedimento interno de emissão).
2. **Instalar** o `.pfx` na loja **Pessoal** (`Cert:\CurrentUser\My`) ou **Máquina local** (`Cert:\LocalMachine\My`), conforme política de segurança e necessidade de serviços agendados (**CE-FR3** — `CurrentUser` vs `LocalMachine`: o processo que corre o worker — serviço Windows, utilizador interactivo, ou tarefa agendada — deve ser o **mesmo** perfil que “vê” a loja escolhida; `LocalMachine` pode exigir permissões elevadas e alinhamento explícito à conta de serviço).
3. **Confirmar** que o *Subject* do certificado **contém o CNPJ** da empresa (**CE-FR4** — o script `find_certificate_entry` em `config.py` procura o CNPJ no *Subject* via PowerShell); se o CNPJ **não** aparecer no *Subject*, a detecção automática pode falhar — nesse caso use sempre **thumbprint explícito** (modalidade A refinada).
4. **Registar thumbprint e loja** em `clients.local.json` (merge por CNPJ), ou usar o **menu 5** do `main.py` para gravar thumbprint + `cert_store` (`CurrentUser` ou `LocalMachine`).
5. Opcional: menu **4** — listar certificados via PowerShell para copiar o **thumbprint** (hex, sem espaços).

**Ficheiros:**

- `clients.json` — lista base de CNPJs e nomes (pode versionar sem segredos).
- `clients.local.json` — **não versionar**; contém thumbprint, `cert_store` e, se aplicável, `senha_cert` para PFX (`.gitignore` no upstream).

### 4.2 Modalidade B — Ficheiro PFX em disco

1. Colocar o ficheiro **`certificates/<CNPJ>.pfx`** (14 dígitos no nome, sem máscara), pasta `certificates/` ao lado do código, conforme `config.get_cert_path`.
2. Em `clients.local.json`, definir **`senha_cert`** com a senha do PFX para o mesmo CNPJ.
3. **Não** definir `thumbprint` **ou** garantir que o fluxo com PFX é o seleccionado: no código original, se existir **thumbprint**, a chamada ADN usa **curl + loja**; sem thumbprint, usa `requests_pkcs12` com o caminho do PFX.

**Segurança:** o PFX contém a **chave privada**; armazenar apenas em VM cofre, permissões restritas, backups cifrados; **nunca** commit no Git nem envio para o browser.

### 4.3 Export **FR48** vs `clients.local.json` (**CE-FR8**)

- O **export JSON** previsto no portal (**FR48** em [prd-integracao-nfse-dist-adn.md](prd-integracao-nfse-dist-adn.md)) contém **metadados** de empresas monitoradas (ex.: CNPJ, nome) para automação — **sem** thumbprint, senha nem caminhos de PFX.  
- O ficheiro **`clients.local.json`** no ambiente do worker é **configuração operacional** com segredos (thumbprint, `senha_cert`, etc.): **não** é substituto do export **FR48** nem deve ser gerado a partir do portal neste MVP. Mantenha **FR48** versionável e `clients.local.json` **fora** do Git (ver exemplos em `docs/examples/clients.local.example.json`).

### 4.4 Mínimo privilégio em disco e backups (**CE-NFR3**, **CE-NFR4**)

- **CE-NFR3:** pastas `certificates/` e ficheiros `clients.local.json` devem ter ACL **mínimas** (apenas a conta do serviço de recolha); evitar partilhas de rede abertas ou perfis de utilizador partilhados sem necessidade.  
- **CE-NFR4:** cópias de segurança que incluam PFX ou material de chave devem usar **cifra em repouso** e política de retenção alinhada à equipa de segurança.

---

## 5. Checklist de importação / configuração (por empresa)

1. [ ] CNPJ da empresa monitorada coincide com o registo em `clients.json` (ou equivalente gerado pelo portal/worker).
2. [ ] Certificado é **e-CNPJ** válido e não revogado; data de validade verificada.
3. [ ] **A** Loja Windows com thumbprint **ou** **B** `certificates/<CNPJ>.pfx` + `senha_cert` configurados de forma coerente com o ramo de código usado.
4. [ ] `clients.local.json` presente no ambiente do worker, **fora** do controlo de versão.
5. [ ] Teste manual: executar opção **1** (baixar notas de todos os clientes) e rever `logs/execucao.log`.
6. [ ] Para PDFs: ajustar `NFSE_DIST_PDF_WORKERS` / `NFSE_DIST_PDF_MAX_ATTEMPTS` se houver **429/503** (README); consultar `logs/pdf_dead_letter.jsonl` em caso de falhas permanentes.

---

## 6. Relação com o portal (contexto produto)

- O **portal** regista **empresas monitoradas** e políticas multi-tenant; **não** substitui a instalação do certificado na **VM / estação** onde corre o [NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) (ou worker derivado).
- A direcção arquitectural está em [briefing-integracao-nfse-dist-adn.md](briefing-integracao-nfse-dist-adn.md): cofre no worker, `clients.local.json` gerado a partir de segredos de infraestrutura, sem exposição ao cliente web.

---

## 7. Critérios de sucesso (smoke)

- Chamada à API de distribuição (`contribuintes/DFe/...` no upstream) retorna **200** com payload processável ou **204** quando não há documentos novos — registado sem erro fatal de TLS em `logs/execucao.log`.
- Após execução bem sucedida, existem ficheiros sob `data/<CNPJ>/` (XML em `prestadas` / `tomadas` conforme classificação do `processor.py`; PDFs quando o fluxo de DANFSE conclui).

### 7.1 Passos de smoke detalhados (**CE-FR7**)

1. Executar uma recolha (ex.: opção **1** no menu do NFSE_dist ou comando equivalente no worker).  
2. Abrir `logs/execucao.log` na pasta do cliente e confirmar ausência de erros fatais de TLS ou de autenticação ao endpoint de distribuição.  
3. Listar a pasta `data/<CNPJ>/` (14 dígitos, sem máscara) e confirmar novos XML (ou estado coerente com “sem documentos novos” / **204** conforme o caso).  
4. Para PDFs, seguir o README do upstream sobre **429/503** e, se necessário, `logs/pdf_dead_letter.jsonl`.  
5. Para testes com o **portal** (API e fila), ver [qa/adn-staging-setup.md](qa/adn-staging-setup.md).

### 7.2 Matriz causa → copy ao operador → acção (**CE-FR10**)

| Categoria interna | Copy ao utilizador / operador (pt-BR) | Acção |
| ----------------- | --------------------------------------- | ----- |
| Certificado não encontrado (worker) | Não foi possível validar o certificado da empresa no servidor de recolha. | Revisar instalação na VM; confirmar CNPJ no *Subject* ou thumbprint; abrir guia ADN do portal. |
| PFX inexistente ou senha incorrecta | A configuração do certificado no servidor está incompleta ou incorrecta. | Confirmar `certificates/<CNPJ>.pfx` e `senha_cert` em `clients.local.json`. |
| Thumbprint inválido ou desactualizado | Os dados do certificado no servidor precisam de ser actualizados. | Reinstalar certificado, actualizar thumbprint e `cert_store`; testar com o mesmo utilizador do serviço. |
| `curl.exe` ausente ou ambiente incompleto | O servidor de recolha não está preparado para ligar ao Ambiente Nacional. | Instalar dependências do README (incl. `curl` no PATH com Schannel). |
| Loja incorrecta (**CurrentUser** vs serviço) | O certificado não está acessível ao serviço de recolha. Verifique a instalação. | Alinhar loja (`CurrentUser` vs `LocalMachine`) ao contexto do processo (**CE-FR3**). |

**Nota:** códigos HTTP **429** e **503** do ADN nacional e mensagens de **limite de débito** tratam-se pelo **glossário ADN geral** do produto ([front-end-spec-integracao-nfse-dist-adn.md](front-end-spec-integracao-nfse-dist-adn.md)), não por esta matriz de certificado.

### 7.3 Rotação de certificado (**CE-FR11**)

- **Substituir** o PFX em disco **ou** o certificado na loja Windows (conforme modalidade activa) e actualizar `thumbprint` / `senha_cert` em `clients.local.json`.  
- **Validar** a data **NotAfter** do novo certificado antes de colocar em produção.  
- **Reexecutar** o smoke da secção 7.1 e rever `logs/execucao.log` após a primeira recolha com o novo material.

---

## 8. Referências

- Repositório original: [https://github.com/RafaelOliveiraCf/NFSE_dist](https://github.com/RafaelOliveiraCf/NFSE_dist) (README, `clients.example.json`, `Manual.pdf` se aplicável).
- Integração portal + worker: [briefing-integracao-nfse-dist-adn.md](briefing-integracao-nfse-dist-adn.md).
- Activ técnica staging (API portal): [qa/adn-staging-setup.md](qa/adn-staging-setup.md).

---

## 9. Change log (documento canónico — **CE-NFR7**)

| Data       | Versão | Descrição |
| ---------- | ------ | ---------- |
| 2026-04-24 | 0.1    | Briefing inicial. |
| 2026-04-24 | 0.2    | **CER-01/02/03:** tabela **CE-FR1** (precedência thumbprint vs PFX); **Ver também** com NFR19/FR48; **CE-FR2–CE-FR4** e **CE-FR8**; **CE-NFR3/4**; matriz **CE-FR10**; smoke **CE-FR7**; rotação **CE-FR11**; nota 429/503; ligação a staging. |

---

*Documento elaborado no âmbito AIOS (analyst) — briefing para execução operacional alinhada ao upstream NFSE_dist.*
