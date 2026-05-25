/************ CONFIG ************/
const API_BASE = 'https://api.tiny.com.br/public-api/v3';
const AUTH_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth';
const TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

const TINY_SHEET_NAME = 'Tiny';
const TINY_RAW_SHEET_NAME = 'Tiny_raw';
const TINY_CARGA_SHEET_NAME = 'Tiny_carga';
const USUARIOS_SHEET_NAME = 'usuarios';
const PAGE_LIMIT = 50;
const TAMANHO_LOTE_DETALHES = 10;
const CARGA_MAX_MS_POR_EXECUCAO = 5 * 60 * 1000;
const CARGA_MARGEM_PARADA_MS = 35 * 1000;
const CARGA_PROXIMA_EXECUCAO_MS = 10 * 1000;
const TINY_ANO_CELL = 'A2';
const TINY_MES_CELL = 'B2';
const TINY_CONTA_CELL = 'C2';
const TINY_STATUS_CELL = 'D2';
const TINY_PROGRESSO_CELL = 'E2';

const OLIST_CONTAS = [
  {
    key: 'CONTA1',
    clientIdProp: 'OLIST_CLIENT_ID_CONTA1',
    clientSecretProp: 'OLIST_CLIENT_SECRET_CONTA1',
    nameProp: 'OLIST_NOME_CONTA1',
    callbackFunction: 'authCallbackConta1'
  },
  {
    key: 'CONTA2',
    clientIdProp: 'OLIST_CLIENT_ID_CONTA2',
    clientSecretProp: 'OLIST_CLIENT_SECRET_CONTA2',
    nameProp: 'OLIST_NOME_CONTA2',
    callbackFunction: 'authCallbackConta2'
  },
  {
    key: 'CONTA3',
    clientIdProp: 'OLIST_CLIENT_ID_CONTA3',
    clientSecretProp: 'OLIST_CLIENT_SECRET_CONTA3',
    nameProp: 'OLIST_NOME_CONTA3',
    callbackFunction: 'authCallbackConta3'
  }
];

/************ MENU UNICO ************/
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('Resumo')
    .addItem('Atualizar resumo', 'atualizarResumo')
    .addToUi();

  ui.createMenu('Olist ERP')
    .addItem('Autorizar CONTA1', 'autorizarConta1')
    .addItem('Autorizar CONTA2', 'autorizarConta2')
    .addItem('Autorizar CONTA3', 'autorizarConta3')
    .addItem('Ver redirect URI', 'verRedirectUri')
    .addSeparator()
    .addItem('Iniciar carga do mês selecionado', 'cargaMesSelecionadoTinyRaw')
    .addItem('Continuar carga pendente', 'continuarCargaMesSegundoPlano')
    .addItem('Cancelar carga pendente', 'cancelarCargaMesSegundoPlano')
    .addItem('Atualizar hoje', 'atualizarHojeEResumo')
    .addSeparator()
    .addItem('Criar automação diária', 'criarTriggerDiario')
    .addItem('Apagar automações deste projeto', 'apagarTriggersDesteProjeto')
    .addSeparator()
    .addItem('Resetar autorizações', 'resetarOlist')
    .addToUi();
}

/************ OAUTH ************/
function getRedirectUri_() {
  return OAuth2.getRedirectUri();
}

function verRedirectUri() {
  const uri = getRedirectUri_();
  Logger.log(uri);
  SpreadsheetApp.getUi().alert(uri);
}

function getContaConfig_(contaKey) {
  const conta = OLIST_CONTAS.find(c => c.key === contaKey);
  if (!conta) throw new Error(`Conta inválida: ${contaKey}`);
  return conta;
}

function getContaNome_(contaKey) {
  const props = PropertiesService.getScriptProperties();
  const conta = getContaConfig_(contaKey);
  return props.getProperty(conta.nameProp) || conta.key;
}

