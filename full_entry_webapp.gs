/************ WEB APP - INCLUSAO FULL ************/
const FULL_ENTRY_WEBAPP_VERSION_V3 = "full-entry-v4-force-full-row";

function doGet() {
  return fullEntryV3Json_({
    ok: true,
    version: FULL_ENTRY_WEBAPP_VERSION_V3,
    message: "Web App de inclusão FULL ativo."
  });
}

function doPost(e) {
  try {
    const payload = fullEntryV3Payload_(e);
    const resultado = fullEntryV3InserirLancamento_(payload);

    return fullEntryV3Json_({ ok: true, version: FULL_ENTRY_WEBAPP_VERSION_V3, ...resultado });
  } catch (error) {
    return fullEntryV3Json_({ ok: false, version: FULL_ENTRY_WEBAPP_VERSION_V3, error: error.message });
  }
}

function fullEntryV3Payload_(e) {
  const contents = e && e.postData ? e.postData.contents : "";

  if (contents) {
    try {
      return JSON.parse(contents);
    } catch (error) {
      // Continua para e.parameter quando o envio veio de formulario.
    }
  }

  return {
    nome: e?.parameter?.nome || e?.parameter?.Nome || "",
    qtd: e?.parameter?.qtd || e?.parameter?.Qtd || "",
    sku: e?.parameter?.sku || e?.parameter?.SKU || "",
    loja: e?.parameter?.loja || e?.parameter?.Loja || "",
    envio: e?.parameter?.envio || e?.parameter?.["Nº Envio"] || e?.parameter?.["N° Envio"] || "",
    obs: e?.parameter?.obs || e?.parameter?.OBS || ""
  };
}

function fullEntryV3InserirLancamento_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shFull = ss.getSheetByName("FULL");
  const shSku = ss.getSheetByName("SKU");

  if (!shFull) throw new Error('A aba "FULL" não foi encontrada.');
  if (!shSku) throw new Error('A aba "SKU" não foi encontrada.');

  const nome = fullEntryV3LimparTexto_(payload.nome);
  const qtd = Number(payload.qtd);
  const sku = fullEntryV3LimparTexto_(payload.sku);
  const loja = fullEntryV3LimparTexto_(payload.loja);
  const envio = fullEntryV3LimparTexto_(payload.envio);
  const obs = fullEntryV3LimparTexto_(payload.obs);

  if (!nome) throw new Error("Escolha o colaborador.");
  if (!qtd || qtd <= 0) throw new Error("Informe uma quantidade maior que zero.");
  if (!sku) throw new Error("Escolha o SKU.");
  if (!loja) throw new Error("Escolha a loja.");
  if (!envio) throw new Error("Informe o Nº do Envio.");

  const qtdItens = fullEntryV3BuscarQtdItensSku_(shSku, sku);
  const qtdTotal = qtd * qtdItens;
  const novaLinha = shFull.getLastRow() + 1;
  const agora = new Date();

  shFull.getRange(novaLinha, 1, 1, 9).setValues([[
    nome,
    qtd,
    sku,
    loja,
    envio,
    obs,
    qtdItens,
    qtdTotal,
    agora
  ]]);

  // Reforca campos que alguns formatos/validacoes da planilha podem deixar em branco.
  shFull.getRange(novaLinha, 4).setValue(loja);
  shFull.getRange(novaLinha, 5).setValue(envio);
  shFull.getRange(novaLinha, 9).setValue(agora);
  shFull.getRange(novaLinha, 9).setNumberFormat("dd/mm/yyyy hh:mm:ss");

  return {
    row: novaLinha,
    nome,
    qtd,
    sku,
    loja,
    envio,
    qtdItens,
    qtdTotal
  };
}

function fullEntryV3BuscarQtdItensSku_(shSku, sku) {
  const lastRow = shSku.getLastRow();
  if (lastRow < 2) throw new Error("A aba SKU está vazia.");

  const dados = shSku.getRange(2, 1, lastRow - 1, 2).getValues();
  const skuBuscado = fullEntryV3LimparTexto_(sku).toLowerCase();

  for (const linha of dados) {
    const skuPlanilha = fullEntryV3LimparTexto_(linha[0]).toLowerCase();
    if (skuPlanilha === skuBuscado) {
      const qtdItens = Number(linha[1]) || 0;
      if (qtdItens <= 0) throw new Error(`SKU ${sku} está sem Qtd válida na aba SKU.`);
      return qtdItens;
    }
  }

  throw new Error(`SKU não encontrado na aba SKU: ${sku}`);
}

function fullEntryV3LimparTexto_(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function fullEntryV3Json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
