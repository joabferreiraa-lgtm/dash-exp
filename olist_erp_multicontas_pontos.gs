/************ CONFIG ************/
const API_BASE = 'https://api.tiny.com.br/public-api/v3';
const AUTH_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth';
const TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

const TINY_SHEET_NAME = 'Tiny';
const TINY_RAW_SHEET_NAME = 'Tiny_raw';
const TINY_CARGA_SHEET_NAME = 'Tiny_carga';
const TINY_ITENS_SHEET_NAME = 'Tiny_itens';
const TINY_ITENS_CARGA_SHEET_NAME = 'Tiny_itens_carga';
const USUARIOS_SHEET_NAME = 'usuarios';
const SKU_SHEET_NAME = 'SKU';
const PAGE_LIMIT = 50;
const TAMANHO_LOTE_DETALHES = 10;
const TAMANHO_LOTE_ITENS = 8;
const CARGA_MAX_MS_POR_EXECUCAO = 5 * 60 * 1000;
const CARGA_MARGEM_PARADA_MS = 35 * 1000;
const CARGA_PROXIMA_EXECUCAO_MS = 10 * 1000;
const BUSCA_CHECKOUT_DIAS_RETROATIVOS = 4;
const BUSCA_CHECKOUT_DIAS_RETROATIVOS_MANUAL_HOJE = 2;
const TINY_DATA_INICIAL_CELL = 'A2';
const TINY_DATA_FINAL_CELL = 'B2';
const TINY_CONTA_CELL = 'C2';
const TINY_STATUS_CELL = 'D2';
const TINY_PROGRESSO_CELL = 'E2';
const AUTO_ITENS_APOS_CARGA_HOJE_PROP = 'AUTO_ITENS_APOS_CARGA_HOJE';

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

  ui.createMenu('Olist ERP')
    .addItem('Autorizar CONTA1', 'autorizarConta1')
    .addItem('Autorizar CONTA2', 'autorizarConta2')
    .addItem('Autorizar CONTA3', 'autorizarConta3')
    .addItem('Ver redirect URI', 'verRedirectUri')
    .addSeparator()
    .addItem('Iniciar carga do periodo selecionado', 'cargaMesSelecionadoTinyRaw')
    .addItem('Continuar carga pendente', 'continuarCargaMesSegundoPlano')
    .addItem('Cancelar carga pendente', 'cancelarCargaMesSegundoPlano')
    .addItem('Puxar hoje manual - todas as contas', 'puxarHojeManualTodasContas')
    .addItem('Buscar itens do periodo', 'iniciarCargaItensPeriodo')
    .addItem('Continuar busca de itens', 'continuarCargaItensSegundoPlano')
    .addItem('Cancelar busca de itens', 'cancelarCargaItensSegundoPlano')
    .addItem('Recalcular pontos pelo Tiny_itens', 'recalcularPontosTinyRawPorItens')
    .addSeparator()
    .addItem('Criar automacao 8h, 10h, 12h, 14h, 16h, 18h e 20h', 'criarTriggersDiariosOlist')
    .addItem('Apagar automacao diaria', 'apagarTriggersDiariosOlist')
    .addSeparator()
    .addItem('Resetar autorizacoes', 'resetarOlist')
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
  if (!conta) throw new Error(`Conta invalida: ${contaKey}`);
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
    SpreadsheetApp.getUi().alert(`${nomeConta} ja esta autorizada.`);
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
    return HtmlService.createHtmlOutput(`${getContaNome_(contaKey)} autorizada. Pode voltar para a planilha.`);
  }

  return HtmlService.createHtmlOutput(`${getContaNome_(contaKey)} nao autorizada. Feche e tente novamente.`);
}