function getOlistService_(contaKey) {
  const props = PropertiesService.getScriptProperties();
  const conta = getContaConfig_(contaKey);

  const clientId = props.getProperty(conta.clientIdProp);
  const clientSecret = props.getProperty(conta.clientSecretProp);

  if (!clientId || !clientSecret) {
    throw new Error(`Faltam credenciais da ${conta.key}: ${conta.clientIdProp} e/ou ${conta.clientSecretProp}.`);
  }

  return OAuth2.createService(`olist_erp_v3_${conta.key}`)
    .setAuthorizationBaseUrl(AUTH_URL)
    .setTokenUrl(TOKEN_URL)
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setCallbackFunction(conta.callbackFunction)
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('openid')
    .setRedirectUri(getRedirectUri_())
    .setParam('response_type', 'code');
}

function autorizarConta1() {
  autorizarOlistConta_('CONTA1');
}

function autorizarConta2() {
  autorizarOlistConta_('CONTA2');
}

function autorizarConta3() {
  autorizarOlistConta_('CONTA3');
}

function autorizarOlistConta_(contaKey) {
  const service = getOlistService_(contaKey);
  const nomeConta = getContaNome_(contaKey);

  if (service.hasAccess()) {
    SpreadsheetApp.getUi().alert(`${nomeConta} já está autorizada ✅`);
    return;
  }

  const url = service.getAuthorizationUrl();
  const html = HtmlService.createHtmlOutput(
    `<p>Clique para autorizar ${nomeConta}:</p>
     <p><a href="${url}" target="_blank" rel="noopener">Autorizar ${nomeConta}</a></p>`
  ).setWidth(430).setHeight(170);

  SpreadsheetApp.getUi().showModalDialog(html, `Autorizar ${nomeConta}`);
}

function authCallbackConta1(request) {
  return finalizarAuthConta_(request, 'CONTA1');
}

function authCallbackConta2(request) {
  return finalizarAuthConta_(request, 'CONTA2');
}

function authCallbackConta3(request) {
  return finalizarAuthConta_(request, 'CONTA3');
}

function finalizarAuthConta_(request, contaKey) {
  const service = getOlistService_(contaKey);
  const ok = service.handleCallback(request);

  if (ok) {
    return HtmlService.createHtmlOutput(`${getContaNome_(contaKey)} autorizada ✅ Pode voltar para a planilha.`);
  }

  return HtmlService.createHtmlOutput(`${getContaNome_(contaKey)} não autorizada ❌ Feche e tente novamente.`);
}

function resetarOlist() {
  OLIST_CONTAS.forEach(conta => getOlistService_(conta.key).reset());
  SpreadsheetApp.getUi().alert('Autorizações resetadas.');
}

/************ FUNCOES PRINCIPAIS ************/
function cargaMesSelecionadoTinyRaw() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const shRaw = ss.getSheetByName(TINY_RAW_SHEET_NAME) || ss.insertSheet(TINY_RAW_SHEET_NAME);
  const shCarga = ss.getSheetByName(TINY_CARGA_SHEET_NAME) || ss.insertSheet(TINY_CARGA_SHEET_NAME);

  inicializarCamposTiny_(shTiny);
  garantirCabecalhoRaw_(shRaw);
  garantirCabecalhoCarga_(shCarga);

  const ano = Number(shTiny.getRange(TINY_ANO_CELL).getValue());
  const mes = Number(shTiny.getRange(TINY_MES_CELL).getValue());

  if (!ano || !mes || mes < 1 || mes > 12) {
    throw new Error('Preencha A2 = ano e B2 = mês (1 a 12) na aba Tiny.');
  }

  const dataInicial = new Date(ano, mes - 1, 1);
  const dataFinal = new Date(ano, mes, 0);

  apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');
  limparFilaCarga_(shCarga);

  const tz = Session.getScriptTimeZone();
  const dataInicialStr = Utilities.formatDate(dataInicial, tz, 'yyyy-MM-dd');
  const dataFinalStr = Utilities.formatDate(dataFinal, tz, 'yyyy-MM-dd');
  const idsExistentes = carregarIdsExistentesRaw_(shRaw);
  const linhasFila = [];

  for (const contaKey of obterContasSelecionadas_()) {
    const service = getOlistService_(contaKey);
    if (!service.hasAccess()) {
      throw new Error(`Autorize primeiro a ${getContaNome_(contaKey)}.`);
    }

    escreverStatusCarga_(shTiny, `${getContaNome_(contaKey)}: montando fila do mês...`, '0%');
    SpreadsheetApp.flush();

    const headers = { Authorization: `Bearer ${service.getAccessToken()}` };
    const separacoes = listarSeparacoesEmbaladas_(headers, dataInicialStr, dataFinalStr);

    separacoes.forEach(sep => {
      const chaveExistente = `${contaKey}||${sep.id}`;
      if (sep.id && !idsExistentes[chaveExistente]) {
        linhasFila.push([
          contaKey,
          sep.id || '',
          sep.situacao || '',
          sep.dataCriacao || '',
          sep.dataSeparacao || '',
          sep.dataCheckout || '',
          sep.clienteNome || '',
          sep.vendaId || '',
          sep.vendaNumero || '',
          'PENDENTE',
          ''
        ]);
      }
    });
  }

  if (linhasFila.length) {
    shCarga.getRange(2, 1, linhasFila.length, linhasFila[0].length).setValues(linhasFila);
  }

  escreverStatusCarga_(shTiny, `Fila criada: ${linhasFila.length} separações pendentes`, linhasFila.length ? '0%' : '100%');
  SpreadsheetApp.flush();

  if (!linhasFila.length) {
    ss.toast('Nada novo para puxar neste mês.', 'Olist ERP', 5);
    return;
  }

  continuarCargaMesSegundoPlano();
}

