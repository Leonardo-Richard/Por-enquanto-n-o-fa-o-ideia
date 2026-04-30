// Baixar NFSe - Nota Fiscal de Servico Eletronica
// Copyright (c) 2018-2026 CECHINEL CERTIFICACAO DIGITAL LTDA
// https://chromewebstore.google.com/detail/enehmclajcndmgefbmjhecccoegbdgea
// Todos os direitos reservados.

// Definição de todos os campos do XML da NFS-e organizados por grupo
// Usado para configuração do Excel Personalizado
// Schema rev: 2948-0155-ccdl

const NFSE_FIELDS = [
  {
    id: 'infNFSe',
    label: 'Informações da NFS-e',
    description: 'Dados gerais da Nota Fiscal de Serviço Eletrônica',
    fields: [
      { id: 'infNFSe_id', tag: 'Id', selector: 'infNFSe', attr: 'Id', label: 'Chave NFS-e', description: 'Chave de 50 dígitos da NFS-e (sem prefixo NFS).' },
      { id: 'xLocEmi', tag: 'xLocEmi', selector: 'infNFSe > xLocEmi, xLocEmi', label: 'Localidade Emissora', description: 'Descrição do código de 7 dígitos da localidade emissora.' },
      { id: 'xLocPrestacao', tag: 'xLocPrestacao', selector: 'infNFSe > xLocPrestacao, xLocPrestacao', label: 'Local da Prestação', description: 'Descrição do código de 7 dígitos referente ao local da prestação.' },
      { id: 'nNFSe', tag: 'nNFSe', selector: 'nNFSe', label: 'Número NFS-e', description: 'Número da NFS-e (Sequencial pelo emitente).' },
      { id: 'cLocIncid', tag: 'cLocIncid', selector: 'infNFSe > cLocIncid, cLocIncid', label: 'Cód. Localidade Incidência', description: 'Código de 7 dígitos da localidade de incidência do ISSQN.' },
      { id: 'xLocIncid', tag: 'xLocIncid', selector: 'infNFSe > xLocIncid, xLocIncid', label: 'Localidade Incidência', description: 'Descrição da localidade de incidência do ISSQN.' },
      { id: 'xTribNac', tag: 'xTribNac', selector: 'infNFSe > xTribNac, xTribNac', label: 'Tributação Nacional ISSQN', description: 'Descrição do código de tributação nacional do ISSQN.' },
      { id: 'xTribMun', tag: 'xTribMun', selector: 'infNFSe > xTribMun, xTribMun', label: 'Tributação Municipal ISSQN', description: 'Descrição do código de tributação municipal do ISSQN.' },
      { id: 'xNBS', tag: 'xNBS', selector: 'infNFSe > xNBS, xNBS', label: 'Descrição NBS', description: 'Descrição do código da NBS.' },
      { id: 'verAplic', tag: 'verAplic', selector: 'infNFSe > verAplic', label: 'Versão Aplicação', description: 'Versão da aplicação que gerou a NFS-e.' },
      { id: 'ambGer', tag: 'ambGer', selector: 'infNFSe > ambGer, ambGer', label: 'Ambiente Gerador', description: '1-Sistema Próprio do Município; 2-Sefin Nacional NFS-e.' },
      { id: 'tpEmis', tag: 'tpEmis', selector: 'infNFSe > tpEmis, tpEmis', label: 'Tipo de Emissão', description: '1-Direta no modelo Nacional; 2-Leiaute próprio do município.' },
      { id: 'procEmi', tag: 'procEmi', selector: 'infNFSe > procEmi, procEmi', label: 'Processo de Emissão', description: '1-API; 2-Web; 3-App.' },
      { id: 'cStat', tag: 'cStat', selector: 'infNFSe > cStat, cStat', label: 'Situação NFS-e', description: '100-Gerada; 102-Decisão Judicial; 103-Avulsa; 107-MEI.' },
      { id: 'dhProc', tag: 'dhProc', selector: 'infNFSe > dhProc, dhProc', label: 'Data/Hora Processamento', description: 'Data/Hora do processamento (geração) NFS-e.' },
      { id: 'nDFSe', tag: 'nDFSe', selector: 'infNFSe > nDFSe, nDFSe', label: 'Número DFSe', description: 'Número sequencial do documento gerado por ambiente gerador de DFe.' },
      { id: 'xOutInf', tag: 'xOutInf', selector: 'infNFSe > xOutInf, xOutInf', label: 'Outras Informações', description: 'Uso da Administração Tributária Municipal.' }
    ]
  },
  {
    id: 'emit',
    label: 'Emitente',
    description: 'Dados do emitente da NFS-e',
    fields: [
      { id: 'emit_CNPJ', tag: 'CNPJ', selector: 'emit > CNPJ', label: 'CNPJ Emitente', description: 'Número da inscrição federal (CNPJ) do emitente.' },
      { id: 'emit_CPF', tag: 'CPF', selector: 'emit > CPF', label: 'CPF Emitente', description: 'Número da inscrição federal (CPF) do emitente.' },
      { id: 'emit_IM', tag: 'IM', selector: 'emit > IM', label: 'Inscrição Municipal Emitente', description: 'Número do indicador municipal do emitente.' },
      { id: 'emit_xNome', tag: 'xNome', selector: 'emit > xNome', label: 'Nome/Razão Social Emitente', description: 'Nome / Razão Social do emitente.' },
      { id: 'emit_xFant', tag: 'xFant', selector: 'emit > xFant', label: 'Nome Fantasia Emitente', description: 'Nome / Fantasia do emitente.' },
      { id: 'emit_xLgr', tag: 'xLgr', selector: 'emit enderNac xLgr', label: 'Logradouro Emitente', description: 'Logradouro do endereço do emitente.' },
      { id: 'emit_nro', tag: 'nro', selector: 'emit enderNac nro', label: 'Número Emitente', description: 'Número do imóvel do endereço do emitente.' },
      { id: 'emit_xCpl', tag: 'xCpl', selector: 'emit enderNac xCpl', label: 'Complemento Emitente', description: 'Complemento do endereço do emitente.' },
      { id: 'emit_xBairro', tag: 'xBairro', selector: 'emit enderNac xBairro', label: 'Bairro Emitente', description: 'Bairro do endereço do emitente.' },
      { id: 'emit_cMun', tag: 'cMun', selector: 'emit enderNac cMun', label: 'Cód. Município Emitente', description: 'Código do município (IBGE) do emitente.' },
      { id: 'emit_UF', tag: 'UF', selector: 'emit enderNac UF', label: 'UF Emitente', description: 'Sigla da UF do emitente.' },
      { id: 'emit_CEP', tag: 'CEP', selector: 'emit enderNac CEP', label: 'CEP Emitente', description: 'CEP do endereço do emitente.' },
      { id: 'emit_fone', tag: 'fone', selector: 'emit > fone', label: 'Telefone Emitente', description: 'Número do telefone do emitente.' },
      { id: 'emit_email', tag: 'email', selector: 'emit > email', label: 'E-mail Emitente', description: 'E-mail do emitente.' }
    ]
  },
  {
    id: 'valoresNFSe',
    label: 'Valores NFS-e',
    description: 'Valores referentes ao serviço prestado (calculados)',
    fields: [
      { id: 'val_vCalcDR', tag: 'vCalcDR', selector: 'infNFSe > valores > vCalcDR, valores vCalcDR', label: 'DED/RED BC (vCalcDR)', description: 'Valor de dedução/redução da base de cálculo do ISSQN.' },
      { id: 'val_tpBM', tag: 'tpBM', selector: 'infNFSe > valores > tpBM, valores tpBM', label: 'Tipo Benefício Municipal (tpBM)', description: '1-Isenção; 2-Redução BC %; 3-Redução BC R$; 4-Alíquota Diferenciada.' },
      { id: 'val_vCalcBM', tag: 'vCalcBM', selector: 'infNFSe > valores > vCalcBM, valores vCalcBM', label: 'Valor Benefício Municipal (vCalcBM)', description: 'Valor da redução da BC devido a benefício municipal.' },
      { id: 'val_vBC', tag: 'vBC', selector: 'infNFSe > valores > vBC, valores vBC', label: 'Base Cálculo ISSQN (vBC)', description: 'Valor da Base de Cálculo do ISSQN.' },
      { id: 'val_pAliqAplic', tag: 'pAliqAplic', selector: 'infNFSe > valores > pAliqAplic, valores pAliqAplic', label: 'Alíquota ISSQN % (pAliqAplic)', description: 'Alíquota aplicada sobre a BC para apuração do ISSQN.' },
      { id: 'val_vISSQN', tag: 'vISSQN', selector: 'infNFSe > valores > vISSQN, valores vISSQN', label: 'Valor ISSQN (vISSQN)', description: 'Valor do ISSQN = vBC x pAliqAplic.' },
      { id: 'val_vTotalRet', tag: 'vTotalRet', selector: 'infNFSe > valores > vTotalRet, valores vTotalRet', label: 'Total Retenções (vTotalRet)', description: 'Valor total de retenções (CP+IRRF+CSLL+ISSQN+PIS+COFINS).' },
      { id: 'val_vLiq', tag: 'vLiq', selector: 'infNFSe > valores > vLiq, valores vLiq', label: 'Valor Líquido (vLiq)', description: 'Valor líquido do serviço.' }
    ]
  },
  {
    id: 'IBSCBS_NFSe',
    label: 'IBS/CBS (NFS-e)',
    description: 'Informações geradas pelo sistema referentes ao IBS e à CBS',
    fields: [
      { id: 'ibsnfse_cLocalidadeIncid', tag: 'cLocalidadeIncid', selector: 'infNFSe > IBSCBS > cLocalidadeIncid', label: 'Cód. Localidade Incidência IBS/CBS', description: 'Código IBGE da localidade de incidência do IBS/CBS.' },
      { id: 'ibsnfse_xLocalidadeIncid', tag: 'xLocalidadeIncid', selector: 'infNFSe > IBSCBS > xLocalidadeIncid', label: 'Localidade Incidência IBS/CBS', description: 'Nome da localidade de incidência do IBS/CBS.' },
      { id: 'ibsnfse_pRedutor', tag: 'pRedutor', selector: 'infNFSe > IBSCBS > pRedutor', label: '% Redutor Compra Governamental', description: 'Percentual de redução de alíquota em compra governamental.' },
      { id: 'ibsnfse_vBC', tag: 'vBC', selector: 'infNFSe > IBSCBS > valores > vBC', label: 'BC IBS/CBS (vBC)', description: 'Base de cálculo do IBS/CBS antes das reduções.' },
      { id: 'ibsnfse_vCalcReeRepRes', tag: 'vCalcReeRepRes', selector: 'infNFSe > IBSCBS > valores > vCalcReeRepRes', label: 'Reembolso/Repasse/Ressarcimento', description: 'Valor total relativo a operações de terceiros.' },
      { id: 'ibsnfse_pIBSUF', tag: 'pIBSUF', selector: 'infNFSe > IBSCBS > valores > uf > pIBSUF', label: 'Alíquota IBS UF (%)', description: 'Alíquota da UF para IBS.' },
      { id: 'ibsnfse_pRedAliqUF', tag: 'pRedAliqUF', selector: 'infNFSe > IBSCBS > valores > uf > pRedAliqUF', label: '% Redução Alíquota UF', description: 'Percentual de redução de alíquota estadual.' },
      { id: 'ibsnfse_pAliqEfetUF', tag: 'pAliqEfetUF', selector: 'infNFSe > IBSCBS > valores > uf > pAliqEfetUF', label: 'Alíquota Efetiva IBS UF (%)', description: 'Alíquota efetiva IBS estadual.' },
      { id: 'ibsnfse_pIBSMun', tag: 'pIBSMun', selector: 'infNFSe > IBSCBS > valores > mun > pIBSMun', label: 'Alíquota IBS Município (%)', description: 'Alíquota do Município para IBS.' },
      { id: 'ibsnfse_pRedAliqMun', tag: 'pRedAliqMun', selector: 'infNFSe > IBSCBS > valores > mun > pRedAliqMun', label: '% Redução Alíquota Município', description: 'Percentual de redução de alíquota municipal.' },
      { id: 'ibsnfse_pAliqEfetMun', tag: 'pAliqEfetMun', selector: 'infNFSe > IBSCBS > valores > mun > pAliqEfetMun', label: 'Alíquota Efetiva IBS Município (%)', description: 'Alíquota efetiva IBS municipal.' },
      { id: 'ibsnfse_pCBS', tag: 'pCBS', selector: 'infNFSe > IBSCBS > valores > fed > pCBS', label: 'Alíquota CBS (%)', description: 'Alíquota da União para CBS.' },
      { id: 'ibsnfse_pRedAliqCBS', tag: 'pRedAliqCBS', selector: 'infNFSe > IBSCBS > valores > fed > pRedAliqCBS', label: '% Redução Alíquota CBS', description: 'Percentual da redução de alíquota da CBS.' },
      { id: 'ibsnfse_pAliqEfetCBS', tag: 'pAliqEfetCBS', selector: 'infNFSe > IBSCBS > valores > fed > pAliqEfetCBS', label: 'Alíquota Efetiva CBS (%)', description: 'Alíquota efetiva CBS.' },
      { id: 'ibsnfse_vTotNF', tag: 'vTotNF', selector: 'totCIBS > vTotNF', label: 'Valor Total NF (vTotNF)', description: 'Valor Total da NF considerando IBS e CBS.' },
      { id: 'ibsnfse_vIBSTot', tag: 'vIBSTot', selector: 'gIBS > vIBSTot', label: 'Total IBS (vIBSTot)', description: 'Valor total do IBS = vIBSUF + vIBSMun.' },
      { id: 'ibsnfse_pCredPresIBS', tag: 'pCredPresIBS', selector: 'gIBSCredPres > pCredPresIBS', label: 'Alíquota Crédito Presumido IBS (%)', description: 'Alíquota do crédito presumido para o IBS.' },
      { id: 'ibsnfse_vCredPresIBS', tag: 'vCredPresIBS', selector: 'gIBSCredPres > vCredPresIBS', label: 'Valor Crédito Presumido IBS', description: 'Valor do Crédito Presumido para o IBS.' },
      { id: 'ibsnfse_vDifUF', tag: 'vDifUF', selector: 'gIBSUFTot > vDifUF', label: 'Diferimento IBS UF', description: 'Total do Diferimento do IBS estadual.' },
      { id: 'ibsnfse_vIBSUF', tag: 'vIBSUF', selector: 'gIBSUFTot > vIBSUF', label: 'Valor IBS UF', description: 'Total valor do IBS estadual.' },
      { id: 'ibsnfse_vDifMun', tag: 'vDifMun', selector: 'gIBSMunTot > vDifMun', label: 'Diferimento IBS Município', description: 'Total do Diferimento do IBS municipal.' },
      { id: 'ibsnfse_vIBSMun', tag: 'vIBSMun', selector: 'gIBSMunTot > vIBSMun', label: 'Valor IBS Município', description: 'Total valor do IBS municipal.' },
      { id: 'ibsnfse_pCredPresCBS', tag: 'pCredPresCBS', selector: 'gCBSCredPres > pCredPresCBS', label: 'Alíquota Crédito Presumido CBS (%)', description: 'Alíquota do crédito presumido para a CBS.' },
      { id: 'ibsnfse_vCredPresCBS', tag: 'vCredPresCBS', selector: 'gCBSCredPres > vCredPresCBS', label: 'Valor Crédito Presumido CBS', description: 'Valor do Crédito Presumido da CBS.' },
      { id: 'ibsnfse_vDifCBS', tag: 'vDifCBS', selector: 'gCBS > vDifCBS', label: 'Diferimento CBS', description: 'Total do Diferimento CBS.' },
      { id: 'ibsnfse_vCBS', tag: 'vCBS', selector: 'gCBS > vCBS', label: 'Valor CBS', description: 'Total valor da CBS da União.' },
      { id: 'ibsnfse_pAliqEfeRegIBSUF', tag: 'pAliqEfeRegIBSUF', selector: 'gTribRegular > pAliqEfeRegIBSUF', label: 'Alíq. Efetiva Trib. Regular IBS UF', description: 'Alíquota efetiva de tributação regular do IBS estadual.' },
      { id: 'ibsnfse_vTribRegIBSUF', tag: 'vTribRegIBSUF', selector: 'gTribRegular > vTribRegIBSUF', label: 'Valor Trib. Regular IBS UF', description: 'Valor da tributação regular do IBS estadual.' },
      { id: 'ibsnfse_pAliqEfeRegIBSMun', tag: 'pAliqEfeRegIBSMun', selector: 'gTribRegular > pAliqEfeRegIBSMun', label: 'Alíq. Efetiva Trib. Regular IBS Mun', description: 'Alíquota efetiva de tributação regular do IBS municipal.' },
      { id: 'ibsnfse_vTribRegIBSMun', tag: 'vTribRegIBSMun', selector: 'gTribRegular > vTribRegIBSMun', label: 'Valor Trib. Regular IBS Mun', description: 'Valor da tributação regular do IBS municipal.' },
      { id: 'ibsnfse_pAliqEfeRegCBS', tag: 'pAliqEfeRegCBS', selector: 'gTribRegular > pAliqEfeRegCBS', label: 'Alíq. Efetiva Trib. Regular CBS', description: 'Alíquota efetiva de tributação regular da CBS.' },
      { id: 'ibsnfse_vTribRegCBS', tag: 'vTribRegCBS', selector: 'gTribRegular > vTribRegCBS', label: 'Valor Trib. Regular CBS', description: 'Valor da tributação regular da CBS.' },
      { id: 'ibsnfse_gov_pIBSUF', tag: 'pIBSUF', selector: 'gTribCompraGov > pIBSUF', label: 'Alíq. IBS UF Compra Gov.', description: 'Alíquota do IBS UF em compras governamentais.' },
      { id: 'ibsnfse_gov_vIBSUF', tag: 'vIBSUF', selector: 'gTribCompraGov > vIBSUF', label: 'Valor IBS UF Compra Gov.', description: 'Valor do IBS da UF em compras governamentais.' },
      { id: 'ibsnfse_gov_pIBSMun', tag: 'pIBSMun', selector: 'gTribCompraGov > pIBSMun', label: 'Alíq. IBS Mun Compra Gov.', description: 'Alíquota do IBS Município em compras governamentais.' },
      { id: 'ibsnfse_gov_vIBSMun', tag: 'vIBSMun', selector: 'gTribCompraGov > vIBSMun', label: 'Valor IBS Mun Compra Gov.', description: 'Valor do IBS do Município em compras governamentais.' },
      { id: 'ibsnfse_gov_pCBS', tag: 'pCBS', selector: 'gTribCompraGov > pCBS', label: 'Alíq. CBS Compra Gov.', description: 'Alíquota da CBS em compras governamentais.' },
      { id: 'ibsnfse_gov_vCBS', tag: 'vCBS', selector: 'gTribCompraGov > vCBS', label: 'Valor CBS Compra Gov.', description: 'Valor da CBS em compras governamentais.' }
    ]
  },
  {
    id: 'dps',
    label: 'DPS (Declaração de Prestação de Serviços)',
    description: 'Informações da Declaração de Prestação de Serviços',
    fields: [
      { id: 'dps_versao', tag: 'versao', selector: 'DPS > versao', label: 'Versão DPS', description: 'Versão do leiaute da DPS.' },
      { id: 'dps_id', tag: 'Id', selector: 'infDPS', attr: 'Id', label: 'Chave DPS', description: 'Chave de 42 dígitos da DPS (sem prefixo DPS).' },
      { id: 'dps_tpAmb', tag: 'tpAmb', selector: 'infDPS > tpAmb, tpAmb', label: 'Tipo Ambiente', description: '1-Produção; 2-Homologação.' },
      { id: 'dps_dhEmi', tag: 'dhEmi', selector: 'infDPS > dhEmi, dhEmi', label: 'Data/Hora Emissão DPS', description: 'Data e hora da emissão da DPS.' },
      { id: 'dps_verAplic', tag: 'verAplic', selector: 'infDPS > verAplic', label: 'Versão Aplicativo DPS', description: 'Versão do aplicativo que gerou a DPS.' },
      { id: 'dps_serie', tag: 'serie', selector: 'infDPS > serie, serie', label: 'Série DPS', description: 'Série da DPS.' },
      { id: 'dps_nDPS', tag: 'nDPS', selector: 'infDPS > nDPS, nDPS', label: 'Número DPS', description: 'Número da DPS.' },
      { id: 'dps_dCompet', tag: 'dCompet', selector: 'dCompet', label: 'Data de Competência', description: 'Data de competência da prestação do serviço.' },
      { id: 'dps_tpEmit', tag: 'tpEmit', selector: 'infDPS > tpEmit, tpEmit', label: 'Tipo Emitente DPS', description: '1-Prestador; 2-Tomador; 3-Intermediário.' },
      { id: 'dps_cMotivoEmisTI', tag: 'cMotivoEmisTI', selector: 'infDPS > cMotivoEmisTI, cMotivoEmisTI', label: 'Motivo Emissão Tomador/Intermediário', description: 'Motivo da Emissão da DPS pelo Tomador/Intermediário.' },
      { id: 'dps_chNFSeRej', tag: 'chNFSeRej', selector: 'infDPS > chNFSeRej, chNFSeRej', label: 'Chave NFS-e Rejeitada', description: 'Chave de Acesso da NFS-e rejeitada.' },
      { id: 'dps_cLocEmi', tag: 'cLocEmi', selector: 'infDPS > cLocEmi', label: 'Cód. Localidade Emissão DPS', description: 'Código de 7 dígitos da localidade emissora.' }
    ]
  },
  {
    id: 'subst',
    label: 'Substituição',
    description: 'Informações relativas à NFS-e substituída',
    fields: [
      { id: 'subst_chSubstda', tag: 'chSubstda', selector: 'subst > chSubstda, chSubstda', label: 'Chave NFS-e Substituída', description: 'Chave de Acesso da NFS-e a ser substituída.' },
      { id: 'subst_cMotivo', tag: 'cMotivo', selector: 'subst > cMotivo', label: 'Cód. Motivo Substituição', description: '01 a 05 e 99-Outros.' },
      { id: 'subst_xMotivo', tag: 'xMotivo', selector: 'subst > xMotivo', label: 'Descrição Motivo Substituição', description: 'Motivo quando cMotivo=99.' }
    ]
  },
  {
    id: 'prest',
    label: 'Prestador',
    description: 'Dados do prestador do serviço',
    fields: [
      { id: 'prest_CNPJ', tag: 'CNPJ', selector: 'prest > CNPJ', label: 'CNPJ Prestador', description: 'CNPJ do prestador do serviço.' },
      { id: 'prest_CPF', tag: 'CPF', selector: 'prest > CPF', label: 'CPF Prestador', description: 'CPF do prestador do serviço.' },
      { id: 'prest_NIF', tag: 'NIF', selector: 'prest > NIF', label: 'NIF Prestador', description: 'Identificação fiscal no exterior.' },
      { id: 'prest_cNaoNIF', tag: 'cNaoNIF', selector: 'prest > cNaoNIF', label: 'Motivo Não NIF Prestador', description: '0-Não informado; 1-Dispensado; 2-Não exigência.' },
      { id: 'prest_CAEPF', tag: 'CAEPF', selector: 'prest > CAEPF', label: 'CAEPF Prestador', description: 'Cadastro de Atividade Econômica da Pessoa Física.' },
      { id: 'prest_IM', tag: 'IM', selector: 'prest > IM', label: 'Inscrição Municipal Prestador', description: 'Indicador municipal do prestador.' },
      { id: 'prest_xNome', tag: 'xNome', selector: 'prest > xNome, emit > xNome', label: 'Nome Prestador', description: 'Nome / Nome Empresarial do prestador (= emitente no schema Nacional).' },
      { id: 'prest_cMun', tag: 'cMun', selector: 'prest end endNac cMun', label: 'Cód. Município Prestador', description: 'Código do município (IBGE) do prestador.' },
      { id: 'prest_CEP', tag: 'CEP', selector: 'prest end endNac CEP', label: 'CEP Prestador', description: 'CEP do endereço do prestador.' },
      { id: 'prest_cPais', tag: 'cPais', selector: 'prest end endExt cPais', label: 'Cód. País Prestador', description: 'Código do país (Tabela ISO) do prestador.' },
      { id: 'prest_cEndPost', tag: 'cEndPost', selector: 'prest end endExt cEndPost', label: 'Cód. Postal Exterior Prestador', description: 'Código Postal no exterior do prestador.' },
      { id: 'prest_xCidade', tag: 'xCidade', selector: 'prest end endExt xCidade', label: 'Cidade Exterior Prestador', description: 'Cidade no exterior do prestador.' },
      { id: 'prest_xEstProvReg', tag: 'xEstProvReg', selector: 'prest end endExt xEstProvReg', label: 'Estado/Província Prestador', description: 'Estado/província do prestador no exterior.' },
      { id: 'prest_xLgr', tag: 'xLgr', selector: 'prest end > xLgr', label: 'Logradouro Prestador', description: 'Logradouro do prestador.' },
      { id: 'prest_nro', tag: 'nro', selector: 'prest end > nro', label: 'Número Prestador', description: 'Número do endereço do prestador.' },
      { id: 'prest_xCpl', tag: 'xCpl', selector: 'prest end > xCpl', label: 'Complemento Prestador', description: 'Complemento do endereço do prestador.' },
      { id: 'prest_xBairro', tag: 'xBairro', selector: 'prest end > xBairro', label: 'Bairro Prestador', description: 'Bairro do endereço do prestador.' },
      { id: 'prest_fone', tag: 'fone', selector: 'prest > fone', label: 'Telefone Prestador', description: 'Telefone do prestador.' },
      { id: 'prest_email', tag: 'email', selector: 'prest > email', label: 'E-mail Prestador', description: 'E-mail do prestador.' },
      { id: 'prest_opSimpNac', tag: 'opSimpNac', selector: 'regTrib > opSimpNac, opSimpNac', label: 'Simples Nacional', description: '1-Não Optante; 2-MEI; 3-ME/EPP.' },
      { id: 'prest_regApTribSN', tag: 'regApTribSN', selector: 'regTrib > regApTribSN, regApTribSN', label: 'Regime Apuração SN', description: 'Regime de Apuração Tributária pelo Simples Nacional.' },
      { id: 'prest_regEspTrib', tag: 'regEspTrib', selector: 'regTrib > regEspTrib, regEspTrib', label: 'Regime Especial Tributação', description: '0-Nenhum; 1-Cooperativa; 2-Estimativa; etc.' }
    ]
  },
  {
    id: 'toma',
    label: 'Tomador',
    description: 'Dados do tomador do serviço',
    fields: [
      { id: 'toma_CNPJ', tag: 'CNPJ', selector: 'toma > CNPJ', label: 'CNPJ Tomador', description: 'CNPJ do tomador do serviço.' },
      { id: 'toma_CPF', tag: 'CPF', selector: 'toma > CPF', label: 'CPF Tomador', description: 'CPF do tomador do serviço.' },
      { id: 'toma_NIF', tag: 'NIF', selector: 'toma > NIF', label: 'NIF Tomador', description: 'Identificação fiscal no exterior.' },
      { id: 'toma_cNaoNIF', tag: 'cNaoNIF', selector: 'toma > cNaoNIF', label: 'Motivo Não NIF Tomador', description: '0-Não informado; 1-Dispensado; 2-Não exigência.' },
      { id: 'toma_CAEPF', tag: 'CAEPF', selector: 'toma > CAEPF', label: 'CAEPF Tomador', description: 'Cadastro de Atividade Econômica da Pessoa Física.' },
      { id: 'toma_IM', tag: 'IM', selector: 'toma > IM', label: 'Inscrição Municipal Tomador', description: 'Indicador municipal do tomador.' },
      { id: 'toma_xNome', tag: 'xNome', selector: 'toma > xNome', label: 'Nome Tomador', description: 'Nome / Nome Empresarial do tomador.' },
      { id: 'toma_cMun', tag: 'cMun', selector: 'toma end endNac cMun', label: 'Cód. Município Tomador', description: 'Código do município (IBGE) do tomador.' },
      { id: 'toma_CEP', tag: 'CEP', selector: 'toma end endNac CEP', label: 'CEP Tomador', description: 'CEP do endereço do tomador.' },
      { id: 'toma_cPais', tag: 'cPais', selector: 'toma end endExt cPais', label: 'Cód. País Tomador', description: 'Código do país (Tabela ISO) do tomador.' },
      { id: 'toma_cEndPost', tag: 'cEndPost', selector: 'toma end endExt cEndPost', label: 'Cód. Postal Exterior Tomador', description: 'Código Postal no exterior do tomador.' },
      { id: 'toma_xCidade', tag: 'xCidade', selector: 'toma end endExt xCidade', label: 'Cidade Exterior Tomador', description: 'Cidade no exterior do tomador.' },
      { id: 'toma_xEstProvReg', tag: 'xEstProvReg', selector: 'toma end endExt xEstProvReg', label: 'Estado/Província Tomador', description: 'Estado/província do tomador no exterior.' },
      { id: 'toma_xLgr', tag: 'xLgr', selector: 'toma end > xLgr', label: 'Logradouro Tomador', description: 'Logradouro do tomador.' },
      { id: 'toma_nro', tag: 'nro', selector: 'toma end > nro', label: 'Número Tomador', description: 'Número do endereço do tomador.' },
      { id: 'toma_xCpl', tag: 'xCpl', selector: 'toma end > xCpl', label: 'Complemento Tomador', description: 'Complemento do endereço do tomador.' },
      { id: 'toma_xBairro', tag: 'xBairro', selector: 'toma end > xBairro', label: 'Bairro Tomador', description: 'Bairro do endereço do tomador.' },
      { id: 'toma_fone', tag: 'fone', selector: 'toma > fone', label: 'Telefone Tomador', description: 'Telefone do tomador.' },
      { id: 'toma_email', tag: 'email', selector: 'toma > email', label: 'E-mail Tomador', description: 'E-mail do tomador.' }
    ]
  },
  {
    id: 'interm',
    label: 'Intermediário',
    description: 'Dados do intermediário do serviço',
    fields: [
      { id: 'interm_CNPJ', tag: 'CNPJ', selector: 'interm > CNPJ', label: 'CNPJ Intermediário', description: 'CNPJ do intermediário.' },
      { id: 'interm_CPF', tag: 'CPF', selector: 'interm > CPF', label: 'CPF Intermediário', description: 'CPF do intermediário.' },
      { id: 'interm_NIF', tag: 'NIF', selector: 'interm > NIF', label: 'NIF Intermediário', description: 'Identificação fiscal no exterior.' },
      { id: 'interm_cNaoNIF', tag: 'cNaoNIF', selector: 'interm > cNaoNIF', label: 'Motivo Não NIF Intermediário', description: '0-Não informado; 1-Dispensado; 2-Não exigência.' },
      { id: 'interm_CAEPF', tag: 'CAEPF', selector: 'interm > CAEPF', label: 'CAEPF Intermediário', description: 'Cadastro de Atividade Econômica da Pessoa Física.' },
      { id: 'interm_IM', tag: 'IM', selector: 'interm > IM', label: 'Inscrição Municipal Intermediário', description: 'Indicador municipal do intermediário.' },
      { id: 'interm_xNome', tag: 'xNome', selector: 'interm > xNome', label: 'Nome Intermediário', description: 'Nome / Nome Empresarial do intermediário.' },
      { id: 'interm_cMun', tag: 'cMun', selector: 'interm end endNac cMun', label: 'Cód. Município Intermediário', description: 'Código do município (IBGE) do intermediário.' },
      { id: 'interm_CEP', tag: 'CEP', selector: 'interm end endNac CEP', label: 'CEP Intermediário', description: 'CEP do intermediário.' },
      { id: 'interm_xLgr', tag: 'xLgr', selector: 'interm end > xLgr', label: 'Logradouro Intermediário', description: 'Logradouro do intermediário.' },
      { id: 'interm_nro', tag: 'nro', selector: 'interm end > nro', label: 'Número Intermediário', description: 'Número do endereço do intermediário.' },
      { id: 'interm_xCpl', tag: 'xCpl', selector: 'interm end > xCpl', label: 'Complemento Intermediário', description: 'Complemento do endereço do intermediário.' },
      { id: 'interm_xBairro', tag: 'xBairro', selector: 'interm end > xBairro', label: 'Bairro Intermediário', description: 'Bairro do endereço do intermediário.' },
      { id: 'interm_fone', tag: 'fone', selector: 'interm > fone', label: 'Telefone Intermediário', description: 'Telefone do intermediário.' },
      { id: 'interm_email', tag: 'email', selector: 'interm > email', label: 'E-mail Intermediário', description: 'E-mail do intermediário.' }
    ]
  },
  {
    id: 'serv',
    label: 'Serviço',
    description: 'Informações relativas ao serviço prestado',
    fields: [
      { id: 'serv_cLocPrestacao', tag: 'cLocPrestacao', selector: 'locPrest > cLocPrestacao, cLocPrestacao', label: 'Cód. Local Prestação', description: 'Código da localidade da prestação do serviço.' },
      { id: 'serv_cPaisPrestacao', tag: 'cPaisPrestacao', selector: 'locPrest > cPaisPrestacao, cPaisPrestacao', label: 'Cód. País Prestação', description: 'Código do país da prestação (Tabela ISO).' },
      { id: 'serv_cTribNac', tag: 'cTribNac', selector: 'cServ > cTribNac, cTribNac', label: 'Cód. Tributação Nacional', description: 'Código de tributação nacional do ISSQN (LC 116/2003).' },
      { id: 'serv_cTribMun', tag: 'cTribMun', selector: 'cServ > cTribMun, cTribMun', label: 'Cód. Tributação Municipal', description: 'Código de tributação municipal do ISSQN.' },
      { id: 'serv_xDescServ', tag: 'xDescServ', selector: 'cServ > xDescServ, xDescServ', label: 'Descrição do Serviço', description: 'Descrição completa do serviço prestado.' },
      { id: 'serv_cNBS', tag: 'cNBS', selector: 'cServ > cNBS, cNBS', label: 'Código NBS', description: 'Código NBS correspondente ao serviço.' },
      { id: 'serv_cIntContrib', tag: 'cIntContrib', selector: 'cServ > cIntContrib, cIntContrib', label: 'Cód. Interno Contribuinte', description: 'Código interno do contribuinte.' }
    ]
  },
  {
    id: 'comExt',
    label: 'Comércio Exterior',
    description: 'Transações com residentes/domiciliados no exterior',
    fields: [
      { id: 'comExt_mdPrestacao', tag: 'mdPrestacao', selector: 'comExt > mdPrestacao, mdPrestacao', label: 'Modo de Prestação', description: '0-Desconhecido; 1-Transfronteiriço; 2-Consumo no Brasil; etc.' },
      { id: 'comExt_vincPrest', tag: 'vincPrest', selector: 'comExt > vincPrest, vincPrest', label: 'Vínculo entre Partes', description: '0-Sem vínculo; 1-Controlada; 2-Controladora; etc.' },
      { id: 'comExt_tpMoeda', tag: 'tpMoeda', selector: 'comExt > tpMoeda, tpMoeda', label: 'Tipo Moeda', description: 'Código da moeda da transação comercial.' },
      { id: 'comExt_vServMoeda', tag: 'vServMoeda', selector: 'comExt > vServMoeda, vServMoeda', label: 'Valor Serviço Moeda Estrangeira', description: 'Valor do serviço em moeda estrangeira.' },
      { id: 'comExt_mecAFComexP', tag: 'mecAFComexP', selector: 'comExt > mecAFComexP, mecAFComexP', label: 'Mecanismo Apoio Comex Prestador', description: 'Mecanismo de apoio ao comércio exterior do prestador.' },
      { id: 'comExt_mecAFComexT', tag: 'mecAFComexT', selector: 'comExt > mecAFComexT, mecAFComexT', label: 'Mecanismo Apoio Comex Tomador', description: 'Mecanismo de apoio ao comércio exterior do tomador.' },
      { id: 'comExt_movTempBens', tag: 'movTempBens', selector: 'comExt > movTempBens, movTempBens', label: 'Mov. Temporária Bens', description: '0-Desconhecido; 1-Não; 2-Vinculada DI; 3-Vinculada DE.' },
      { id: 'comExt_nDI', tag: 'nDI', selector: 'comExt > nDI, nDI', label: 'Número DI', description: 'Número da Declaração de Importação.' },
      { id: 'comExt_nRE', tag: 'nRE', selector: 'comExt > nRE, nRE', label: 'Número RE', description: 'Número do Registro de Exportação.' },
      { id: 'comExt_mdic', tag: 'mdic', selector: 'comExt > mdic, mdic', label: 'Enviar ao MDIC', description: '0-Não enviar; 1-Enviar.' }
    ]
  },
  {
    id: 'obra',
    label: 'Obra',
    description: 'Informações relativas à obras de construção civil',
    fields: [
      { id: 'obra_inscImobFisc', tag: 'inscImobFisc', selector: 'obra > inscImobFisc', label: 'Inscrição Imobiliária Fiscal', description: 'Código fornecido pela prefeitura para identificação da obra.' },
      { id: 'obra_cObra', tag: 'cObra', selector: 'obra > cObra', label: 'Cód. Obra (CNO/CEI)', description: 'Número de identificação da obra (CNO ou CEI).' },
      { id: 'obra_cCIB', tag: 'cCIB', selector: 'obra > cCIB', label: 'Cód. CIB', description: 'Código do Cadastro Imobiliário Brasileiro.' },
      { id: 'obra_CEP', tag: 'CEP', selector: 'obra end CEP', label: 'CEP Obra', description: 'CEP do endereço da obra.' },
      { id: 'obra_xLgr', tag: 'xLgr', selector: 'obra end xLgr', label: 'Logradouro Obra', description: 'Logradouro da obra.' },
      { id: 'obra_nro', tag: 'nro', selector: 'obra end nro', label: 'Número Obra', description: 'Número do endereço da obra.' },
      { id: 'obra_xCpl', tag: 'xCpl', selector: 'obra end xCpl', label: 'Complemento Obra', description: 'Complemento do endereço da obra.' },
      { id: 'obra_xBairro', tag: 'xBairro', selector: 'obra end xBairro', label: 'Bairro Obra', description: 'Bairro da obra.' }
    ]
  },
  {
    id: 'atvEvento',
    label: 'Atividade de Evento',
    description: 'Informações relativas a atividades de eventos',
    fields: [
      { id: 'atvEvento_xNome', tag: 'xNome', selector: 'atvEvento > xNome', label: 'Nome do Evento', description: 'Nome do evento Artístico, Cultural, Esportivo.' },
      { id: 'atvEvento_dtIni', tag: 'dtIni', selector: 'atvEvento > dtIni', label: 'Data Início Evento', description: 'Data de início da atividade de evento.' },
      { id: 'atvEvento_dtFim', tag: 'dtFim', selector: 'atvEvento > dtFim', label: 'Data Fim Evento', description: 'Data de fim da atividade de evento.' },
      { id: 'atvEvento_idAtvEvt', tag: 'idAtvEvt', selector: 'atvEvento > idAtvEvt', label: 'ID Atividade Evento', description: 'Identificação da Atividade de Evento.' }
    ]
  },
  {
    id: 'infoCompl',
    label: 'Informações Complementares',
    description: 'Informações complementares do serviço prestado',
    fields: [
      { id: 'infoCompl_idDocTec', tag: 'idDocTec', selector: 'infoCompl > idDocTec, idDocTec', label: 'ID Doc. Responsabilidade Técnica', description: 'ART, RRT, DRT, Outros.' },
      { id: 'infoCompl_docRef', tag: 'docRef', selector: 'infoCompl > docRef, docRef', label: 'Documento de Referência', description: 'Chave da nota, número do contrato ou outro identificador.' },
      { id: 'infoCompl_xPed', tag: 'xPed', selector: 'infoCompl > xPed, xPed', label: 'Número do Pedido', description: 'Número do pedido/ordem de compra/ordem de serviço.' },
      { id: 'infoCompl_xItemPed', tag: 'xItemPed', selector: 'gItemPed > xItemPed, xItemPed', label: 'Item do Pedido', description: 'Número do item do pedido.' },
      { id: 'infoCompl_xInfComp', tag: 'xInfComp', selector: 'infoCompl > xInfComp, xInfComp', label: 'Informações Complementares', description: 'Campo livre para preenchimento pelo contribuinte.' }
    ]
  },
  {
    id: 'valoresDPS',
    label: 'Valores DPS',
    description: 'Valores do serviço prestado declarados na DPS',
    fields: [
      { id: 'vdps_vReceb', tag: 'vReceb', selector: 'vServPrest > vReceb, vReceb', label: 'Valor Recebido Intermediário (vReceb)', description: 'Valor recebido pelo intermediário.' },
      { id: 'vdps_vServ', tag: 'vServ', selector: 'vServPrest > vServ, vServ', label: 'Valor do Serviço (vServ)', description: 'Valor monetário do serviço.' },
      { id: 'vdps_vDescIncond', tag: 'vDescIncond', selector: 'vDescCondIncond > vDescIncond, vDescIncond', label: 'Desconto Incondicionado (vDescIncond)', description: 'Valor do desconto incondicionado.' },
      { id: 'vdps_vDescCond', tag: 'vDescCond', selector: 'vDescCondIncond > vDescCond, vDescCond', label: 'Desconto Condicionado (vDescCond)', description: 'Valor do desconto condicionado.' },
      { id: 'vdps_pDR', tag: 'pDR', selector: 'vDedRed > pDR', label: '% DED/RED (pDR)', description: 'Percentual padrão para dedução/redução.' },
      { id: 'vdps_vDR', tag: 'vDR', selector: 'vDedRed > vDR', label: 'Valor DED/RED (vDR)', description: 'Valor padrão para dedução/redução.' }
    ]
  },
  {
    id: 'tribMun',
    label: 'Tributação Municipal (ISSQN)',
    description: 'Tributos municipais relacionados ao serviço',
    fields: [
      { id: 'tribMun_tribISSQN', tag: 'tribISSQN', selector: 'tribMun > tribISSQN, tribISSQN', label: 'Tributação ISSQN', description: '1-Tributável; 2-Imunidade; 3-Exportação; 4-Não Incidência.' },
      { id: 'tribMun_cPaisResult', tag: 'cPaisResult', selector: 'tribMun > cPaisResult, cPaisResult', label: 'Cód. País Resultado', description: 'Código do país onde ocorreu o resultado.' },
      { id: 'tribMun_tpImunidade', tag: 'tpImunidade', selector: 'tribMun > tpImunidade, tpImunidade', label: 'Tipo Imunidade', description: '0 a 5 - Tipos de Imunidades.' },
      { id: 'tribMun_tpSusp', tag: 'tpSusp', selector: 'exigSusp > tpSusp, tpSusp', label: 'Tipo Suspensão Exigibilidade', description: '1-Decisão Judicial; 2-Processo Administrativo.' },
      { id: 'tribMun_nProcesso', tag: 'nProcesso', selector: 'exigSusp > nProcesso, nProcesso', label: 'Nº Processo Suspensão', description: 'Número do processo de suspensão.' },
      { id: 'tribMun_nBM', tag: 'nBM', selector: 'BM > nBM, nBM', label: 'ID Benefício Municipal', description: 'Identificador do benefício parametrizado pelo município.' },
      { id: 'tribMun_vRedBCBM', tag: 'vRedBCBM', selector: 'BM > vRedBCBM, vRedBCBM', label: 'Valor Redução BC por BM (vRedBCBM)', description: 'Valor para redução da BC por Benefício Municipal.' },
      { id: 'tribMun_pRedBCBM', tag: 'pRedBCBM', selector: 'BM > pRedBCBM, pRedBCBM', label: '% Redução BC por BM (pRedBCBM)', description: 'Percentual para redução da BC por Benefício Municipal.' },
      { id: 'tribMun_tpRetISSQN', tag: 'tpRetISSQN', selector: 'tribMun > tpRetISSQN, tpRetISSQN', label: 'Tipo Retenção ISSQN', description: '1-Não Retido; 2-Retido pelo Tomador; 3-Retido pelo Intermediário.' },
      { id: 'tribMun_pAliq', tag: 'pAliq', selector: 'tribMun > pAliq, pAliq', label: 'Alíquota ISSQN DPS (%)', description: 'Alíquota relativa ao município sujeito ativo.' }
    ]
  },
  {
    id: 'tribFed',
    label: 'Tributação Federal (PIS/COFINS/Retenções)',
    description: 'Tributos federais relacionados ao serviço',
    fields: [
      { id: 'tribFed_CST', tag: 'CST', selector: 'piscofins > CST, CST', label: 'CST PIS/COFINS', description: 'Código de Situação Tributária do PIS/COFINS.' },
      { id: 'tribFed_vBCPisCofins', tag: 'vBCPisCofins', selector: 'piscofins > vBCPisCofins, vBCPisCofins', label: 'BC PIS/COFINS (vBCPisCofins)', description: 'Base de Cálculo do PIS/COFINS.' },
      { id: 'tribFed_pAliqPis', tag: 'pAliqPis', selector: 'piscofins > pAliqPis, pAliqPis', label: 'Alíquota PIS (%)', description: 'Alíquota do PIS.' },
      { id: 'tribFed_pAliqCofins', tag: 'pAliqCofins', selector: 'piscofins > pAliqCofins, pAliqCofins', label: 'Alíquota COFINS (%)', description: 'Alíquota da COFINS.' },
      { id: 'tribFed_vPis', tag: 'vPis', selector: 'piscofins > vPis, vPis', label: 'Valor PIS (vPis)', description: 'Valor do PIS.' },
      { id: 'tribFed_vCofins', tag: 'vCofins', selector: 'piscofins > vCofins, vCofins', label: 'Valor COFINS (vCofins)', description: 'Valor da COFINS.' },
      { id: 'tribFed_tpRetPisCofins', tag: 'tpRetPisCofins', selector: 'piscofins > tpRetPisCofins, tpRetPisCofins', label: 'Tipo Retenção PIS/COFINS/CSLL', description: '0-Não Retidos; 1-PIS/COFINS Retido; 2-Não Retido; 3-Retidos; 4-PIS/COFINS Ret CSLL Não; 5-PIS Ret; 6-COFINS Ret; 7-PIS Não COFINS/CSLL Ret; 8-PIS/COFINS Não CSLL Ret; 9-COFINS Não PIS/CSLL Ret.' },
      { id: 'tribFed_vRetCP', tag: 'vRetCP', selector: 'tribFed > vRetCP, vRetCP', label: 'Retenção CP (vRetCP)', description: 'Valor da retenção de CP.' },
      { id: 'tribFed_vRetIRRF', tag: 'vRetIRRF', selector: 'tribFed > vRetIRRF, vRetIRRF', label: 'Retenção IRRF (vRetIRRF)', description: 'Valor da retenção de IRRF.' },
      { id: 'tribFed_vRetCSLL', tag: 'vRetCSLL', selector: 'tribFed > vRetCSLL, vRetCSLL', label: 'Retenção CSLL (vRetCSLL)', description: 'Valor da retenção de CSLL.' }
    ]
  },
  {
    id: 'totTrib',
    label: 'Totais de Tributos',
    description: 'Totais aproximados dos tributos (Lei 12.741/2012)',
    fields: [
      { id: 'totTrib_vTotTribFed', tag: 'vTotTribFed', selector: 'vTotTrib > vTotTribFed, vTotTribFed', label: 'Total Tributos Federais (vTotTribFed)', description: 'Total aproximado dos tributos federais.' },
      { id: 'totTrib_vTotTribEst', tag: 'vTotTribEst', selector: 'vTotTrib > vTotTribEst, vTotTribEst', label: 'Total Tributos Estaduais (vTotTribEst)', description: 'Total aproximado dos tributos estaduais.' },
      { id: 'totTrib_vTotTribMun', tag: 'vTotTribMun', selector: 'vTotTrib > vTotTribMun, vTotTribMun', label: 'Total Tributos Municipais (vTotTribMun)', description: 'Total aproximado dos tributos municipais.' },
      { id: 'totTrib_pTotTribFed', tag: 'pTotTribFed', selector: 'pTotTrib > pTotTribFed, pTotTribFed', label: '% Total Tributos Federais', description: 'Percentual total aproximado dos tributos federais.' },
      { id: 'totTrib_pTotTribEst', tag: 'pTotTribEst', selector: 'pTotTrib > pTotTribEst, pTotTribEst', label: '% Total Tributos Estaduais', description: 'Percentual total aproximado dos tributos estaduais.' },
      { id: 'totTrib_pTotTribMun', tag: 'pTotTribMun', selector: 'pTotTrib > pTotTribMun, pTotTribMun', label: '% Total Tributos Municipais', description: 'Percentual total aproximado dos tributos municipais.' },
      { id: 'totTrib_indTotTrib', tag: 'indTotTrib', selector: 'totTrib > indTotTrib, indTotTrib', label: 'Indicador Total Tributos', description: '0-Não informa valor estimado para Tributos.' },
      { id: 'totTrib_pTotTribSN', tag: 'pTotTribSN', selector: 'totTrib > pTotTribSN, pTotTribSN', label: '% Tributos Simples Nacional', description: 'Percentual aproximado do total dos tributos pelo Simples Nacional.' }
    ]
  },
  {
    id: 'IBSCBS_DPS',
    label: 'IBS/CBS (DPS)',
    description: 'Informações declaradas pelo emitente referentes ao IBS e à CBS',
    fields: [
      { id: 'ibsdps_finNFSe', tag: 'finNFSe', selector: 'infDPS > IBSCBS > finNFSe, finNFSe', label: 'Finalidade NFS-e', description: '0-NFS-e regular.' },
      { id: 'ibsdps_indFinal', tag: 'indFinal', selector: 'infDPS > IBSCBS > indFinal, indFinal', label: 'Consumo Pessoal', description: '0-Não; 1-Sim.' },
      { id: 'ibsdps_cIndOp', tag: 'cIndOp', selector: 'infDPS > IBSCBS > cIndOp, cIndOp', label: 'Cód. Indicador Operação', description: 'Código indicador da operação de fornecimento.' },
      { id: 'ibsdps_tpOper', tag: 'tpOper', selector: 'infDPS > IBSCBS > tpOper, tpOper', label: 'Tipo Operação', description: 'Tipo de operação com entes governamentais.' },
      { id: 'ibsdps_refNFSe', tag: 'refNFSe', selector: 'gRefNFSe > refNFSe, refNFSe', label: 'NFS-e Referenciada', description: 'Chave da NFS-e referenciada.' },
      { id: 'ibsdps_tpEnteGov', tag: 'tpEnteGov', selector: 'IBSCBS > tpEnteGov, tpEnteGov', label: 'Tipo Ente Governamental', description: '1-União; 2-Estado; 3-DF; 4-Município.' },
      { id: 'ibsdps_indDest', tag: 'indDest', selector: 'IBSCBS > indDest, indDest', label: 'Indicador Destinatário', description: '0-Tomador é o destinatário; 1-Destinatário diferente.' },
      { id: 'ibsdps_CST', tag: 'CST', selector: 'gIBSCBS > CST', label: 'CST IBS/CBS', description: 'Código de Situação Tributária do IBS e da CBS.' },
      { id: 'ibsdps_cClassTrib', tag: 'cClassTrib', selector: 'gIBSCBS > cClassTrib', label: 'Classificação Tributária IBS/CBS', description: 'Código de Classificação Tributária.' },
      { id: 'ibsdps_cCredPres', tag: 'cCredPres', selector: 'gIBSCBS > cCredPres', label: 'Crédito Presumido IBS/CBS', description: 'Código do crédito presumido.' },
      { id: 'ibsdps_CSTReg', tag: 'CSTReg', selector: 'gTribRegular > CSTReg', label: 'CST Tributação Regular', description: 'CST de tributação regular IBS/CBS.' },
      { id: 'ibsdps_cClassTribReg', tag: 'cClassTribReg', selector: 'gTribRegular > cClassTribReg', label: 'Classificação Trib. Regular', description: 'Classificação Tributária de tributação regular.' },
      { id: 'ibsdps_pDifUF', tag: 'pDifUF', selector: 'gDif > pDifUF', label: '% Diferimento IBS UF', description: 'Percentual de diferimento para IBS estadual.' },
      { id: 'ibsdps_pDifMun', tag: 'pDifMun', selector: 'gDif > pDifMun', label: '% Diferimento IBS Município', description: 'Percentual de diferimento para IBS municipal.' },
      { id: 'ibsdps_pDifCBS', tag: 'pDifCBS', selector: 'gDif > pDifCBS', label: '% Diferimento CBS', description: 'Percentual de diferimento para CBS.' }
    ]
  },
  {
    id: 'extras',
    label: 'Extras',
    description: 'Campos calculados e links úteis',
    fields: [
      { id: 'extra_urlConsulta', tag: 'URL', selector: '_computed_', computed: true, label: 'URL Consulta Pública', description: 'Link para consulta pública da NFS-e no portal nacional.' }
    ]
  }
];