function resetarOlist() {
  OLIST_CONTAS.forEach(conta => getOlistService_(conta.key).reset());
  SpreadsheetApp.getUi().alert('Autorizacoes resetadas.');
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

  const dataInicial = converterParaData_(shTiny.getRange(TINY_DATA_INICIAL_CELL).getValue());
  const dataFinal = converterParaData_(shTiny.getRange(TINY_DATA_FINAL_CELL).getValue());

  if (!dataInicial || !dataFinal) {
    throw new Error('Preencha A2 = data inicial e B2 = data final na aba Tiny. Exemplo: 25/05/2026.');
  }

  dataInicial.setHours(0, 0, 0, 0);
  dataFinal.setHours(0, 0, 0, 0);

  if (dataFinal < dataInicial) {
    throw new Error('A data final nao pode ser menor que a data inicial.');
  }

  apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');
  limparFilaCarga_(shCarga);

  const tz = Session.getScriptTimeZone();
  const dataBuscaInicial = criarDataBuscaCheckout_(dataInicial);
  const dataInicialStr = Utilities.formatDate(dataInicial, tz, 'yyyy-MM-dd');
  const dataFinalStr = Utilities.formatDate(dataFinal, tz, 'yyyy-MM-dd');
  const dataBuscaInicialStr = Utilities.formatDate(dataBuscaInicial, tz, 'yyyy-MM-dd');
  const idsExistentes = carregarIdsExistentesRaw_(shRaw);
  const linhasFila = [];

  for (const contaKey of obterContasSelecionadas_()) {
    const service = getOlistService_(contaKey);
    if (!service.hasAccess()) {
      throw new Error(`Autorize primeiro a ${getContaNome_(contaKey)}.`);
    }

    escreverStatusCarga_(shTiny, `${getContaNome_(contaKey)}: montando fila do periodo...`, '0%');
    SpreadsheetApp.flush();

    const headers = { Authorization: `Bearer ${service.getAccessToken()}` };
    const separacoes = listarSeparacoesEmbaladas_(headers, dataBuscaInicialStr, dataFinalStr);

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
          '',
          dataInicialStr,
          dataFinalStr
        ]);
      }
    });
  }

  if (linhasFila.length) {
    shCarga.getRange(2, 1, linhasFila.length, linhasFila[0].length).setValues(linhasFila);
  }

  escreverStatusCarga_(shTiny, `Fila criada: ${linhasFila.length} separacoes pendentes`, linhasFila.length ? '0%' : '100%');
  SpreadsheetApp.flush();

  if (!linhasFila.length) {
    ss.toast('Nada novo para puxar neste periodo.', 'Olist ERP', 5);
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
  const ignoradasAntes = contarStatusCarga_(shCarga, 'IGNORADO');
  let pendentes = obterPendentesCarga_(shCarga, TAMANHO_LOTE_DETALHES);

  if (!pendentes.length) {
    apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');
    escreverStatusCarga_(shTiny, `Carga completa: ${concluidasAntes} OK, ${errosAntes} erros, ${ignoradasAntes} fora do periodo`, '100%');
    SpreadsheetApp.flush();
    ss.toast('Carga do periodo concluida.', 'Olist ERP', 5);
    iniciarBuscaItensHojeSeSolicitada_();
    return;
  }

  while (pendentes.length && podeContinuarExecucao_(inicioExecucaoMs)) {
    processarPendentesCarga_(ss, shRaw, shCarga, pendentes);

    const concluidasLoop = contarStatusCarga_(shCarga, 'OK');
    const errosLoop = contarStatusCarga_(shCarga, 'ERRO');
    const ignoradasLoop = contarStatusCarga_(shCarga, 'IGNORADO');
    const finalizadasLoop = concluidasLoop + errosLoop + ignoradasLoop;
    const percentualLoop = total ? Math.round((finalizadasLoop / total) * 100) : 100;

    escreverStatusCarga_(shTiny, `Processado: ${finalizadasLoop}/${total} separacoes (${errosLoop} erros)`, `${percentualLoop}%`);
    SpreadsheetApp.flush();

    pendentes = obterPendentesCarga_(shCarga, TAMANHO_LOTE_DETALHES);
  }

  const concluidas = contarStatusCarga_(shCarga, 'OK');
  const erros = contarStatusCarga_(shCarga, 'ERRO');
  const ignoradas = contarStatusCarga_(shCarga, 'IGNORADO');
  const finalizadas = concluidas + erros + ignoradas;
  const percentual = total ? Math.round((finalizadas / total) * 100) : 100;

  escreverStatusCarga_(shTiny, `Processado: ${finalizadas}/${total} separacoes (${erros} erros)`, `${percentual}%`);
  SpreadsheetApp.flush();

  if (finalizadas < total) {
    agendarContinuacaoCarga_();
  } else {
    apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');
    ss.toast('Carga do periodo concluida.', 'Olist ERP', 5);
    iniciarBuscaItensHojeSeSolicitada_();
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
  atualizarHojeTodasContas_();
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
  const dataBuscaInicial = criarDataBuscaCheckout_(dataInicial);
  const dataInicialStr = Utilities.formatDate(dataInicial, tz, 'yyyy-MM-dd');
  const dataFinalStr = Utilities.formatDate(dataFinal, tz, 'yyyy-MM-dd');
  const dataBuscaInicialStr = Utilities.formatDate(dataBuscaInicial, tz, 'yyyy-MM-dd');

  const mapaUsuariosPlanilha = carregarMapaUsuariosPlanilha_(ss);
  const mapaPontosSku = carregarMapaPontosSku_(ss);
  const idsExistentes = carregarIdsExistentesRaw_(shRaw);

  const separacoes = listarSeparacoesEmbaladas_(headers, dataBuscaInicialStr, dataFinalStr);

  const novasLinhas = [];
  let processadas = 0;
  const nomeConta = getContaNome_(contaKey);
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const totalSeparacoes = separacoes.length;

  escreverStatusCarga_(shTiny, `${nomeConta}: iniciando...`, totalSeparacoes ? '0%' : 'Sem separacoes');
  SpreadsheetApp.flush();

  const separacoesNovas = separacoes.filter(sep => !idsExistentes[`${contaKey}||${sep.id}`]);
  processadas = totalSeparacoes - separacoesNovas.length;

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

      const itens = detalhe.itens || [];
      const qtdItens = somarQtdItens_(itens);
      const pontosEmbalagem = somarPontosItens_(itens, mapaPontosSku, ss);
      const volumes = somarQtdVolumes_(detalhe.volumes || detalhe.volume || []);
      const idUsuario = String(detalhe.idUsuarioEmbalador || '').trim();

      const nomeUsuario =
        mapaUsuariosPlanilha[idUsuario] ||
        detalhe.nomeUsuarioEmbalador ||
        detalhe.usuarioEmbalador?.nome ||
        detalhe.usuario?.nome ||
        (idUsuario ? `Usuario ${idUsuario}` : 'Sem usuario');

      const dataCheckout =
        detalhe.dataCheckout ||
        detalhe.checkout?.data ||
        detalhe.dataExpedicao ||
        '';

      if (!dataEstaDentroDoPeriodo_(dataCheckout, dataInicial, dataFinal)) {
        processadas++;
        atualizarProgressoCarga_(shTiny, nomeConta, processadas, totalSeparacoes);
        continue;
      }

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
        contaKey,
        pontosEmbalagem
      ]);

      idsExistentes[chaveExistente] = true;
      processadas++;
      atualizarProgressoCarga_(shTiny, nomeConta, processadas, totalSeparacoes);
    }

    if (processadas % 20 === 0 || inicio + lote.length >= separacoesNovas.length) {
      ss.toast(`${nomeConta}: processadas ${processadas}/${totalSeparacoes} separacoes...`, 'Olist ERP', 3);
    }

    Utilities.sleep(250);
  }

  if (novasLinhas.length) {
    shRaw.getRange(shRaw.getLastRow() + 1, 1, novasLinhas.length, novasLinhas[0].length).setValues(novasLinhas);
  }

  shRaw.autoResizeColumns(1, 14);
  escreverStatusCarga_(shTiny, `${nomeConta}: concluido - ${novasLinhas.length} novas separacoes`, '100%');
  SpreadsheetApp.flush();
  ss.toast(`${nomeConta}: carga concluida - ${novasLinhas.length} novas separacoes`, 'Olist ERP', 5);
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

    throw new Error(`HTTP ${code} ao buscar separacao ${idsSeparacao[idx]}\n${text}`);
  });
}