function continuarCargaMesSegundoPlano() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const shRaw = ss.getSheetByName(TINY_RAW_SHEET_NAME) || ss.insertSheet(TINY_RAW_SHEET_NAME);
  const shCarga = ss.getSheetByName(TINY_CARGA_SHEET_NAME) || ss.insertSheet(TINY_CARGA_SHEET_NAME);

  inicializarCamposTiny_(shTiny);
  garantirCabecalhoRaw_(shRaw);
  garantirCabecalhoCarga_(shCarga);

  const inicioExecucaoMs = Date.now();
  const total = Math.max(shCarga.getLastRow() - 1, 0);
  const concluidasAntes = contarStatusCarga_(shCarga, 'OK');
  const errosAntes = contarStatusCarga_(shCarga, 'ERRO');
  let pendentes = obterPendentesCarga_(shCarga, TAMANHO_LOTE_DETALHES);

  if (!pendentes.length) {
    apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');
    escreverStatusCarga_(shTiny, `Carga completa: ${concluidasAntes} OK, ${errosAntes} erros`, '100%');
    SpreadsheetApp.flush();
    ss.toast('Carga do mês concluída.', 'Olist ERP', 5);
    return;
  }

  while (pendentes.length && podeContinuarExecucao_(inicioExecucaoMs)) {
    processarPendentesCarga_(ss, shRaw, shCarga, pendentes);

    const concluidasLoop = contarStatusCarga_(shCarga, 'OK');
    const errosLoop = contarStatusCarga_(shCarga, 'ERRO');
    const finalizadasLoop = concluidasLoop + errosLoop;
    const percentualLoop = total ? Math.round((finalizadasLoop / total) * 100) : 100;

    escreverStatusCarga_(shTiny, `Processado: ${finalizadasLoop}/${total} separações (${errosLoop} erros)`, `${percentualLoop}%`);
    SpreadsheetApp.flush();

    pendentes = obterPendentesCarga_(shCarga, TAMANHO_LOTE_DETALHES);
  }

  const concluidas = contarStatusCarga_(shCarga, 'OK');
  const erros = contarStatusCarga_(shCarga, 'ERRO');
  const finalizadas = concluidas + erros;
  const percentual = total ? Math.round((finalizadas / total) * 100) : 100;

  escreverStatusCarga_(shTiny, `Processado: ${finalizadas}/${total} separações (${erros} erros)`, `${percentual}%`);
  SpreadsheetApp.flush();

  if (finalizadas < total) {
    agendarContinuacaoCarga_();
  } else {
    apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');
    ss.toast('Carga do mês concluída.', 'Olist ERP', 5);
  }
}

