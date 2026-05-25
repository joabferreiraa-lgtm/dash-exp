const spreadsheetId = "1bS2iqiMXsXxBXpTkHYW2q2d0pM7smxfhD6e3gWtYRUo";

const state = {
  selectedName: "",
  skus: [],
  webAppUrl: "",
  recentEntries: [],
};

const els = {
  nameButtons: document.querySelector("#nameButtons"),
  selectedName: document.querySelector("#selectedName"),
  form: document.querySelector("#entryForm"),
  qtd: document.querySelector("#qtdInput"),
  sku: document.querySelector("#skuInput"),
  skuList: document.querySelector("#skuList"),
  envio: document.querySelector("#envioInput"),
  loja: document.querySelector("#lojaInput"),
  obs: document.querySelector("#obsInput"),
  submit: document.querySelector("#submitButton"),
  message: document.querySelector("#message"),
  recentRefresh: document.querySelector("#recentRefreshButton"),
  recentEntries: document.querySelector("#recentEntries"),
};

init();
loadRecentEntries();
els.recentRefresh.addEventListener("click", () => loadRecentEntries(true));

async function init() {
  try {
    const [usuariosRows, skuRows, config] = await Promise.all([
      fetchSheetCsv("usuarios"),
      fetchSheetCsv("SKU"),
      fetch("/api/config").then(r => r.json()).catch(() => ({ fullEntryConfigured: false })),
    ]);

    renderNames(namesFromUsuarios(usuariosRows));
    renderSkus(skusFromRows(skuRows));
    state.webAppUrl = config.fullEntryWebAppUrl || "";

    if (!config.fullEntryConfigured) {
      showMessage("Configure dashboard/config.json com a URL do Web App antes de enviar.", "err");
    }
  } catch (error) {
    showMessage(error.message, "err");
  }
}

els.form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!state.selectedName) {
    showMessage("Escolha o colaborador.", "err");
    return;
  }

  const payload = {
    nome: state.selectedName,
    Nome: state.selectedName,
    qtd: Number(els.qtd.value),
    Qtd: Number(els.qtd.value),
    sku: els.sku.value.trim(),
    SKU: els.sku.value.trim(),
    envio: els.envio.value.trim(),
    "Nº Envio": els.envio.value.trim(),
    loja: els.loja.value.trim(),
    Loja: els.loja.value.trim(),
    obs: els.obs.value.trim(),
    OBS: els.obs.value.trim(),
  };

  const skuCadastrado = findRegisteredSku(payload.sku);
  if (!skuCadastrado) {
    showMessage("SKU não cadastrado na aba SKU. Escolha uma opção da lista.", "err");
    els.sku.focus();
    return;
  }

  payload.sku = skuCadastrado;
  payload.SKU = skuCadastrado;

  setSubmitting(true);
  showMessage("Enviando...", "");

  try {
    const result = await submitEntry(payload);
    showMessage(result.message, "ok");
    if (result.entry) {
      prependRecentEntry(result.entry);
      setTimeout(() => loadRecentEntries(true), 2500);
    } else {
      loadRecentEntries(true);
    }
    els.form.reset();
    els.qtd.focus();
  } catch (error) {
    showMessage(error.message, "err");
  } finally {
    setSubmitting(false);
  }
});

async function submitEntry(payload) {
  try {
    const response = await fetch("/api/full-entry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Não foi possível inserir.");
    if (!result.row || typeof result.qtdTotal === "undefined") {
      throw new Error(`O Web App não confirmou a linha inserida. Versão recebida: ${result.version || "sem versão"}.`);
    }
    return {
      message: `Inserido no FULL na linha ${result.row}. Total: ${fmt(result.qtdTotal)} itens.`,
      entry: {
        rowNumber: result.row,
        name: result.nome || payload.nome,
        qtd: result.qtd || payload.qtd,
        sku: result.sku || payload.sku,
        envio: result.envio || payload.envio,
        loja: result.loja || payload.loja,
        qtdTotal: result.qtdTotal,
        date: new Date().toISOString(),
        justAdded: true,
      },
    };
  } catch (error) {
    if (!state.webAppUrl) throw error;
    await submitEntryDirect(payload);
    return {
      message: "Enviado para o FULL. Aguarde alguns segundos e confira a planilha.",
      entry: {
        name: payload.nome,
        qtd: payload.qtd,
        sku: payload.sku,
        envio: payload.envio,
        loja: payload.loja,
        qtdTotal: payload.qtd,
        date: new Date().toISOString(),
        justAdded: true,
      },
    };
  }
}