/************ APOIO ************/
function criarDataBuscaCheckout_(dataInicial) {
  return criarDataBuscaCheckoutComDias_(dataInicial, BUSCA_CHECKOUT_DIAS_RETROATIVOS);
}

function criarDataBuscaCheckoutComDias_(dataInicial, diasRetroativos) {
  const data = new Date(dataInicial);
  data.setDate(data.getDate() - diasRetroativos);
  data.setHours(0, 0, 0, 0);
  return data;
}

function dataEstaDentroDoPeriodo_(valorData, dataInicial, dataFinal) {
  const data = converterParaData_(valorData);
  if (!data) return false;

  const inicio = new Date(dataInicial);
  inicio.setHours(0, 0, 0, 0);

  const fim = new Date(dataFinal);
  fim.setHours(23, 59, 59, 999);

  return data >= inicio && data <= fim;
}

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
    if (id) mapa[id] = nome || `Usuario ${id}`;
  }

  return mapa;
}

function carregarMapaPontosSku_(ss) {
  const aba = ss.getSheetByName(SKU_SHEET_NAME) || ss.insertSheet(SKU_SHEET_NAME);
  const lastRow = aba.getLastRow();
  const mapa = {};

  if (lastRow < 1) {
    aba.getRange(1, 1, 1, 2).setValues([['SKU', 'Ponto']]);
    aba.getRange(1, 1, 1, 2).setFontWeight('bold');
    return mapa;
  }

  const cabecalho = aba.getRange(1, 1, 1, 2).getValues()[0];
  if (!cabecalho[0]) aba.getRange(1, 1).setValue('SKU');
  if (!cabecalho[1]) aba.getRange(1, 2).setValue('Ponto');
  aba.getRange(1, 1, 1, 2).setFontWeight('bold');

  if (lastRow < 2) return mapa;

  aba.getRange(2, 1, lastRow - 1, 2).getValues().forEach(linha => {
    const sku = normalizarSku_(linha[0]);
    if (!sku) return;
    mapa[sku] = converterNumero_(linha[1]) || 1;
  });

  return mapa;
}

function somarQtdItens_(itens) {
  if (!Array.isArray(itens)) return 0;
  return itens.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
}

function somarPontosItens_(itens, mapaPontosSku, ss) {
  if (!Array.isArray(itens)) return 0;

  return itens.reduce((acc, item) => {
    const skuOriginal = item?.produto?.sku || item?.sku || item?.codigo || '';
    const quantidade = Number(item.quantidade) || 0;
    const ponto = obterPontoSku_(skuOriginal, mapaPontosSku, ss);
    return acc + (quantidade * ponto);
  }, 0);
}

function obterPontoSku_(skuOriginal, mapaPontosSku, ss) {
  const sku = normalizarSku_(skuOriginal);
  if (!sku) return 1;
  if (mapaPontosSku[sku]) return mapaPontosSku[sku];

  const aba = ss.getSheetByName(SKU_SHEET_NAME) || ss.insertSheet(SKU_SHEET_NAME);
  if (aba.getLastRow() < 1) {
    aba.getRange(1, 1, 1, 2).setValues([['SKU', 'Ponto']]);
    aba.getRange(1, 1, 1, 2).setFontWeight('bold');
  }

  aba.appendRow([String(skuOriginal || '').trim(), 1]);
  mapaPontosSku[sku] = 1;
  return 1;
}

function normalizarSku_(valor) {
  return String(valor || '').trim().toLowerCase();
}