function cancelarCargaMesSegundoPlano() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const shCarga = ss.getSheetByName(TINY_CARGA_SHEET_NAME) || ss.insertSheet(TINY_CARGA_SHEET_NAME);

  apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');
  limparFilaCarga_(shCarga);

  escreverStatusCarga_(shTiny, 'Carga pendente cancelada', '');
  SpreadsheetApp.flush();

  ss.toast('Carga pendente cancelada.', 'Olist ERP', 5);
}

function atualizarHojeEResumo() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  for (const contaKey of obterContasSelecionadas_()) {
    carregarPeriodoNoRaw_(inicio, fim, contaKey);
  }
}

function carregarPeriodoNoRaw_(dataInicial, dataFinal, contaKey) {
  const service = getOlistService_(contaKey);
  if (!service.hasAccess()) {
    throw new Error(`Autorize primeiro a ${getContaNome_(contaKey)}.`);
  }

  const token = service.getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shRaw = ss.getSheetByName(TINY_RAW_SHEET_NAME) || ss.insertSheet(TINY_RAW_SHEET_NAME);

  garantirCabecalhoRaw_(shRaw);

  const tz = Session.getScriptTimeZone();
  const dataInicialStr = Utilities.formatDate(dataInicial, tz, 'yyyy-MM-dd');
  const dataFinalStr = Utilities.formatDate(dataFinal, tz, 'yyyy-MM-dd');

  const mapaUsuariosPlanilha = carregarMapaUsuariosPlanilha_(ss);
  const idsExistentes = carregarIdsExistentesRaw_(shRaw);

  const separacoes = listarSeparacoesEmbaladas_(headers, dataInicialStr, dataFinalStr);

  const novasLinhas = [];
  let processadas = 0;
  const nomeConta = getContaNome_(contaKey);
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const totalSeparacoes = separacoes.length;

  escreverStatusCarga_(shTiny, `${nomeConta}: iniciando...`, totalSeparacoes ? '0%' : 'Sem separações');
  SpreadsheetApp.flush();

  for (const sep of separacoes) {
    const chaveExistente = `${contaKey}||${sep.id}`;
    if (idsExistentes[chaveExistente]) {
      processadas++;
      atualizarProgressoCarga_(shTiny, nomeConta, processadas, totalSeparacoes);
      continue;
    }
  }

  const separacoesNovas = separacoes.filter(sep => !idsExistentes[`${contaKey}||${sep.id}`]);

  for (let inicio = 0; inicio < separacoesNovas.length; inicio += TAMANHO_LOTE_DETALHES) {
    const lote = separacoesNovas.slice(inicio, inicio + TAMANHO_LOTE_DETALHES);
    const detalhes = obterSeparacoesEmLote_(headers, lote.map(sep => sep.id));

    for (let i = 0; i < lote.length; i++) {
      const sep = lote[i];
      const detalhe = detalhes[i];
      const chaveExistente = `${contaKey}||${sep.id}`;

      if (!detalhe) {
        processadas++;
        atualizarProgressoCarga_(shTiny, nomeConta, processadas, totalSeparacoes);
        continue;
      }

      const qtdItens = somarQtdItens_(detalhe.itens || []);
      const volumes = somarQtdVolumes_(detalhe.volumes || detalhe.volume || []);
      const idUsuario = String(detalhe.idUsuarioEmbalador || '').trim();

      const nomeUsuario =
        mapaUsuariosPlanilha[idUsuario] ||
        detalhe.nomeUsuarioEmbalador ||
        detalhe.usuarioEmbalador?.nome ||
        detalhe.usuario?.nome ||
        (idUsuario ? `Usuário ${idUsuario}` : 'Sem usuário');

      const dataCheckout =
        detalhe.dataCheckout ||
        detalhe.checkout?.data ||
        detalhe.dataExpedicao ||
        '';

      novasLinhas.push([
        detalhe.id || sep.id || '',
        detalhe.dataCriacao || sep.dataCriacao || '',
        detalhe.dataSeparacao || sep.dataSeparacao || '',
        dataCheckout,
        idUsuario,
        nomeUsuario,
        detalhe.situacao || sep.situacao || '',
        detalhe.venda?.id || sep.vendaId || '',
        detalhe.venda?.numero || sep.vendaNumero || '',
        detalhe.cliente?.nome || sep.clienteNome || '',
        qtdItens,
        volumes,
        contaKey
      ]);

      idsExistentes[chaveExistente] = true;
      processadas++;
      atualizarProgressoCarga_(shTiny, nomeConta, processadas, totalSeparacoes);
    }

    if (processadas % 20 === 0 || inicio + lote.length >= separacoesNovas.length) {
      ss.toast(`${nomeConta}: processadas ${processadas}/${totalSeparacoes} separações...`, 'Olist ERP', 3);
    }

    Utilities.sleep(250);
  }

  if (novasLinhas.length) {
    shRaw.getRange(shRaw.getLastRow() + 1, 1, novasLinhas.length, novasLinhas[0].length).setValues(novasLinhas);
  }

  shRaw.autoResizeColumns(1, 13);
  escreverStatusCarga_(shTiny, `${nomeConta}: concluído - ${novasLinhas.length} novas separações`, '100%');
  SpreadsheetApp.flush();
  ss.toast(`${nomeConta}: carga concluída - ${novasLinhas.length} novas separações`, 'Olist ERP', 5);
}