function submitEntryDirect(payload) {
  return new Promise((resolve, reject) => {
    const iframeName = `fullEntryFrame${Date.now()}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.hidden = true;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = state.webAppUrl;
    form.target = iframeName;
    form.hidden = true;

    Object.entries(payload).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      setTimeout(() => {
        iframe.remove();
        form.remove();
      }, 1000);
      resolve();
    };

    iframe.addEventListener("load", done);
    setTimeout(done, 4500);

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    try {
      form.submit();
    } catch (error) {
      iframe.remove();
      form.remove();
      reject(error);
    }
  });
}

async function loadRecentEntries(force = false) {
  els.recentEntries.innerHTML = `<tr><td colspan="7">Carregando...</td></tr>`;

  try {
    const response = await fetch(`/api/full-recent${force ? "?refresh=1" : ""}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    state.recentEntries = result.entries || [];
    renderRecentEntries(state.recentEntries);
  } catch (error) {
    els.recentEntries.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
  }
}

function prependRecentEntry(entry) {
  state.recentEntries = [
    entry,
    ...state.recentEntries.filter(item => item.rowNumber !== entry.rowNumber),
  ].slice(0, 10);
  renderRecentEntries(state.recentEntries);
}

function renderRecentEntries(entries) {
  els.recentEntries.innerHTML = entries.length
    ? entries.map(entry => `
        <tr class="${entry.justAdded ? "just-added" : ""}">
          <td>${escapeHtml(formatDateTime(entry.date))}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td>${fmt(entry.qtd)}</td>
          <td>${escapeHtml(entry.sku)}</td>
          <td>${escapeHtml(entry.envio)}</td>
          <td>${escapeHtml(entry.loja)}</td>
          <td><strong>${fmt(entry.qtdTotal)}</strong></td>
        </tr>
      `).join("")
    : `<tr><td colspan="7">Nenhum lançamento encontrado.</td></tr>`;
}

function renderNames(names) {
  els.nameButtons.innerHTML = names.map(name => (
    `<button class="name-button" type="button" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
  )).join("");

  els.nameButtons.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedName = button.dataset.name;
      els.selectedName.textContent = state.selectedName;
      els.nameButtons.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
      els.qtd.focus();
    });
  });
}

function renderSkus(skus) {
  state.skus = skus;
  els.skuList.innerHTML = skus.map(sku => `<option value="${escapeHtml(sku)}"></option>`).join("");
}

function namesFromUsuarios(rows) {
  return [...new Set(rows.slice(1).map(row => clean(row[1])).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function skusFromRows(rows) {
  return [...new Set(rows.slice(1).map(row => clean(row[0])).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function findRegisteredSku(value) {
  const typed = clean(value).toLowerCase();
  return state.skus.find(sku => sku.toLowerCase() === typed) || "";
}

async function fetchSheetCsv(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Não consegui ler ${sheetName}.`);
  return parseCsv(await response.text());
}

function setSubmitting(value) {
  els.submit.disabled = value;
  els.submit.textContent = value ? "Inserindo..." : "Inserir no FULL";
}

function showMessage(text, type) {
  els.message.textContent = text;
  els.message.className = `entry-message ${type || ""}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  if (row.some(cell => cell !== "")) rows.push(row);
  return rows;
}

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function fmt(value) {
  return Math.round(Number(value) || 0).toLocaleString("pt-BR");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}