function converterNumero_(valor) {
  if (typeof valor === 'number') return valor;
  const txt = String(valor || '').trim();
  if (!txt) return 0;
  return Number(txt.replace(/\./g, '').replace(',', '.')) || 0;
}

function somarQtdVolumes_(volumes) {
  if (Array.isArray(volumes)) return volumes.length;
  return Number(volumes) || 0;
}

function inicializarCamposTiny_(sheet) {
  sheet.getRange('A3:G').clearContent();
  sheet.getRange('H1:Q2').clearContent();

  sheet.getRange('A1').setValue('Data inicial');
  sheet.getRange('B1').setValue('Data final');
  sheet.getRange('C1').setValue('Conta Olist');
  sheet.getRange('D1').setValue('Status carga');
  sheet.getRange('E1').setValue('Progresso');

  const valorDataInicial = sheet.getRange(TINY_DATA_INICIAL_CELL).getValue();
  const valorDataFinal = sheet.getRange(TINY_DATA_FINAL_CELL).getValue();

  if (!converterParaData_(valorDataInicial) || typeof valorDataInicial === 'number') sheet.getRange(TINY_DATA_INICIAL_CELL).setValue(new Date());
  if (!converterParaData_(valorDataFinal) || typeof valorDataFinal === 'number') sheet.getRange(TINY_DATA_FINAL_CELL).setValue(new Date());
  if (!sheet.getRange(TINY_CONTA_CELL).getValue()) sheet.getRange(TINY_CONTA_CELL).setValue('CONTA1');

  const regra = SpreadsheetApp.newDataValidation()
    .requireValueInList(['CONTA1', 'CONTA2', 'CONTA3', 'TODAS'], true)
    .build();

  sheet.getRange(TINY_CONTA_CELL).setDataValidation(regra);
  sheet.getRange('A1:E1').setFontWeight('bold');
  sheet.getRange('A2:B2').setNumberFormat('dd/mm/yyyy');
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
    'ID Separacao',
    'Situacao',
    'Data Criacao',
    'Data Separacao',
    'Data Checkout',
    'Cliente',
    'ID Venda',
    'Numero Venda',
    'Status',
    'Erro',
    'Checkout inicial',
    'Checkout final'
  ];

  const atual = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  const vazio = atual.every(v => !v);

  if (vazio) {
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
  } else if (!atual[11] || !atual[12]) {
    sheet.getRange(1, 12, 1, 2).setValues([['Checkout inicial', 'Checkout final']]);
    sheet.getRange(1, 12, 1, 2).setFontWeight('bold');
  }
}

function limparFilaCarga_(sheet) {
  garantirCabecalhoCarga_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 13).clearContent();
  }
}

function obterPendentesCarga_(sheet, limite) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const dados = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
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
        },
        checkoutInicial: linha[11] || '',
        checkoutFinal: linha[12] || ''
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

function contarStatusItensCarga_(sheet, statusBusca) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const statuses = sheet.getRange(2, 9, lastRow - 1, 1).getValues();
  return statuses.reduce((acc, linha) => {
    return acc + (String(linha[0] || '').trim() === statusBusca ? 1 : 0);
  }, 0);
}

function processarPendentesCarga_(ss, shRaw, shCarga, pendentes) {
  const mapaUsuariosPlanilha = carregarMapaUsuariosPlanilha_(ss);
  const mapaPontosSku = carregarMapaPontosSku_(ss);
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
      const linhasRawLote = [];
      const statusCargaLote = [];

      for (let i = 0; i < lote.length; i++) {
        const item = lote[i];
        const detalhe = detalhes[i];
        const chaveExistente = `${contaKey}||${item.id}`;

        if (idsExistentes[chaveExistente]) {
          statusCargaLote.push({ rowIndex: item.rowIndex, values: ['OK', 'Ja existia no Tiny_raw'] });
          continue;
        }

        if (!detalhe) {
          statusCargaLote.push({ rowIndex: item.rowIndex, values: ['ERRO', 'Detalhe vazio retornado pela API'] });
          continue;
        }

        const sep = item.sep;
        const itens = detalhe.itens || [];
        const qtdItens = somarQtdItens_(itens);
        const pontosEmbalagem = somarPontosItens_(itens, mapaPontosSku, ss);
        const volumes = somarQtdVolumes_(detalhe.volumes || detalhe.volume || []);
        const idUsuario = String(detalhe.idUsuarioEmbalador || '').trim();

        const nomeUsuario =
          mapaUsuariosPlanilha[idUsuario] ||
          detalhe.nomeUsuarioEmbalador ||
          detalhe.usuarioEmbalador?.nome ||
          detalhe.usuario?.nome ||
          (idUsuario ? `Usuario ${idUsuario}` : 'Sem usuario');

        const dataCheckout =
          detalhe.dataCheckout ||
          detalhe.checkout?.data ||
          detalhe.dataExpedicao ||
          sep.dataCheckout ||
          '';

        const checkoutInicial = converterParaData_(item.checkoutInicial);
        const checkoutFinal = converterParaData_(item.checkoutFinal);

        if (checkoutInicial && checkoutFinal && !dataEstaDentroDoPeriodo_(dataCheckout, checkoutInicial, checkoutFinal)) {
          statusCargaLote.push({ rowIndex: item.rowIndex, values: ['IGNORADO', 'Checkout fora do periodo selecionado'] });
          continue;
        }

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
          contaKey,
          pontosEmbalagem
        ];

        linhasRawLote.push(rawRow);
        statusCargaLote.push({ rowIndex: item.rowIndex, values: ['OK', ''] });
        idsExistentes[chaveExistente] = true;
      }

      if (linhasRawLote.length) {
        shRaw.getRange(shRaw.getLastRow() + 1, 1, linhasRawLote.length, linhasRawLote[0].length).setValues(linhasRawLote);
      }
      aplicarStatusCargaEmLote_(shCarga, statusCargaLote);
      Utilities.sleep(250);
    }
  });
}