/************ API - SEPARACAO ************/
function listarSeparacoesEmbaladas_(headers, dataInicial, dataFinal) {
  const periodos = quebrarPeriodoEmBlocos_(dataInicial, dataFinal, 7);
  const todas = [];
  const idsVistos = {};

  periodos.forEach(p => {
    let offset = 0;
    let total = null;

    while (true) {
      const url =
        `${API_BASE}/separacao` +
        `?situacao=3` +
        `&dataInicial=${encodeURIComponent(p.inicio)}` +
        `&dataFinal=${encodeURIComponent(p.fim)}` +
        `&limit=${PAGE_LIMIT}` +
        `&offset=${offset}`;

      const resp = httpGetJson_(url, headers);
      const itens = resp?.itens || [];
      total = resp?.paginacao?.total ?? total;

      if (!itens.length) break;

      itens.forEach(item => {
        const id = item.id || '';
        if (id && !idsVistos[id]) {
          idsVistos[id] = true;
          todas.push({
            id: item.id || '',
            situacao: item.situacao || '',
            dataCriacao: item.dataCriacao || '',
            dataSeparacao: item.dataSeparacao || '',
            dataCheckout: item.dataCheckout || '',
            clienteNome: item?.cliente?.nome || '',
            vendaId: item?.venda?.id || '',
            vendaNumero: item?.venda?.numero || ''
          });
        }
      });

      offset += PAGE_LIMIT;
      Utilities.sleep(250);

      if (total !== null && offset >= total) break;
    }
  });

  return todas;
}

function obterSeparacao_(headers, idSeparacao) {
  const url = `${API_BASE}/separacao/${encodeURIComponent(idSeparacao)}`;
  return httpGetJson_(url, headers);
}

function obterSeparacoesEmLote_(headers, idsSeparacao) {
  const requests = idsSeparacao.map(idSeparacao => ({
    url: `${API_BASE}/separacao/${encodeURIComponent(idSeparacao)}`,
    method: 'get',
    headers,
    muteHttpExceptions: true
  }));

  const respostas = UrlFetchApp.fetchAll(requests);

  return respostas.map((resp, idx) => {
    const code = resp.getResponseCode();
    const text = resp.getContentText();

    if (code >= 200 && code < 300) {
      return JSON.parse(text);
    }

    if (code === 429 || code === 400 || (code >= 500 && code <= 599)) {
      Utilities.sleep(1200);
      return obterSeparacao_(headers, idsSeparacao[idx]);
    }

    throw new Error(`HTTP ${code} ao buscar separação ${idsSeparacao[idx]}\n${text}`);
  });
}

