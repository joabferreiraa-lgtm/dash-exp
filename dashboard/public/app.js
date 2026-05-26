const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const spreadsheetId = "1bS2iqiMXsXxBXpTkHYW2q2d0pM7smxfhD6e3gWtYRUo";

const state = {
  data: null,
  filters: {
    year: "all",
    month: "all",
    account: "all",
    source: "all",
    person: "all",
    fullShipmentSearch: "",
    fullStartDate: "",
    fullEndDate: "",
  },
  selectedMonth: null,
};

let chartHitBoxes = [];

const els = {
  year: document.querySelector("#yearFilter"),
  month: document.querySelector("#monthFilter"),
  account: document.querySelector("#accountFilter"),
  source: document.querySelector("#sourceFilter"),
  person: document.querySelector("#personFilter"),
  refresh: document.querySelector("#refreshButton"),
  updatedAt: document.querySelector("#updatedAt"),
  status: document.querySelector("#statusPill"),
  kpiTotal: document.querySelector("#kpiTotal"),
  kpiFull: document.querySelector("#kpiFull"),
  kpiTiny: document.querySelector("#kpiTiny"),
  kpiPeople: document.querySelector("#kpiPeople"),
  chart: document.querySelector("#monthlyChart"),
  chartSubtitle: document.querySelector("#chartSubtitle"),
  ranking7Subtitle: document.querySelector("#ranking7Subtitle"),
  ranking7List: document.querySelector("#ranking7List"),
  rankingYesterdaySubtitle: document.querySelector("#rankingYesterdaySubtitle"),
  rankingYesterdayList: document.querySelector("#rankingYesterdayList"),
  rankingMonthSubtitle: document.querySelector("#rankingMonthSubtitle"),
  rankingMonthList: document.querySelector("#rankingMonthList"),
  previousMonthSubtitle: document.querySelector("#previousMonthSubtitle"),
  previousMonthTable: document.querySelector("#previousMonthTable"),
  tableSubtitle: document.querySelector("#tableSubtitle"),
  table: document.querySelector("#peopleTable"),
  fullShipmentSearch: document.querySelector("#fullShipmentSearch"),
  fullStartDate: document.querySelector("#fullStartDateFilter"),
  fullEndDate: document.querySelector("#fullEndDateFilter"),
  fullClearFilters: document.querySelector("#fullClearFilters"),
  fullShipmentSubtitle: document.querySelector("#fullShipmentSubtitle"),
  fullShipmentSummary: document.querySelector("#fullShipmentSummary"),
  monthDetailPanel: document.querySelector("#monthDetailPanel"),
  monthDetailTitle: document.querySelector("#monthDetailTitle"),
  monthDetailSubtitle: document.querySelector("#monthDetailSubtitle"),
  monthDetailTable: document.querySelector("#monthDetailTable"),
  rulesButton: document.querySelector("#rulesButton"),
  rulesCloseButton: document.querySelector("#rulesCloseButton"),
  rulesModal: document.querySelector("#rulesModal"),
};

loadData();

els.refresh?.addEventListener("click", () => loadData(true));
els.chart?.addEventListener("click", event => {
  const month = monthFromChartEvent(event);
  if (!month) return;
  state.selectedMonth = month;
  renderMonthDetail();
});
els.chart?.addEventListener("mousemove", event => {
  els.chart.style.cursor = monthFromChartEvent(event) ? "pointer" : "default";
});
els.rulesButton?.addEventListener("click", openRulesModal);
els.rulesCloseButton?.addEventListener("click", closeRulesModal);
els.rulesModal?.addEventListener("click", event => {
  if (event.target === els.rulesModal) closeRulesModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeRulesModal();
});
[els.year, els.month, els.account, els.source, els.person].filter(Boolean).forEach(select => {
  select.addEventListener("change", () => {
    state.filters[select.dataset.filter] = select.value;
    render();
  });
});