function aplicarStatusCargaEmLote_(sheet, atualizacoes) {
  if (!atualizacoes.length) return;

  const ordenadas = atualizacoes.slice().sort((a, b) => a.rowIndex - b.rowIndex);
  let inicio = ordenadas[0].rowIndex;
  let valores = [ordenadas[0].values];
  let anterior = inicio;

  for (let i = 1; i < ordenadas.length; i++) {
    const atual = ordenadas[i];
    if (atual.rowIndex === anterior + 1) {
      valores.push(atual.values);
      anterior = atual.rowIndex;
      continue;
    }

    sheet.getRange(inicio, 10, valores.length, 2).setValues(valores);
    inicio = atual.rowIndex;
    valores = [atual.values];
    anterior = atual.rowIndex;
  }

  sheet.getRange(inicio, 10, valores.length, 2).setValues(valores);
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
    escreverStatusCarga_(sheet, `${nomeConta}: ${processadas}/${totalSeparacoes} separacoes`, `${percentual}%`);
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
    'ID Separacao',
    'Data Criacao',
    'Data Separacao',
    'Data Checkout',
    'ID Usuario Embalador',
    'Nome Usuario Embalador',
    'Situacao',
    'ID Venda',
    'Numero Venda',
    'Cliente',
    'Qtd Itens',
    'Volumes',
    'Conta Olist',
    'Pontos Embalagem'
  ];

  const atual = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  const vazio = atual.every(v => !v);

  if (vazio) {
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
  } else {
    if (!atual[12]) sheet.getRange(1, 13).setValue('Conta Olist');
    if (!atual[13]) sheet.getRange(1, 14).setValue('Pontos Embalagem');
    sheet.getRange(1, 13, 1, 2).setFontWeight('bold');
  }
}

function carregarIdsExistentesRaw_(sheet) {
  const mapa = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return mapa;

  const dados = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  dados.forEach(r => {
    const id = String(r[0] || '').trim();
    const conta = String(r[12] || 'CONTA1').trim();
    if (id) mapa[`${conta}||${id}`] = true;
  });

  return mapa;
}

/************ ITENS POR SEPARACAO ************/
function iniciarCargaItensPeriodo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);

  inicializarCamposTiny_(shTiny);

  const dataInicial = converterParaData_(shTiny.getRange(TINY_DATA_INICIAL_CELL).getValue());
  const dataFinal = converterParaData_(shTiny.getRange(TINY_DATA_FINAL_CELL).getValue());

  if (!dataInicial || !dataFinal) {
    throw new Error('Preencha A2 = data inicial e B2 = data final na aba Tiny.');
  }

  iniciarCargaItensPeriodoComDatas_(dataInicial, dataFinal);
}

function iniciarCargaItensPeriodoComDatas_(dataInicial, dataFinal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const shRaw = ss.getSheetByName(TINY_RAW_SHEET_NAME);
  const shItens = ss.getSheetByName(TINY_ITENS_SHEET_NAME) || ss.insertSheet(TINY_ITENS_SHEET_NAME);
  const shItensCarga = ss.getSheetByName(TINY_ITENS_CARGA_SHEET_NAME) || ss.insertSheet(TINY_ITENS_CARGA_SHEET_NAME);

  if (!shRaw) throw new Error('A aba Tiny_raw nao foi encontrada.');

  inicializarCamposTiny_(shTiny);
  garantirCabecalhoRaw_(shRaw);
  garantirCabecalhoItens_(shItens);
  garantirCabecalhoItensCarga_(shItensCarga);

  dataInicial.setHours(0, 0, 0, 0);
  dataFinal.setHours(23, 59, 59, 999);

  apagarTriggerPorFuncao_('continuarCargaItensSegundoPlano');
  limparFilaItensCarga_(shItensCarga);

  const idsJaCarregados = carregarIdsItensExistentes_(shItens);
  const totalRaw = Math.max(shRaw.getLastRow() - 1, 0);
  const dadosRaw = totalRaw ? shRaw.getRange(2, 1, totalRaw, 14).getValues() : [];
  const linhasFila = [];

  dadosRaw.forEach(linha => {
    const idSeparacao = String(linha[0] || '').trim();
    const dataCheckout = converterParaData_(linha[3]);
    const contaKey = String(linha[12] || 'CONTA1').trim();

    if (!idSeparacao || !dataCheckout) return;
    if (dataCheckout < dataInicial || dataCheckout > dataFinal) return;
    if (idsJaCarregados[`${contaKey}||${idSeparacao}`]) return;

    linhasFila.push([
      contaKey,
      idSeparacao,
      dataCheckout,
      linha[4] || '',
      linha[5] || '',
      linha[7] || '',
      linha[8] || '',
      linha[9] || '',
      'PENDENTE',
      ''
    ]);
  });

  if (linhasFila.length) {
    shItensCarga.getRange(2, 1, linhasFila.length, linhasFila[0].length).setValues(linhasFila);
  }

  escreverStatusCarga_(shTiny, `Fila de itens criada: ${linhasFila.length} separacoes`, linhasFila.length ? '0%' : '100%');
  SpreadsheetApp.flush();

  if (!linhasFila.length) {
    ss.toast('Nada novo para buscar em Tiny_itens neste periodo.', 'Olist ERP', 5);
    return;
  }

  continuarCargaItensSegundoPlano();
}