/************ APOIO ************/
function quebrarPeriodoEmBlocos_(dataInicialStr, dataFinalStr, diasPorBloco) {
  const periodos = [];
  const inicio = new Date(dataInicialStr + 'T00:00:00');
  const fim = new Date(dataFinalStr + 'T00:00:00');

  let atual = new Date(inicio);

  while (atual <= fim) {
    let blocoFim = new Date(atual);
    blocoFim.setDate(blocoFim.getDate() + diasPorBloco - 1);

    if (blocoFim > fim) blocoFim = new Date(fim);

    periodos.push({
      inicio: Utilities.formatDate(atual, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      fim: Utilities.formatDate(blocoFim, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    });

    atual = new Date(blocoFim);
    atual.setDate(atual.getDate() + 1);
  }

  return periodos;
}

function carregarMapaUsuariosPlanilha_(ss) {
  const aba = ss.getSheetByName(USUARIOS_SHEET_NAME);
  if (!aba) return {};

  const dados = aba.getDataRange().getValues();
  const mapa = {};

  for (let i = 1; i < dados.length; i++) {
    const id = String(dados[i][0] || '').trim();
    const nome = String(dados[i][1] || '').trim();
    if (id) mapa[id] = nome || `Usuário ${id}`;
  }

  return mapa;
}

function somarQtdItens_(itens) {
  if (!Array.isArray(itens)) return 0;
  return itens.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
}

function somarQtdVolumes_(volumes) {
  if (Array.isArray(volumes)) return volumes.length;
  return Number(volumes) || 0;
}

function inicializarCamposTiny_(sheet) {
  sheet.getRange('A3:G').clearContent();
  sheet.getRange('H1:Q2').clearContent();

  if (!sheet.getRange('A1').getValue()) sheet.getRange('A1').setValue('Ano');
  if (!sheet.getRange('B1').getValue()) sheet.getRange('B1').setValue('Mês');
  if (!sheet.getRange('C1').getValue()) sheet.getRange('C1').setValue('Conta Olist');
  if (!sheet.getRange('D1').getValue()) sheet.getRange('D1').setValue('Status carga');
  if (!sheet.getRange('E1').getValue()) sheet.getRange('E1').setValue('Progresso');

  if (!sheet.getRange(TINY_ANO_CELL).getValue()) sheet.getRange(TINY_ANO_CELL).setValue(new Date().getFullYear());
  if (!sheet.getRange(TINY_MES_CELL).getValue()) sheet.getRange(TINY_MES_CELL).setValue(new Date().getMonth() + 1);
  if (!sheet.getRange(TINY_CONTA_CELL).getValue()) sheet.getRange(TINY_CONTA_CELL).setValue('CONTA1');

  const regra = SpreadsheetApp.newDataValidation()
    .requireValueInList(['CONTA1', 'CONTA2', 'CONTA3', 'TODAS'], true)
    .build();

  sheet.getRange(TINY_CONTA_CELL).setDataValidation(regra);
  sheet.getRange('A1:E1').setFontWeight('bold');
  sheet.autoResizeColumns(1, 5);
}

function obterContasSelecionadas_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);

  inicializarCamposTiny_(shTiny);

  const valor = String(shTiny.getRange(TINY_CONTA_CELL).getValue() || 'CONTA1').trim().toUpperCase();

  if (valor === 'TODAS') {
    return OLIST_CONTAS.map(c => c.key);
  }

  getContaConfig_(valor);
  return [valor];
}

function garantirCabecalhoCarga_(sheet) {
  const cols = [
    'Conta Olist',
    'ID Separação',
    'Situação',
    'Data Criação',
    'Data Separação',
    'Data Checkout',
    'Cliente',
    'ID Venda',
    'Número Venda',
    'Status',
    'Erro'
  ];

  const atual = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  const vazio = atual.every(v => !v);

  if (vazio) {
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
  }
}

function limparFilaCarga_(sheet) {
  garantirCabecalhoCarga_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 11).clearContent();
  }
}