els.fullShipmentSearch?.addEventListener("input", () => {
  state.filters.fullShipmentSearch = clean(els.fullShipmentSearch.value).toLowerCase();
  renderFullShipmentSummary();
});

[els.fullStartDate, els.fullEndDate].filter(Boolean).forEach(input => {
  input.addEventListener("change", () => {
    state.filters[input.dataset.filter] = input.value;
    renderFullShipmentSummary();
  });
});

els.fullClearFilters?.addEventListener("click", () => {
  state.filters.fullShipmentSearch = "";
  state.filters.fullStartDate = "";
  state.filters.fullEndDate = "";
  els.fullShipmentSearch.value = "";
  els.fullStartDate.value = "";
  els.fullEndDate.value = "";
  renderFullShipmentSummary();
});

async function loadData(force = false) {
  if (els.status) els.status.textContent = "Atualizando";
  let data;
  try {
    const response = await fetch(`/api/data${force ? "?refresh=1" : ""}`);
    data = await response.json();
    if (data.error) throw new Error(data.error);
  } catch (error) {
    data = await loadDirectFromSheets();
  }
  state.data = data;
  setupFilters();
  render();
}

async function loadDirectFromSheets() {
  const [fullRows, tinyRows, usuariosRows] = await Promise.all([
    fetchSheetCsv("FULL"),
    fetchSheetCsv("Tiny_raw"),
    fetchSheetCsv("usuarios"),
  ]);
  const usuarios = buildUsuariosMap(usuariosRows);
  const records = [
    ...recordsFromFull(fullRows),
    ...recordsFromTinyRaw(tinyRows, usuarios),
  ];

  return {
    updatedAt: new Date().toISOString(),
    records,
    years: [...new Set(records.map(r => r.year).filter(Boolean))].sort((a, b) => b - a),
    accounts: [...new Set(records.map(r => r.account).filter(Boolean))].sort(),
    people: [...new Set(records.map(r => r.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

function openRulesModal() {
  if (!els.rulesModal) return;
  els.rulesModal.classList.add("open");
  els.rulesModal.setAttribute("aria-hidden", "false");
  els.rulesCloseButton?.focus();
}

function closeRulesModal() {
  if (!els.rulesModal) return;
  els.rulesModal.classList.remove("open");
  els.rulesModal.setAttribute("aria-hidden", "true");
}

async function fetchSheetCsv(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nao consegui ler ${sheetName}`);
  return parseCsv(await response.text());
}

function recordsFromFull(rows) {
  return rows.slice(1).map(row => {
    const name = clean(row[0]);
    const qty = fullItemsQty(row);
    const date = toDate(row[8]);
    if (!name || !qty || !date) return null;
    return {
      source: "Full",
      account: "FULL",
      name,
      qty,
      productQty: toNumber(row[1]),
      sku: clean(row[2]),
      loja: clean(row[3]),
      envio: clean(row[4]),
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      date: date.toISOString(),
    };
  }).filter(Boolean);
}

function fullItemsQty(row) {
  const total = toNumber(row[7]);
  if (total) return total;
  return toNumber(row[1]) * toNumber(row[6]);
}

function recordsFromTinyRaw(rows, usuarios) {
  return rows.slice(1).map(row => {
    const id = clean(row[4]);
    const name = clean(usuarios[id] || row[5]);
    const qty = toNumber(row[10]);
    const account = clean(row[12] || "CONTA1");
    const date = toDate(row[3] || row[1] || row[2]);
    if (!name || !qty || !date) return null;
    return { source: "Tiny", account, name, qty, year: date.getFullYear(), month: date.getMonth() + 1, date: date.toISOString() };
  }).filter(Boolean);
}

function buildUsuariosMap(rows) {
  const map = {};
  for (const row of rows.slice(1)) {
    const id = clean(row[0]);
    const name = clean(row[1]);
    if (id && name) map[id] = name;
  }
  return map;
}

function setupFilters() {
  const { years, accounts, people } = state.data;
  if (years.length && state.filters.year === "all") {
    state.filters.year = String(years[0]);
  }

  fillSelect(els.year, "year", [["all", "Todos"], ...years.map(year => [String(year), String(year)])]);
  fillSelect(els.month, "month", [["all", "Todos"], ...monthNames.map((name, idx) => [String(idx + 1), name])]);
  fillSelect(els.account, "account", [["all", "Todas"], ...accounts.map(account => [account, account])]);
  fillSelect(els.source, "source", [["all", "Full + Tiny"], ["Full", "Apenas Full"], ["Tiny", "Apenas Tiny"]]);
  fillSelect(els.person, "person", [["all", "Todos"], ...people.map(person => [person, person])]);
  if (els.fullStartDate) els.fullStartDate.dataset.filter = "fullStartDate";
  if (els.fullEndDate) els.fullEndDate.dataset.filter = "fullEndDate";

  if (els.year) {
    els.year.value = state.filters.year;
  }
}

function fillSelect(select, filter, options) {
  if (!select) return;
  select.dataset.filter = filter;
  select.innerHTML = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
  if (options.some(([value]) => value === state.filters[filter])) {
    select.value = state.filters[filter];
  }
}

function render() {
  const records = filteredRecords();
  const totals = sumTotals(records);
  const peopleRows = byPerson(records);
  const monthRows = byMonth(records);
  const ranking7Rows = byPerson(last7DayRecords()).slice(0, 8);
  const rankingYesterdayRows = byPerson(yesterdayRecords()).slice(0, 8);
  const rankingMonthRows = byPerson(currentMonthRecords()).slice(0, 8);
  const previousMonthRows = byPerson(previousMonthRecords());

  els.kpiTotal.textContent = fmt(totals.total);
  els.kpiFull.textContent = fmt(totals.full);
  els.kpiTiny.textContent = fmt(totals.tiny);
  els.kpiPeople.textContent = fmt(peopleRows.length);
  els.updatedAt.textContent = `Atualizado ${new Date(state.data.updatedAt).toLocaleString("pt-BR")}`;
  els.status.textContent = `${fmt(records.length)} lançamentos`;
  els.chartSubtitle.textContent = filterLabel();
  els.ranking7Subtitle.textContent = last7Label();
  els.rankingYesterdaySubtitle.previousElementSibling.textContent = els.previousMonthTable
    ? "Ranking itens embalados no dia anterior"
    : "Ranking dia anterior";
  els.rankingYesterdaySubtitle.textContent = yesterdayLabel();
  els.rankingMonthSubtitle.textContent = currentMonthLabel();
  if (els.previousMonthSubtitle) els.previousMonthSubtitle.textContent = previousMonthLabel();
  els.tableSubtitle.textContent = `${fmt(peopleRows.length)} colaboradores com itens embalados`;

  drawMonthlyChart(monthRows);
  renderRanking(els.ranking7List, ranking7Rows);
  renderRanking(els.rankingYesterdayList, rankingYesterdayRows);
  renderRanking(els.rankingMonthList, rankingMonthRows);
  renderPreviousMonthTable(previousMonthRows);
  renderTable(peopleRows);
  renderMonthDetail();
  renderFullShipmentSummary();
}

function filteredRecords() {
  return state.data.records.filter(record => {
    if (state.filters.year !== "all" && record.year !== Number(state.filters.year)) return false;
    if (state.filters.month !== "all" && record.month !== Number(state.filters.month)) return false;
    if (state.filters.account !== "all" && record.account !== state.filters.account) return false;
    if (state.filters.source !== "all" && record.source !== state.filters.source) return false;
    if (state.filters.person !== "all" && record.name !== state.filters.person) return false;
    return true;
  });
}

function last7DayRecords() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return state.data.records.filter(record => {
    const date = new Date(record.date);
    if (date < start || date >= end) return false;
    return matchesRankingCommonFilters(record);
  });
}

function currentMonthRecords() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return state.data.records.filter(record => {
    if (record.year !== year || record.month !== month) return false;
    return matchesRankingCommonFilters(record);
  });
}

function yesterdayRecords() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return state.data.records.filter(record => {
    const date = new Date(record.date);
    if (date < start || date >= end) return false;
    return matchesRankingCommonFilters(record);
  });
}

function previousMonthRecords() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  return state.data.records.filter(record => {
    const date = new Date(record.date);
    if (date < start || date >= end) return false;
    return matchesRankingCommonFilters(record);
  });
}

function matchesRankingCommonFilters(record) {
  if (state.filters.account !== "all" && record.account !== state.filters.account) return false;
  if (state.filters.source !== "all" && record.source !== state.filters.source) return false;
  if (state.filters.person !== "all" && record.name !== state.filters.person) return false;
  return true;
}

function sumTotals(records) {
  return records.reduce((acc, record) => {
    acc.total += record.qty;
    if (record.source === "Full") acc.full += record.qty;
    if (record.source === "Tiny") acc.tiny += record.qty;
    return acc;
  }, { total: 0, full: 0, tiny: 0 });
}

function byPerson(records) {
  const map = new Map();
  for (const record of records) {
    if (!map.has(record.name)) map.set(record.name, { name: record.name, total: 0, full: 0, tiny: 0 });
    const row = map.get(record.name);
    row.total += record.qty;
    row[record.source.toLowerCase()] += record.qty;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function byMonth(records) {
  const rows = monthNames.map((name, idx) => ({ month: idx + 1, name, total: 0, full: 0, tiny: 0 }));
  for (const record of records) {
    const row = rows[record.month - 1];
    if (!row) continue;
    row.total += record.qty;
    row[record.source.toLowerCase()] += record.qty;
  }
  return rows;
}

function renderRanking(container, rows) {
  container.innerHTML = rows.length
    ? rows.map((row, idx) => `
        <div class="rank-row">
          <span>${idx + 1}</span>
          <b>${escapeHtml(row.name)}</b>
          <strong>${fmt(row.total)}</strong>
        </div>
      `).join("")
    : `<p class="muted">Sem dados para o filtro atual.</p>`;
}

function renderFullShipmentSummary() {
  if (!els.fullShipmentSummary) return;

  const allRows = buildFullShipmentRows();
  const isFiltered = Boolean(state.filters.fullShipmentSearch || state.filters.fullStartDate || state.filters.fullEndDate);
  const rows = isFiltered ? allRows : allRows.slice(0, 20);
  els.fullShipmentSubtitle.textContent = isFiltered
    ? `${fmt(rows.length)} envios`
    : `${fmt(rows.length)} ultimos envios`;
  els.fullShipmentSummary.innerHTML = rows.length
    ? `
      <div class="table-wrap">
        <table class="shipment-table">
          <thead>
            <tr>
              <th>Numero do envio</th>
              <th>Loja</th>
              <th>Ultima embalagem</th>
              <th>Quantidade de produtos</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr class="shipment-row" tabindex="0">
                <td><strong>${escapeHtml(row.envio)}</strong></td>
                <td>${escapeHtml(row.loja || "-")}</td>
                <td>${escapeHtml(formatDateTime(row.latestDate))}</td>
                <td><strong>${fmt(row.totalProducts)}</strong></td>
              </tr>
              <tr class="shipment-detail-row">
                <td colspan="4">
                  <table class="sku-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${row.skus.map(sku => `
                        <tr>
                          <td>${escapeHtml(sku.sku || "-")}</td>
                          <td><strong>${fmt(sku.qty)}</strong></td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p class="muted">Sem envios Full para os filtros selecionados.</p>`;

  els.fullShipmentSummary.querySelectorAll(".shipment-row").forEach(row => {
    row.addEventListener("click", () => row.classList.toggle("open"));
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        row.classList.toggle("open");
      }
    });
  });
}

function buildFullShipmentRows() {
  const start = state.filters.fullStartDate ? new Date(`${state.filters.fullStartDate}T00:00:00`) : null;
  const end = state.filters.fullEndDate ? new Date(`${state.filters.fullEndDate}T23:59:59`) : null;
  const map = new Map();

  for (const record of state.data.records) {
    if (record.source !== "Full") continue;
    if (state.filters.fullShipmentSearch && !clean(record.envio).toLowerCase().includes(state.filters.fullShipmentSearch)) continue;

    const date = new Date(record.date);
    if (start && date < start) continue;
    if (end && date > end) continue;

    const key = `${record.envio}|||${record.loja}`;
    if (!map.has(key)) {
      map.set(key, {
        envio: record.envio || "-",
        loja: record.loja || "-",
        totalProducts: 0,
        latestDate: date,
        skuMap: new Map(),
      });
    }

    const row = map.get(key);
    const qty = record.productQty || 0;
    row.totalProducts += qty;
    row.skuMap.set(record.sku, (row.skuMap.get(record.sku) || 0) + qty);
    if (date > row.latestDate) row.latestDate = date;
  }

  return [...map.values()]
    .map(row => ({
      envio: row.envio,
      loja: row.loja,
      totalProducts: row.totalProducts,
      latestDate: row.latestDate,
      skus: [...row.skuMap.entries()]
        .map(([sku, qty]) => ({ sku, qty }))
        .sort((a, b) => b.qty - a.qty || a.sku.localeCompare(b.sku, "pt-BR", { numeric: true })),
    }))
    .sort((a, b) => b.latestDate - a.latestDate || a.envio.localeCompare(b.envio, "pt-BR", { numeric: true }));
}

function renderPreviousMonthTable(rows) {
  if (!els.previousMonthTable) return;

  els.previousMonthTable.innerHTML = rows.length
    ? rows.map(row => {
      const fullShare = row.total ? `${Math.round((row.full / row.total) * 100)}%` : "0%";
      const tinyShare = row.total ? `${Math.round((row.tiny / row.total) * 100)}%` : "0%";
      return `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td><strong>${fmt(row.total)}</strong></td>
        <td>${fmt(row.full)}</td>
        <td>${fmt(row.tiny)}</td>
        <td>${fullShare}</td>
        <td>${tinyShare}</td>
      </tr>
    `;
    }).join("")
    : `<tr><td colspan="6">Sem itens embalados no mes anterior.</td></tr>`;
}

function renderTable(rows) {
  els.table.innerHTML = rows.map(row => {
    const fullShare = row.total ? `${Math.round((row.full / row.total) * 100)}%` : "0%";
    const tinyShare = row.total ? `${Math.round((row.tiny / row.total) * 100)}%` : "0%";
    return `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td><strong>${fmt(row.total)}</strong></td>
        <td>${fmt(row.full)}</td>
        <td>${fmt(row.tiny)}</td>
        <td>${fullShare}</td>
        <td>${tinyShare}</td>
      </tr>
    `;
  }).join("");
}

function renderMonthDetail() {
  if (!els.monthDetailPanel || !els.monthDetailTable) return;

  if (!state.selectedMonth) {
    els.monthDetailPanel.hidden = true;
    return;
  }

  const month = state.selectedMonth;
  const records = state.data.records.filter(record => {
    if (record.month !== month) return false;
    if (state.filters.year !== "all" && record.year !== Number(state.filters.year)) return false;
    if (state.filters.account !== "all" && record.account !== state.filters.account) return false;
    if (state.filters.source !== "all" && record.source !== state.filters.source) return false;
    if (state.filters.person !== "all" && record.name !== state.filters.person) return false;
    return true;
  });

  const rows = byPerson(records);
  const total = rows.reduce((acc, row) => acc + row.total, 0);
  els.monthDetailPanel.hidden = false;
  els.monthDetailTitle.textContent = `${monthNames[month - 1]} - total por colaborador`;
  els.monthDetailSubtitle.textContent = `${fmt(total)} itens embalados`;
  els.monthDetailTable.innerHTML = rows.length
    ? rows.map(row => {
      const fullShare = row.total ? `${Math.round((row.full / row.total) * 100)}%` : "0%";
      const tinyShare = row.total ? `${Math.round((row.tiny / row.total) * 100)}%` : "0%";
      return `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td><strong>${fmt(row.total)}</strong></td>
          <td>${fmt(row.full)}</td>
          <td>${fmt(row.tiny)}</td>
          <td>${fullShare}</td>
          <td>${tinyShare}</td>
        </tr>
      `;
    }).join("")
    : `<tr><td colspan="6">Sem itens embalados neste mes para os filtros atuais.</td></tr>`;
}

function drawMonthlyChart(rows) {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = { top: 22, right: 24, bottom: 42, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...rows.map(row => row.total));
  chartHitBoxes = [];

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#d9e0ea";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#64748b";
  ctx.font = "13px Arial";

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + plotH * (i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    const label = Math.round(max * (1 - i / 4));
    ctx.fillText(fmt(label), 10, y + 4);
  }

  const gap = 12;
  const barW = (plotW - gap * (rows.length - 1)) / rows.length;

  rows.forEach((row, idx) => {
    const x = pad.left + idx * (barW + gap);
    const h = (row.total / max) * plotH;
    const y = pad.top + plotH - h;
    chartHitBoxes.push({
      month: row.month,
      x,
      y: pad.top,
      width: barW,
      height: plotH + pad.bottom,
    });

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = "#1a2433";
    ctx.fillText(row.name, x + Math.max(0, barW / 2 - 12), height - 14);
  });
}

function monthFromChartEvent(event) {
  if (!els.chart || !chartHitBoxes.length) return null;
  const rect = els.chart.getBoundingClientRect();
  const scaleX = els.chart.width / rect.width;
  const scaleY = els.chart.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  const directHit = chartHitBoxes.find(box =>
    x >= box.x &&
    x <= box.x + box.width &&
    y >= box.y &&
    y <= box.y + box.height
  );
  if (directHit) return directHit.month;

  const first = chartHitBoxes[0];
  const last = chartHitBoxes[chartHitBoxes.length - 1];
  const chartLeft = first.x;
  const chartRight = last.x + last.width;
  const chartTop = Math.min(...chartHitBoxes.map(box => box.y));
  const chartBottom = Math.max(...chartHitBoxes.map(box => box.y + box.height));

  if (x < chartLeft || x > chartRight || y < chartTop || y > chartBottom) return null;

  const monthIndex = Math.floor(((x - chartLeft) / (chartRight - chartLeft)) * chartHitBoxes.length);
  return chartHitBoxes[Math.min(monthIndex, chartHitBoxes.length - 1)]?.month || null;
}

function filterLabel() {
  const parts = [];
  if (state.filters.year !== "all") parts.push(state.filters.year);
  if (state.filters.month !== "all") parts.push(monthNames[Number(state.filters.month) - 1]);
  if (state.filters.account !== "all") parts.push(state.filters.account);
  if (state.filters.source !== "all") parts.push(state.filters.source);
  if (state.filters.person !== "all") parts.push(state.filters.person);
  return parts.length ? parts.join(" · ") : "Todos os dados";
}

function last7Label() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

function currentMonthLabel() {
  const now = new Date();
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

function yesterdayLabel() {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return yesterday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function previousMonthLabel() {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${monthNames[previous.getMonth()]} ${previous.getFullYear()}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmt(value) {
  return Math.round(value).toLocaleString("pt-BR");
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

function toNumber(value) {
  const text = clean(value).replace(/\./g, "").replace(",", ".");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function toDate(value) {
  const text = clean(value);
  if (!text) return null;

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    return new Date(
      Number(br[3]),
      Number(br[2]) - 1,
      Number(br[1]),
      Number(br[4] || 0),
      Number(br[5] || 0),
      Number(br[6] || 0),
    );
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20_000) {
      return new Date(Math.round((serial - 25569) * 86400 * 1000));
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