function continuarCargaItensSegundoPlano() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const shItens = ss.getSheetByName(TINY_ITENS_SHEET_NAME) || ss.insertSheet(TINY_ITENS_SHEET_NAME);
  const shItensCarga = ss.getSheetByName(TINY_ITENS_CARGA_SHEET_NAME) || ss.insertSheet(TINY_ITENS_CARGA_SHEET_NAME);

  garantirCabecalhoItens_(shItens);
  garantirCabecalhoItensCarga_(shItensCarga);

  const inicioExecucaoMs = Date.now();
  const total = Math.max(shItensCarga.getLastRow() - 1, 0);
  let pendentes = obterPendentesItensCarga_(shItensCarga, TAMANHO_LOTE_ITENS);

  if (!pendentes.length) {
    apagarTriggerPorFuncao_('continuarCargaItensSegundoPlano');
    recalcularPontosTinyRawPorItens();
    escreverStatusCarga_(shTiny, 'Busca de itens concluida e pontos recalculados', '100%');
    SpreadsheetApp.flush();
    ss.toast('Busca de itens concluida.', 'Olist ERP', 5);
    return;
  }

  while (pendentes.length && podeContinuarExecucao_(inicioExecucaoMs)) {
    processarPendentesItensCarga_(ss, shItens, shItensCarga, pendentes);

    const concluidas = contarStatusItensCarga_(shItensCarga, 'OK');
    const erros = contarStatusItensCarga_(shItensCarga, 'ERRO');
    const finalizadas = concluidas + erros;
    const percentual = total ? Math.round((finalizadas / total) * 100) : 100;

    escreverStatusCarga_(shTiny, `Itens: ${finalizadas}/${total} separacoes (${erros} erros)`, `${percentual}%`);
    SpreadsheetApp.flush();

    pendentes = obterPendentesItensCarga_(shItensCarga, TAMANHO_LOTE_ITENS);
  }

  const concluidas = contarStatusItensCarga_(shItensCarga, 'OK');
  const erros = contarStatusItensCarga_(shItensCarga, 'ERRO');
  const finalizadas = concluidas + erros;

  if (finalizadas < total) {
    agendarContinuacaoItensCarga_();
  } else {
    apagarTriggerPorFuncao_('continuarCargaItensSegundoPlano');
    recalcularPontosTinyRawPorItens();
    escreverStatusCarga_(shTiny, 'Busca de itens concluida e pontos recalculados', '100%');
    SpreadsheetApp.flush();
  }
}

function cancelarCargaItensSegundoPlano() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const shItensCarga = ss.getSheetByName(TINY_ITENS_CARGA_SHEET_NAME) || ss.insertSheet(TINY_ITENS_CARGA_SHEET_NAME);

  apagarTriggerPorFuncao_('continuarCargaItensSegundoPlano');
  limparFilaItensCarga_(shItensCarga);
  escreverStatusCarga_(shTiny, 'Busca de itens cancelada', '');
  SpreadsheetApp.flush();
}

function processarPendentesItensCarga_(ss, shItens, shItensCarga, pendentes) {
  const mapaPontosSku = carregarMapaPontosSku_(ss);
  const grupos = {};

  pendentes.forEach(item => {
    if (!grupos[item.contaKey]) grupos[item.contaKey] = [];
    grupos[item.contaKey].push(item);
  });

  Object.keys(grupos).forEach(contaKey => {
    const service = getOlistService_(contaKey);
    if (!service.hasAccess()) {
      throw new Error(`Autorize primeiro a ${getContaNome_(contaKey)}.`);
    }

    const headers = { Authorization: `Bearer ${service.getAccessToken()}` };

    for (const item of grupos[contaKey]) {
      try {
        const detalhe = obterSeparacao_(headers, item.idSeparacao);
        const linhasItens = linhasItensSeparacao_(detalhe, item, mapaPontosSku, ss);

        if (linhasItens.length) {
          shItens.getRange(shItens.getLastRow() + 1, 1, linhasItens.length, linhasItens[0].length).setValues(linhasItens);
        }

        shItensCarga.getRange(item.rowIndex, 9, 1, 2).setValues([['OK', '']]);
      } catch (error) {
        shItensCarga.getRange(item.rowIndex, 9, 1, 2).setValues([['ERRO', String(error.message || error).slice(0, 200)]]);
      }

      Utilities.sleep(250);
    }
  });
}