function obterPendentesCarga_(sheet, limite) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const dados = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const pendentes = [];

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const status = String(linha[9] || '').trim();

    if (status === 'PENDENTE') {
      pendentes.push({
        rowIndex: i + 2,
        contaKey: String(linha[0] || '').trim(),
        id: String(linha[1] || '').trim(),
        sep: {
          id: linha[1] || '',
          situacao: linha[2] || '',
          dataCriacao: linha[3] || '',
          dataSeparacao: linha[4] || '',
          dataCheckout: linha[5] || '',
          clienteNome: linha[6] || '',
          vendaId: linha[7] || '',
          vendaNumero: linha[8] || ''
        }
      });

      if (pendentes.length >= limite) break;
    }
  }

  return pendentes;
}

function podeContinuarExecucao_(inicioExecucaoMs) {
  const tempoUsado = Date.now() - inicioExecucaoMs;
  return tempoUsado < (CARGA_MAX_MS_POR_EXECUCAO - CARGA_MARGEM_PARADA_MS);
}

function contarStatusCarga_(sheet, statusBusca) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const statuses = sheet.getRange(2, 10, lastRow - 1, 1).getValues();
  return statuses.reduce((acc, linha) => {
    return acc + (String(linha[0] || '').trim() === statusBusca ? 1 : 0);
  }, 0);
}

function processarPendentesCarga_(ss, shRaw, shCarga, pendentes) {
  const mapaUsuariosPlanilha = carregarMapaUsuariosPlanilha_(ss);
  const idsExistentes = carregarIdsExistentesRaw_(shRaw);
  const grupos = {};

  pendentes.forEach(p => {
    if (!grupos[p.contaKey]) grupos[p.contaKey] = [];
    grupos[p.contaKey].push(p);
  });

  Object.keys(grupos).forEach(contaKey => {
    const service = getOlistService_(contaKey);
    if (!service.hasAccess()) {
      throw new Error(`Autorize primeiro a ${getContaNome_(contaKey)}.`);
    }

    const headers = { Authorization: `Bearer ${service.getAccessToken()}` };
    const grupo = grupos[contaKey];

    for (let inicio = 0; inicio < grupo.length; inicio += TAMANHO_LOTE_DETALHES) {
      const lote = grupo.slice(inicio, inicio + TAMANHO_LOTE_DETALHES);
      const detalhes = obterSeparacoesEmLote_(headers, lote.map(p => p.id));

      for (let i = 0; i < lote.length; i++) {
        const item = lote[i];
        const detalhe = detalhes[i];
        const chaveExistente = `${contaKey}||${item.id}`;

        if (idsExistentes[chaveExistente]) {
          shCarga.getRange(item.rowIndex, 10, 1, 2).setValues([['OK', 'Já existia no Tiny_raw']]);
          continue;
        }

        if (!detalhe) {
          shCarga.getRange(item.rowIndex, 10, 1, 2).setValues([['ERRO', 'Detalhe vazio retornado pela API']]);
          continue;
        }

        const sep = item.sep;
        const qtdItens = somarQtdItens_(detalhe.itens || []);
        const volumes = somarQtdVolumes_(detalhe.volumes || detalhe.volume || []);
        const idUsuario = String(detalhe.idUsuarioEmbalador || '').trim();

        const nomeUsuario =
          mapaUsuariosPlanilha[idUsuario] ||
          detalhe.nomeUsuarioEmbalador ||
          detalhe.usuarioEmbalador?.nome ||
          detalhe.usuario?.nome ||
          (idUsuario ? `Usuário ${idUsuario}` : 'Sem usuário');

        const dataCheckout =
          detalhe.dataCheckout ||
          detalhe.checkout?.data ||
          detalhe.dataExpedicao ||
          sep.dataCheckout ||
          '';

        const rawRow = [
          detalhe.id || sep.id || '',
          detalhe.dataCriacao || sep.dataCriacao || '',
          detalhe.dataSeparacao || sep.dataSeparacao || '',
          dataCheckout,
          idUsuario,
          nomeUsuario,
          detalhe.situacao || sep.situacao || '',
          detalhe.venda?.id || sep.vendaId || '',
          detalhe.venda?.numero || sep.vendaNumero || '',
          detalhe.cliente?.nome || sep.clienteNome || '',
          qtdItens,
          volumes,
          contaKey
        ];

        shRaw.getRange(shRaw.getLastRow() + 1, 1, 1, rawRow.length).setValues([rawRow]);
        shCarga.getRange(item.rowIndex, 10, 1, 2).setValues([['OK', '']]);
        idsExistentes[chaveExistente] = true;
      }

      Utilities.sleep(250);
    }
  });

  shRaw.autoResizeColumns(1, 13);
}

