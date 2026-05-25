/************ RESUMO FULL + TINY ************/
function onEdit(e) {
  if (!e) return;

  var aba = e.source.getActiveSheet();
  var nomeAba = aba.getName();
  var linha = e.range.getRow();
  var coluna = e.range.getColumn();

  if (nomeAba === "FULL") {
    if (coluna == 1 && linha > 1) {
      var celulaData = aba.getRange(linha, 9); // Coluna I
      var valor = e.range.getValue();

      if (valor !== "") {
        if (celulaData.getValue() == "") {
          celulaData.setValue(new Date());
        }
      } else {
        celulaData.clearContent();
      }
    }

    atualizarResumo();
  }
}

function atualizarResumo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaFull = ss.getSheetByName("FULL");
  const abaTinyRaw = ss.getSheetByName("Tiny_raw");
  const abaResumo = ss.getSheetByName("Resumo");

  if (!abaResumo) throw new Error('A aba "Resumo" não foi encontrada.');

  const anoResumo = obterAnoResumo_(ss);
  const mesesHeader = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const mapa = {};
  const mapaUsuarios = carregarMapaUsuariosResumo_(ss);

  if (abaFull) {
    somarFullNoMapa_(abaFull, mapa, anoResumo);
  }

  if (abaTinyRaw) {
    somarTinyRawNoMapa_(abaTinyRaw, mapa, anoResumo, mapaUsuarios);
  }

  const nomes = Object.keys(mapa).sort((a, b) => a.localeCompare(b, "pt-BR"));

  abaResumo.clearContents();

  if (!nomes.length) {
    abaResumo.getRange(1, 1).setValue(`Sem dados para ${anoResumo}.`);
    return;
  }

  const tabela = [];
  tabela.push(["Nome", ...mesesHeader, `Total ${anoResumo}`]);

  for (const nome of nomes) {
    const full = mapa[nome].full;
    const tiny = mapa[nome].tiny;
    const total = somarArrays_(full, tiny);

    tabela.push([nome, ...total, somarArray_(total)]);
  }

  const totalFullMeses = Array(12).fill(0);
  const totalTinyMeses = Array(12).fill(0);

  for (const nome of nomes) {
    for (let i = 0; i < 12; i++) {
      totalFullMeses[i] += mapa[nome].full[i];
      totalTinyMeses[i] += mapa[nome].tiny[i];
    }
  }

  const totalGeralMeses = somarArrays_(totalFullMeses, totalTinyMeses);

  tabela.push(["TOTAL GERAL", ...totalGeralMeses, somarArray_(totalGeralMeses)]);

  abaResumo.getRange(1, 1, tabela.length, tabela[0].length).setValues(tabela);

  formatarResumoFullTiny_(abaResumo, tabela.length, tabela[0].length);
  escreverRankingMesAtual_(abaResumo, mapa, nomes, mesesHeader, anoResumo);
}

function somarFullNoMapa_(abaFull, mapa, anoResumo) {
  const ultimaLinha = abaFull.getLastRow();
  if (ultimaLinha < 2) return;

  const dados = abaFull.getRange(2, 1, ultimaLinha - 1, 9).getValues();

  for (const linha of dados) {
    const nome = normalizarNomeResumo_(linha[0]);
    const qtdTotal = Number(linha[7]) || 0; // Coluna H
    const data = converterParaDataResumo_(linha[8]); // Coluna I

    if (!nome || !data || qtdTotal === 0) continue;
    if (data.getFullYear() !== anoResumo) continue;

    garantirColaboradorResumo_(mapa, nome);
    mapa[nome].full[data.getMonth()] += qtdTotal;
  }
}