function linhasItensSeparacao_(detalhe, itemFila, mapaPontosSku, ss) {
  const itens = detalhe?.itens || [];
  return itens.map(item => {
    const skuOriginal = item?.produto?.sku || item?.sku || item?.codigo || '';
    const descricao = item?.produto?.descricao || item?.descricao || '';
    const quantidade = Number(item.quantidade) || 0;
    const ponto = obterPontoSku_(skuOriginal, mapaPontosSku, ss);

    return [
      itemFila.idSeparacao,
      itemFila.dataCheckout,
      itemFila.contaKey,
      itemFila.idUsuario,
      itemFila.nomeUsuario,
      itemFila.idVenda,
      itemFila.numeroVenda,
      itemFila.cliente,
      skuOriginal,
      descricao,
      quantidade,
      ponto,
      quantidade * ponto
    ];
  });
}

function recalcularPontosTinyRawPorItens() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shRaw = ss.getSheetByName(TINY_RAW_SHEET_NAME);
  const shItens = ss.getSheetByName(TINY_ITENS_SHEET_NAME);

  if (!shRaw) throw new Error('A aba Tiny_raw nao foi encontrada.');
  if (!shItens) throw new Error('A aba Tiny_itens nao foi encontrada.');

  garantirCabecalhoRaw_(shRaw);
  garantirCabecalhoItens_(shItens);

  const mapaPontosSku = carregarMapaPontosSku_(ss);
  const lastItensRow = shItens.getLastRow();
  const pontosPorSeparacao = {};

  if (lastItensRow >= 2) {
    const itens = shItens.getRange(2, 1, lastItensRow - 1, 13).getValues();
    itens.forEach((linha, index) => {
      const contaKey = String(linha[2] || 'CONTA1').trim();
      const idSeparacao = String(linha[0] || '').trim();
      const sku = linha[8];
      const quantidade = Number(linha[10]) || 0;
      const ponto = obterPontoSku_(sku, mapaPontosSku, ss);
      const total = quantidade * ponto;

      if (!idSeparacao) return;
      pontosPorSeparacao[`${contaKey}||${idSeparacao}`] = (pontosPorSeparacao[`${contaKey}||${idSeparacao}`] || 0) + total;
      shItens.getRange(index + 2, 12, 1, 2).setValues([[ponto, total]]);
    });
  }

  const lastRawRow = shRaw.getLastRow();
  if (lastRawRow < 2) return;

  const raw = shRaw.getRange(2, 1, lastRawRow - 1, 14).getValues();
  let atualizadas = 0;

  raw.forEach((linha, index) => {
    const idSeparacao = String(linha[0] || '').trim();
    const contaKey = String(linha[12] || 'CONTA1').trim();
    const pontos = pontosPorSeparacao[`${contaKey}||${idSeparacao}`];

    if (pontos === undefined) return;
    shRaw.getRange(index + 2, 14).setValue(pontos);
    atualizadas++;
  });

  SpreadsheetApp.getActive().toast(`Pontos recalculados em ${atualizadas} separacoes.`, 'Olist ERP', 5);
}

function garantirCabecalhoItens_(sheet) {
  const cols = [
    'ID Separacao',
    'Data Checkout',
    'Conta Olist',
    'ID Usuario Embalador',
    'Nome Usuario Embalador',
    'ID Venda',
    'Numero Venda',
    'Cliente',
    'SKU',
    'Descricao',
    'Quantidade',
    'Ponto',
    'Total Pontos'
  ];

  const atual = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  const vazio = atual.every(v => !v);

  if (vazio) {
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
  }

  sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
}

function garantirCabecalhoItensCarga_(sheet) {
  const cols = [
    'Conta Olist',
    'ID Separacao',
    'Data Checkout',
    'ID Usuario Embalador',
    'Nome Usuario Embalador',
    'ID Venda',
    'Numero Venda',
    'Cliente',
    'Status',
    'Erro'
  ];

  const atual = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  const vazio = atual.every(v => !v);

  if (vazio) {
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
  }

  sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
}

function limparFilaItensCarga_(sheet) {
  garantirCabecalhoItensCarga_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 10).clearContent();
  }
}

function obterPendentesItensCarga_(sheet, limite) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const dados = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const pendentes = [];

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const status = String(linha[8] || '').trim();

    if (status === 'PENDENTE') {
      pendentes.push({
        rowIndex: i + 2,
        contaKey: String(linha[0] || '').trim(),
        idSeparacao: String(linha[1] || '').trim(),
        dataCheckout: linha[2] || '',
        idUsuario: linha[3] || '',
        nomeUsuario: linha[4] || '',
        idVenda: linha[5] || '',
        numeroVenda: linha[6] || '',
        cliente: linha[7] || ''
      });

      if (pendentes.length >= limite) break;
    }
  }

  return pendentes;
}

function carregarIdsItensExistentes_(sheet) {
  const mapa = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return mapa;

  const dados = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  dados.forEach(linha => {
    const idSeparacao = String(linha[0] || '').trim();
    const contaKey = String(linha[2] || 'CONTA1').trim();
    if (idSeparacao) mapa[`${contaKey}||${idSeparacao}`] = true;
  });

  return mapa;
}

function agendarContinuacaoItensCarga_() {
  apagarTriggerPorFuncao_('continuarCargaItensSegundoPlano');

  ScriptApp.newTrigger('continuarCargaItensSegundoPlano')
    .timeBased()
    .after(CARGA_PROXIMA_EXECUCAO_MS)
    .create();
}