function agendarContinuacaoCarga_() {
  apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');

  ScriptApp.newTrigger('continuarCargaMesSegundoPlano')
    .timeBased()
    .after(CARGA_PROXIMA_EXECUCAO_MS)
    .create();
}

function apagarTriggerPorFuncao_(nomeFuncao) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === nomeFuncao) {
      ScriptApp.deleteTrigger(t);
    }
  });
}

function atualizarProgressoCarga_(sheet, nomeConta, processadas, totalSeparacoes) {
  const percentual = totalSeparacoes ? Math.round((processadas / totalSeparacoes) * 100) : 100;

  if (processadas === 1 || processadas % 10 === 0 || processadas === totalSeparacoes) {
    escreverStatusCarga_(sheet, `${nomeConta}: ${processadas}/${totalSeparacoes} separações`, `${percentual}%`);
    SpreadsheetApp.flush();
  }
}

function escreverStatusCarga_(sheet, status, progresso) {
  sheet.getRange('D1').setValue('Status carga');
  sheet.getRange('E1').setValue('Progresso');
  sheet.getRange(TINY_STATUS_CELL).setValue(status);
  sheet.getRange(TINY_PROGRESSO_CELL).setValue(progresso);
  sheet.getRange('A1:E1').setFontWeight('bold');
}

function garantirCabecalhoRaw_(sheet) {
  const cols = [
    'ID Separação',
    'Data Criação',
    'Data Separação',
    'Data Checkout',
    'ID Usuário Embalador',
    'Nome Usuário Embalador',
    'Situação',
    'ID Venda',
    'Número Venda',
    'Cliente',
    'Qtd Itens',
    'Volumes',
    'Conta Olist'
  ];

  const atual = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  const vazio = atual.every(v => !v);

  if (vazio) {
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
  } else if (!atual[12]) {
    sheet.getRange(1, 13).setValue('Conta Olist');
    sheet.getRange(1, 13).setFontWeight('bold');
  }
}

function carregarIdsExistentesRaw_(sheet) {
  const mapa = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return mapa;

  const dados = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

  dados.forEach(r => {
    const id = String(r[0] || '').trim();
    const conta = String(r[12] || 'CONTA1').trim();
    if (id) mapa[`${conta}||${id}`] = true;
  });

  return mapa;
}

function converterParaData_(valor) {
  if (!valor) return null;
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor)) return valor;

  const txt = String(valor).trim();
  if (!txt) return null;

  const d = new Date(txt);
  if (!isNaN(d)) return d;

  return null;
}

/************ PLANILHA ************/
/************ AUTOMACAO ************/
function criarTriggerDiario() {
  apagarTriggersDesteProjeto();

  ScriptApp.newTrigger('atualizarHojeEResumo')
    .timeBased()
    .everyDays(1)
    .atHour(21)
    .create();

  SpreadsheetApp.getUi().alert('Automação diária criada ✅');
}

function apagarTriggersDesteProjeto() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
}

/************ HTTP ************/
function httpGetJson_(url, headers) {
  const MAX_TENTATIVAS = 8;
  let esperaMs = 1200;

  for (let i = 1; i <= MAX_TENTATIVAS; i++) {
    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers,
      muteHttpExceptions: true
    });

    const code = resp.getResponseCode();
    const text = resp.getContentText();

    if (code >= 200 && code < 300) {
      return JSON.parse(text);
    }

    if (code === 429 || code === 400 || (code >= 500 && code <= 599)) {
      Utilities.sleep(esperaMs);
      esperaMs = Math.min(Math.floor(esperaMs * 1.6), 30000);
      continue;
    }

    throw new Error(`HTTP ${code} em ${url}\n${text}`);
  }

  throw new Error(`Falhou após várias tentativas. URL: ${url}`);
}