function somarTinyRawNoMapa_(abaTinyRaw, mapa, anoResumo, mapaUsuarios) {
  const ultimaLinha = abaTinyRaw.getLastRow();
  if (ultimaLinha < 2) return;

  const dados = abaTinyRaw.getRange(2, 1, ultimaLinha - 1, 13).getValues();

  for (const linha of dados) {
    const data = converterParaDataResumo_(linha[3] || linha[1] || linha[2]); // Checkout, criação ou separação
    const idUsuario = String(linha[4] || "").trim(); // ID Usuário Embalador
    const nome = normalizarNomeResumo_(mapaUsuarios[idUsuario] || linha[5]); // usuarios!A:B primeiro
    const qtdItens = Number(linha[10]) || 0; // Qtd Itens

    if (!nome || !data || qtdItens === 0) continue;
    if (data.getFullYear() !== anoResumo) continue;

    garantirColaboradorResumo_(mapa, nome);
    mapa[nome].tiny[data.getMonth()] += qtdItens;
  }
}

function garantirColaboradorResumo_(mapa, nome) {
  if (!mapa[nome]) {
    mapa[nome] = {
      full: Array(12).fill(0),
      tiny: Array(12).fill(0)
    };
  }
}

function obterAnoResumo_(ss) {
  const abaTiny = ss.getSheetByName("Tiny");
  const anoTiny = abaTiny ? Number(abaTiny.getRange("H2").getValue()) : 0;
  return anoTiny || new Date().getFullYear();
}

function carregarMapaUsuariosResumo_(ss) {
  const abaUsuarios = ss.getSheetByName("usuarios");
  const mapa = {};

  if (!abaUsuarios) return mapa;

  const ultimaLinha = abaUsuarios.getLastRow();
  if (ultimaLinha < 2) return mapa;

  const dados = abaUsuarios.getRange(2, 1, ultimaLinha - 1, 2).getValues();

  for (const linha of dados) {
    const id = String(linha[0] || "").trim();
    const nome = normalizarNomeResumo_(linha[1]);

    if (id && nome) {
      mapa[id] = nome;
    }
  }

  return mapa;
}

function normalizarNomeResumo_(valor) {
  const nome = String(valor || "").trim().replace(/\s+/g, " ");
  return nome;
}

function converterParaDataResumo_(valor) {
  if (!valor) return null;
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) return valor;

  const data = new Date(String(valor).trim());
  if (!isNaN(data)) return data;

  return null;
}

function somarArray_(arr) {
  return arr.reduce((acc, valor) => acc + (Number(valor) || 0), 0);
}

function somarArrays_(a, b) {
  return a.map((valor, idx) => (Number(valor) || 0) + (Number(b[idx]) || 0));
}

function formatarResumoFullTiny_(abaResumo, totalLinhas, totalColunas) {
  abaResumo.getRange(1, 1, 1, totalColunas).setFontWeight("bold");
  abaResumo.getRange(totalLinhas, 1, 1, totalColunas).setFontWeight("bold");
  abaResumo.autoResizeColumns(1, totalColunas);
}

function escreverRankingMesAtual_(abaResumo, mapa, nomes, mesesHeader, anoResumo) {
  const hoje = new Date();
  const mesAtual = hoje.getFullYear() === anoResumo ? hoje.getMonth() : 0;
  const nomeMesAtual = mesesHeader[mesAtual];

  const ranking = [];
  ranking.push(["Posição", "Nome", nomeMesAtual]);

  const rankingOrdenado = nomes
    .map(nome => {
      const full = mapa[nome].full[mesAtual] || 0;
      const tiny = mapa[nome].tiny[mesAtual] || 0;
      return [nome, full + tiny];
    })
    .filter(item => item[1] > 0)
    .sort((a, b) => b[1] - a[1]);

  rankingOrdenado.forEach((item, idx) => {
    ranking.push([idx + 1, item[0], item[1]]);
  });

  abaResumo.getRange("Q1").setValue(`Ranking do mês atual (${nomeMesAtual})`);
  abaResumo.getRange("Q1").setFontWeight("bold");
  abaResumo.getRange(2, 17, abaResumo.getMaxRows() - 1, 3).clearContent();
  abaResumo.getRange(2, 17, ranking.length, 3).setValues(ranking);
  abaResumo.getRange(2, 17, 1, 3).setFontWeight("bold");
  abaResumo.autoResizeColumns(17, 3);
}