function converterParaData_(valor) {
  if (!valor) return null;
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor)) return new Date(valor);

  const txt = String(valor).trim();
  if (!txt) return null;

  const br = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  }

  const iso = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const d = new Date(txt);
  if (!isNaN(d)) return d;

  return null;
}

/************ AUTOMACAO ************/
function puxarHojeManualTodasContas() {
  iniciarCargaHojeTodasContasEmFila_();
}

function atualizarHojeTodasContasAutomatico() {
  atualizarHojeTodasContas_();
}

function atualizarHojeTodasContas_() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  OLIST_CONTAS.forEach(conta => {
    carregarPeriodoNoRaw_(inicio, fim, conta.key);
  });
}

function marcarBuscaItensHojeAposCarga_() {
  PropertiesService.getScriptProperties().setProperty(AUTO_ITENS_APOS_CARGA_HOJE_PROP, '1');
}

function iniciarBuscaItensHojeSeSolicitada_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(AUTO_ITENS_APOS_CARGA_HOJE_PROP) !== '1') return false;

  props.deleteProperty(AUTO_ITENS_APOS_CARGA_HOJE_PROP);

  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  iniciarCargaItensPeriodoComDatas_(inicio, fim);
  return true;
}

function iniciarCargaHojeTodasContasEmFila_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shTiny = ss.getSheetByName(TINY_SHEET_NAME) || ss.insertSheet(TINY_SHEET_NAME);
  const shRaw = ss.getSheetByName(TINY_RAW_SHEET_NAME) || ss.insertSheet(TINY_RAW_SHEET_NAME);
  const shCarga = ss.getSheetByName(TINY_CARGA_SHEET_NAME) || ss.insertSheet(TINY_CARGA_SHEET_NAME);

  inicializarCamposTiny_(shTiny);
  garantirCabecalhoRaw_(shRaw);
  garantirCabecalhoCarga_(shCarga);

  const hoje = new Date();
  const dataInicial = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dataFinal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  apagarTriggerPorFuncao_('continuarCargaMesSegundoPlano');
  limparFilaCarga_(shCarga);

  const tz = Session.getScriptTimeZone();
  const dataBuscaInicial = criarDataBuscaCheckoutComDias_(dataInicial, BUSCA_CHECKOUT_DIAS_RETROATIVOS_MANUAL_HOJE);
  const dataInicialStr = Utilities.formatDate(dataInicial, tz, 'yyyy-MM-dd');
  const dataFinalStr = Utilities.formatDate(dataFinal, tz, 'yyyy-MM-dd');
  const dataBuscaInicialStr = Utilities.formatDate(dataBuscaInicial, tz, 'yyyy-MM-dd');
  const idsExistentes = carregarIdsExistentesRaw_(shRaw);
  const linhasFila = [];

  OLIST_CONTAS.forEach(conta => {
    const contaKey = conta.key;
    const service = getOlistService_(contaKey);
    if (!service.hasAccess()) {
      throw new Error(`Autorize primeiro a ${getContaNome_(contaKey)}.`);
    }

    escreverStatusCarga_(shTiny, `${getContaNome_(contaKey)}: montando fila de hoje...`, '0%');
    SpreadsheetApp.flush();

    const headers = { Authorization: `Bearer ${service.getAccessToken()}` };
    const separacoes = listarSeparacoesEmbaladas_(headers, dataBuscaInicialStr, dataFinalStr);

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
          '',
          dataInicialStr,
          dataFinalStr
        ]);
      }
    });
  });

  if (linhasFila.length) {
    shCarga.getRange(2, 1, linhasFila.length, linhasFila[0].length).setValues(linhasFila);
  }

  escreverStatusCarga_(shTiny, `Fila de hoje criada: ${linhasFila.length} separacoes pendentes`, linhasFila.length ? '0%' : '100%');
  SpreadsheetApp.flush();

  if (!linhasFila.length) {
    iniciarCargaItensPeriodoComDatas_(dataInicial, dataFinal);
    SpreadsheetApp.getUi().alert('Nada novo para puxar hoje. Mesmo assim, iniciei a busca de itens de hoje para separacoes que ja estavam no Tiny_raw.');
    return;
  }

  marcarBuscaItensHojeAposCarga_();
  continuarCargaMesSegundoPlano();
  SpreadsheetApp.getUi().alert('Fila de hoje criada. Ao terminar as separacoes, o script vai iniciar automaticamente a busca dos itens de hoje.');
}

function criarTriggersDiariosOlist() {
  apagarTriggersDiariosOlist();

  [8, 10, 12, 14, 16, 18, 20].forEach(hora => {
    ScriptApp.newTrigger('atualizarHojeTodasContasAutomatico')
      .timeBased()
      .everyDays(1)
      .atHour(hora)
      .create();
  });

  SpreadsheetApp.getUi().alert('Automacao criada para rodar todos os dias as 8h, 10h, 12h, 14h, 16h, 18h e 20h.');
}

function apagarTriggersDiariosOlist() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'atualizarHojeTodasContasAutomatico') {
      ScriptApp.deleteTrigger(t);
    }
  });
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

  throw new Error(`Falhou apos varias tentativas. URL: ${url}`);
}
