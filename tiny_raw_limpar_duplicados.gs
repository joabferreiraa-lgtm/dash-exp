/************ LIMPEZA DE DUPLICADOS TINY_RAW ************/
function limparDuplicadosTinyRawPorVendaConta() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Tiny_raw");

  if (!sh) throw new Error('A aba "Tiny_raw" não foi encontrada.');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("Tiny_raw não tem dados para verificar.");
    return;
  }

  const dados = sh.getRange(2, 1, lastRow - 1, 13).getValues();
  const vistos = {};
  const linhasParaExcluir = [];

  for (let i = 0; i < dados.length; i++) {
    const numeroVenda = limparDuplicadoTinyRawTexto_(dados[i][8]); // Coluna I
    const contaOlist = limparDuplicadoTinyRawTexto_(dados[i][12] || "CONTA1"); // Coluna M

    if (!numeroVenda) continue;

    const chave = `${contaOlist}||${numeroVenda}`;

    if (vistos[chave]) {
      linhasParaExcluir.push(i + 2);
    } else {
      vistos[chave] = true;
    }
  }

  for (let i = linhasParaExcluir.length - 1; i >= 0; i--) {
    sh.deleteRow(linhasParaExcluir[i]);
  }

  SpreadsheetApp.getUi().alert(`Duplicados removidos do Tiny_raw: ${linhasParaExcluir.length}`);
}

function listarDuplicadosTinyRawPorVendaConta() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Tiny_raw");

  if (!sh) throw new Error('A aba "Tiny_raw" não foi encontrada.');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("Tiny_raw não tem dados para verificar.");
    return;
  }

  const dados = sh.getRange(2, 1, lastRow - 1, 13).getValues();
  const contagem = {};

  for (let i = 0; i < dados.length; i++) {
    const numeroVenda = limparDuplicadoTinyRawTexto_(dados[i][8]); // Coluna I
    const contaOlist = limparDuplicadoTinyRawTexto_(dados[i][12] || "CONTA1"); // Coluna M

    if (!numeroVenda) continue;

    const chave = `${contaOlist}||${numeroVenda}`;

    if (!contagem[chave]) {
      contagem[chave] = {
        contaOlist,
        numeroVenda,
        linhas: []
      };
    }

    contagem[chave].linhas.push(i + 2);
  }

  const duplicados = Object.values(contagem).filter(item => item.linhas.length > 1);

  if (!duplicados.length) {
    SpreadsheetApp.getUi().alert("Nenhum duplicado encontrado por Número Venda + Conta Olist.");
    return;
  }

  const msg = duplicados
    .slice(0, 20)
    .map(item => `${item.contaOlist} / venda ${item.numeroVenda}: linhas ${item.linhas.join(", ")}`)
    .join("\n");

  SpreadsheetApp.getUi().alert(
    `Duplicados encontrados: ${duplicados.length}\n\n` +
    msg +
    (duplicados.length > 20 ? "\n\nMostrando só os primeiros 20." : "")
  );
}

function limparDuplicadoTinyRawTexto_(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}
