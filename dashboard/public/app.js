const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const spreadsheetId = "1bS2iqiMXsXxBXpTkHYW2q2d0pM7smxfhD6e3gWtYRUo";
const isCollaboratorPage = Boolean(document.querySelector(".collab-app"));
const hiddenCollaboratorMonths = new Set([1, 2]);

const state = {
  data: null,
  filters: {
    periodMode: "yearMonth",
    periodStartDate: "",
    periodEndDate: "",
    year: "all",
    month: "all",
    account: "all",
    source: "all",
    person: "all",
    fullShipmentSearch: "",
    fullStartDate: "",
    fullEndDate: "",
    packedProductsPeriod: "today",
    packedProductsStartDate: "",
    packedProductsEndDate: "",
    payoutYear: "",
    payoutMonth: "",
    payoutPerson: "all",
  },
  selectedMonth: null,
  maintenance: { enabled: false, message: "" },
};

let chartHitBoxes = [];

const els = {
  period: document.querySelector("#periodFilter"),
  periodStartDate: document.querySelector("#periodStartDateFilter"),
  periodEndDate: document.querySelector("#periodEndDateFilter"),
  year: document.querySelector("#yearFilter"),
  month: document.querySelector("#monthFilter"),
  account: document.querySelector("#accountFilter"),
  source: document.querySelector("#sourceFilter"),
  person: document.querySelector("#personFilter"),
  refresh: document.querySelector("#refreshButton"),
  updatedAt: document.querySelector("#updatedAt"),
  tinyUpdatedAt: document.querySelector("#tinyUpdatedAt"),
  status: document.querySelector("#statusPill"),
  adminViewButtons: document.querySelectorAll("[data-admin-view]"),
  adminViews: document.querySelectorAll(".admin-view"),
  kpiTotal: document.querySelector("#kpiTotal"),
  kpiFull: document.querySelector("#kpiFull"),
  kpiTiny: document.querySelector("#kpiTiny"),
  kpiTotalUnits: document.querySelector("#kpiTotalUnits"),
  kpiFullUnits: document.querySelector("#kpiFullUnits"),
  kpiTinyUnits: document.querySelector("#kpiTinyUnits"),
  kpiPeople: document.querySelector("#kpiPeople"),
  chart: document.querySelector("#monthlyChart"),
  chartSubtitle: document.querySelector("#chartSubtitle"),
  ranking7Subtitle: document.querySelector("#ranking7Subtitle"),
  ranking7List: document.querySelector("#ranking7List"),
  rankingTodaySubtitle: document.querySelector("#rankingTodaySubtitle"),
  rankingTodayList: document.querySelector("#rankingTodayList"),
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
  packedProductsPeriod: document.querySelector("#packedProductsPeriod"),
  packedProductsStartDate: document.querySelector("#packedProductsStartDate"),
  packedProductsEndDate: document.querySelector("#packedProductsEndDate"),
  packedProductsClearFilters: document.querySelector("#packedProductsClearFilters"),
  packedProductsSubtitle: document.querySelector("#packedProductsSubtitle"),
  packedProductsTable: document.querySelector("#packedProductsTable"),
  payoutYear: document.querySelector("#payoutYearFilter"),
  payoutMonth: document.querySelector("#payoutMonthFilter"),
  payoutPerson: document.querySelector("#payoutPersonFilter"),
  payoutSubtitle: document.querySelector("#payoutSubtitle"),
  payoutTotalAmount: document.querySelector("#payoutTotalAmount"),
  payoutTotalPoints: document.querySelector("#payoutTotalPoints"),
  payoutTotalUnits: document.querySelector("#payoutTotalUnits"),
  payoutPeople: document.querySelector("#payoutPeople"),
  payoutTable: document.querySelector("#payoutTable"),
  monthDetailPanel: document.querySelector("#monthDetailPanel"),
  monthDetailTitle: document.querySelector("#monthDetailTitle"),
  monthDetailSubtitle: document.querySelector("#monthDetailSubtitle"),
  monthDetailTable: document.querySelector("#monthDetailTable"),
  rulesButton: document.querySelector("#rulesButton"),
  rulesCloseButton: document.querySelector("#rulesCloseButton"),
  rulesModal: document.querySelector("#rulesModal"),
  pointsNoticeModal: document.querySelector("#pointsNoticeModal"),
  pointsNoticeCloseButton: document.querySelector("#pointsNoticeCloseButton"),
  pointsNoticeOkButton: document.querySelector("#pointsNoticeOkButton"),
  pointsNoticeRulesButton: document.querySelector("#pointsNoticeRulesButton"),
  maintenanceScreen: document.querySelector("#maintenanceScreen"),
  maintenanceMessageText: document.querySelector("#maintenanceMessageText"),
  maintenanceToggle: document.querySelector("#maintenanceToggle"),
  maintenanceMessage: document.querySelector("#maintenanceMessage"),
  maintenanceSaveButton: document.querySelector("#maintenanceSaveButton"),
  maintenanceStatus: document.querySelector("#maintenanceStatus"),
  maintenanceFeedback: document.querySelector("#maintenanceFeedback"),
};

initMaintenanceControls();
loadData();

els.refresh?.addEventListener("click", () => loadData(true));
els.adminViewButtons?.forEach(button => {
  button.addEventListener("click", () => setAdminView(button.dataset.adminView));
});
els.chart?.addEventListener("click", event => {
  if (isCollaboratorPage) return;
  const month = monthFromChartEvent(event);
  if (!month) return;
  state.selectedMonth = month;
  renderMonthDetail();
});
els.chart?.addEventListener("mousemove", event => {
  if (isCollaboratorPage) {
    els.chart.style.cursor = "default";
    return;
  }
  els.chart.style.cursor = monthFromChartEvent(event) ? "pointer" : "default";
});
els.rulesButton?.addEventListener("click", openRulesModal);
els.rulesCloseButton?.addEventListener("click", closeRulesModal);
els.rulesModal?.addEventListener("click", event => {
  if (event.target === els.rulesModal) closeRulesModal();
});
els.pointsNoticeCloseButton?.addEventListener("click", closePointsNoticeModal);
els.pointsNoticeOkButton?.addEventListener("click", closePointsNoticeModal);
els.pointsNoticeRulesButton?.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  closePointsNoticeModal();
  window.setTimeout(openRulesModal, 80);
});
els.pointsNoticeModal?.addEventListener("click", event => {
  if (event.target === els.pointsNoticeModal) closePointsNoticeModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeRulesModal();
    closePointsNoticeModal();
  }
});
[els.year, els.month, els.account, els.source, els.person].filter(Boolean).forEach(select => {
  select.addEventListener("change", () => {
    state.filters[select.dataset.filter] = select.value;
    render();
  });
});

els.period?.addEventListener("change", () => {
  state.filters.periodMode = els.period.value;
  updatePeriodControls();
  render();
});

[els.periodStartDate, els.periodEndDate].filter(Boolean).forEach(input => {
  input.addEventListener("change", () => {
    state.filters[input.dataset.filter] = input.value;
    state.filters.periodMode = "custom";
    if (els.period) els.period.value = "custom";
    updatePeriodControls();
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

els.packedProductsPeriod?.addEventListener("change", () => {
  state.filters.packedProductsPeriod = els.packedProductsPeriod.value;
  renderPackedProductsSummary();
  renderPayoutSummary();
});

[els.packedProductsStartDate, els.packedProductsEndDate].filter(Boolean).forEach(input => {
  input.addEventListener("change", () => {
    state.filters[input.dataset.filter] = input.value;
    state.filters.packedProductsPeriod = "custom";
    if (els.packedProductsPeriod) els.packedProductsPeriod.value = "custom";
    renderPackedProductsSummary();
  });
});

[els.payoutYear, els.payoutMonth, els.payoutPerson].filter(Boolean).forEach(select => {
  select.addEventListener("change", () => {
    state.filters[select.dataset.filter] = select.value;
    renderPayoutSummary();
  });
});

els.packedProductsClearFilters?.addEventListener("click", () => {
  state.filters.packedProductsPeriod = "today";
  state.filters.packedProductsStartDate = "";
  state.filters.packedProductsEndDate = "";
  els.packedProductsPeriod.value = "today";
  els.packedProductsStartDate.value = "";
  els.packedProductsEndDate.value = "";
  renderPackedProductsSummary();
  renderPayoutSummary();
});

async function loadMaintenanceState() {
  try {
    const response = await fetch("/api/maintenance");
    const data = await response.json();
    state.maintenance = {
      enabled: Boolean(data.enabled),
      message: data.message || "Dashboard em manutenção. Os lançamentos Full continuam disponíveis."
    };
  } catch {
    state.maintenance = { enabled: false, message: "" };
  }

  updateMaintenanceControls();
}

function initMaintenanceControls() {
  els.maintenanceSaveButton?.addEventListener("click", saveMaintenanceState);
}

function updateMaintenanceControls() {
  if (els.maintenanceToggle) els.maintenanceToggle.checked = state.maintenance.enabled;
  if (els.maintenanceMessage) els.maintenanceMessage.value = state.maintenance.message;
  if (els.maintenanceStatus) els.maintenanceStatus.textContent = state.maintenance.enabled ? "Ativo" : "Desativado";
}

async function saveMaintenanceState() {
  const enabled = Boolean(els.maintenanceToggle?.checked);
  const message = els.maintenanceMessage?.value || "Dashboard em manutenção. Os lançamentos Full continuam disponíveis.";
  if (els.maintenanceFeedback) els.maintenanceFeedback.textContent = "Salvando...";

  try {
    const response = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled, message })
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "Não foi possível salvar.");
    state.maintenance = { enabled: Boolean(data.enabled), message: data.message || message };
    updateMaintenanceControls();
    if (els.maintenanceFeedback) els.maintenanceFeedback.textContent = enabled ? "Manutenção ativada." : "Manutenção desativada.";
  } catch (error) {
    if (els.maintenanceFeedback) els.maintenanceFeedback.textContent = error.message || "Erro ao salvar manutenção.";
  }
}

function showMaintenanceScreen() {
  document.querySelectorAll(".dashboard-content").forEach(section => { section.hidden = true; });
  if (els.maintenanceScreen) els.maintenanceScreen.hidden = false;
  if (els.maintenanceMessageText) els.maintenanceMessageText.textContent = state.maintenance.message;
  if (els.status) els.status.textContent = "Manutenção";
  if (els.rulesButton) els.rulesButton.hidden = true;
  closePointsNoticeModal();
  closeRulesModal();
}

function showDashboardContent() {
  document.querySelectorAll(".dashboard-content").forEach(section => { section.hidden = false; });
  if (els.maintenanceScreen) els.maintenanceScreen.hidden = true;
  if (els.rulesButton) els.rulesButton.hidden = false;
}
async function loadData(force = false) {
  await loadMaintenanceState();
  if (isCollaboratorPage && state.maintenance.enabled) {
    showMaintenanceScreen();
    return;
  }
  showDashboardContent();
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
  state.data.productRecords = [];
  setupFilters();
  render();
  if (els.packedProductsTable) loadPackedProductsData(force);
}

function setAdminView(viewId) {
  if (!viewId) return;
  els.adminViews?.forEach(view => {
    view.classList.toggle("active", view.id === viewId);
  });
  els.adminViewButtons?.forEach(button => {
    button.classList.toggle("active", button.dataset.adminView === viewId);
  });

  if (viewId === "payoutView") {
    renderPayoutSummary();
  }

  if (viewId === "productsView") {
    loadPackedProductsData(false);
  }
}
async function loadPackedProductsData(force = false) {
  try {
    const response = await fetch(`/api/packed-products${force ? "?refresh=1" : ""}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    state.data.productRecords = data.productRecords || [];
  } catch (error) {
    state.data.productRecords = await loadPackedProductsDirectFromSheets();
  }

  renderPackedProductsSummary();
  renderPayoutSummary();
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

async function loadPackedProductsDirectFromSheets() {
  const [tinyItensRows, usuariosRows] = await Promise.all([
    fetchSheetCsv("Tiny_itens"),
    fetchSheetCsv("usuarios"),
  ]);
  const usuarios = buildUsuariosMap(usuariosRows);
  return recordsFromTinyItens(tinyItensRows, usuarios);
}

function openRulesModal() {
  if (isCollaboratorPage && state.maintenance.enabled) return;
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

function openPointsNoticeModal() {
  if (isCollaboratorPage && state.maintenance.enabled) return;
  if (!els.pointsNoticeModal) return;
  els.pointsNoticeModal.classList.add("open");
  els.pointsNoticeModal.setAttribute("aria-hidden", "false");
  els.pointsNoticeOkButton?.focus();
}

function closePointsNoticeModal() {
  if (!els.pointsNoticeModal) return;
  els.pointsNoticeModal.classList.remove("open");
  els.pointsNoticeModal.setAttribute("aria-hidden", "true");
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
    const unitQty = toNumber(row[1]);
    const date = toDate(row[8]);
    if (!name || !qty || !date) return null;
    return {
      source: "Full",
      account: "FULL",
      name,
      qty,
      unitQty,
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
    const qty = toNumber(row[13]) || toNumber(row[10]);
    const unitQty = 1;
    const account = clean(row[12] || "CONTA1");
    const date = toDate(row[3] || row[1] || row[2]);
    if (!name || !qty || !date) return null;
    return { source: "Tiny", account, name, qty, unitQty, year: date.getFullYear(), month: date.getMonth() + 1, date: date.toISOString() };
  }).filter(Boolean);
}

function recordsFromTinyItens(rows, usuarios) {
  return rows.slice(1).map(row => {
    const id = clean(row[3]);
    const name = clean(usuarios[id] || row[4]);
    const rawDate = row[1];
    const date = toDate(rawDate);
    const key = sheetDateKey(rawDate) || dateKey(date);
    const account = clean(row[2] || "CONTA1");
    const sku = clean(row[8]);
    const description = clean(row[9]);
    const qty = toNumber(row[10]);
    const separationId = clean(row[0]);
    const saleNumber = clean(row[6]);
    const client = clean(row[7]);

    if (!date || !account || !sku || !qty) return null;
    return {
      source: "Tiny",
      account,
      name,
      sku,
      description,
      qty,
      separationId,
      saleNumber,
      client,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      date: date.toISOString(),
      dateKey: key,
    };
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

  fillSelect(els.period, "periodMode", [
    ["yearMonth", "Ano / Mês"],
    ["today", "Hoje"],
    ["yesterday", "Ontem"],
    ["7", "Últimos 7 dias"],
    ["currentMonth", "Mês atual"],
    ["custom", "Personalizado"],
  ]);
  fillSelect(els.year, "year", [["all", "Todos"], ...years.map(year => [String(year), String(year)])]);
  fillSelect(els.month, "month", [["all", "Todos"], ...monthNames.map((name, idx) => [String(idx + 1), name])]);
  fillSelect(els.account, "account", [["all", "Todas"], ...accounts.map(account => [account, account])]);
  fillSelect(els.source, "source", [["all", "Full + Tiny"], ["Full", "Apenas Full"], ["Tiny", "Apenas Tiny"]]);
  fillSelect(els.person, "person", [["all", "Todos"], ...people.map(person => [person, person])]);
  setupPayoutFilters(years);
  if (els.periodStartDate) els.periodStartDate.dataset.filter = "periodStartDate";
  if (els.periodEndDate) els.periodEndDate.dataset.filter = "periodEndDate";
  if (els.fullStartDate) els.fullStartDate.dataset.filter = "fullStartDate";
  if (els.fullEndDate) els.fullEndDate.dataset.filter = "fullEndDate";
  if (els.packedProductsStartDate) els.packedProductsStartDate.dataset.filter = "packedProductsStartDate";
  if (els.packedProductsEndDate) els.packedProductsEndDate.dataset.filter = "packedProductsEndDate";

  if (els.year) {
    els.year.value = state.filters.year;
  }
  if (els.periodStartDate) els.periodStartDate.value = state.filters.periodStartDate;
  if (els.periodEndDate) els.periodEndDate.value = state.filters.periodEndDate;
  if (els.packedProductsPeriod) {
    els.packedProductsPeriod.value = state.filters.packedProductsPeriod;
  }
  updatePeriodControls();
}

function updatePeriodControls() {
  const mode = state.filters.periodMode;
  if (els.period) els.period.value = mode;
  if (els.year) els.year.disabled = mode !== "yearMonth";
  if (els.month) els.month.disabled = mode !== "yearMonth";
  if (els.periodStartDate) els.periodStartDate.disabled = mode !== "custom";
  if (els.periodEndDate) els.periodEndDate.disabled = mode !== "custom";
}

function setupPayoutFilters(years) {
  if (!els.payoutYear || !els.payoutMonth || !els.payoutPerson) return;

  const now = new Date();
  const yearOptions = years.length ? years : [now.getFullYear()];
  if (!state.filters.payoutYear) {
    state.filters.payoutYear = String(yearOptions.includes(now.getFullYear()) ? now.getFullYear() : yearOptions[0]);
  }
  if (!state.filters.payoutMonth) {
    state.filters.payoutMonth = String(now.getMonth() + 1);
  }

  fillSelect(els.payoutYear, "payoutYear", yearOptions.map(year => [String(year), String(year)]));
  fillSelect(els.payoutMonth, "payoutMonth", monthNames.map((name, idx) => [String(idx + 1), name]));
  fillSelect(els.payoutPerson, "payoutPerson", [["all", "Todos"], ...state.data.people.map(person => [person, person])]);
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
  const rankingTodayRows = byPerson(todayRecords()).slice(0, 8);
  const rankingYesterdayRows = byPerson(yesterdayRecords()).slice(0, 8);
  const rankingMonthRows = byPerson(currentMonthRecords()).slice(0, 8);
  const previousMonthRows = byPerson(previousMonthRecords());

  els.kpiTotal.textContent = fmt(totals.total);
  els.kpiFull.textContent = fmt(totals.full);
  els.kpiTiny.textContent = fmt(totals.tiny);
  if (els.kpiTotalUnits) els.kpiTotalUnits.textContent = `${fmt(totals.fullUnits)} pacotes Full + ${fmt(totals.tinyUnits)} pacotes Tiny`;
  if (els.kpiFullUnits) els.kpiFullUnits.textContent = `${fmt(totals.fullUnits)} pacotes`;
  if (els.kpiTinyUnits) els.kpiTinyUnits.textContent = `${fmt(totals.tinyUnits)} pacotes`;
  els.kpiPeople.textContent = fmt(peopleRows.length);
  els.updatedAt.textContent = `Atualizado ${new Date(state.data.updatedAt).toLocaleString("pt-BR")}`;
  if (els.tinyUpdatedAt) els.tinyUpdatedAt.textContent = tinyUpdatedLabel();
  els.status.textContent = `${fmt(records.length)} lançamentos`;
  els.chartSubtitle.textContent = filterLabel();
  els.ranking7Subtitle.textContent = last7Label();
  if (els.rankingTodaySubtitle) els.rankingTodaySubtitle.textContent = todayLabel();
  els.rankingYesterdaySubtitle.previousElementSibling.textContent = els.previousMonthTable
    ? "Ranking de pontos no dia anterior"
    : "Ranking de pontos dia anterior";
  els.rankingYesterdaySubtitle.textContent = yesterdayLabel();
  els.rankingMonthSubtitle.textContent = currentMonthLabel();
  if (els.previousMonthSubtitle) els.previousMonthSubtitle.textContent = previousMonthLabel();
  els.tableSubtitle.textContent = `${fmt(peopleRows.length)} colaboradores com pontos`;

  drawMonthlyChart(monthRows);
  renderRanking(els.ranking7List, ranking7Rows);
  renderRanking(els.rankingTodayList, rankingTodayRows);
  renderRanking(els.rankingYesterdayList, rankingYesterdayRows);
  renderRanking(els.rankingMonthList, rankingMonthRows);
  renderPreviousMonthTable(previousMonthRows);
  renderTable(peopleRows);
  renderMonthDetail();
  renderFullShipmentSummary();
  renderPackedProductsSummary();
  renderPayoutSummary();
}

function filteredRecords() {
  return state.data.records.filter(record => {
    if (shouldHideCollaboratorMonth(record.month)) return false;
    if (!matchesMainPeriod(record)) return false;
    if (state.filters.account !== "all" && record.account !== state.filters.account) return false;
    if (state.filters.source !== "all" && record.source !== state.filters.source) return false;
    if (state.filters.person !== "all" && record.name !== state.filters.person) return false;
    return true;
  });
}

function matchesMainPeriod(record) {
  const mode = state.filters.periodMode;

  if (mode === "yearMonth") {
    if (state.filters.year !== "all" && record.year !== Number(state.filters.year)) return false;
    if (state.filters.month !== "all" && record.month !== Number(state.filters.month)) return false;
    return true;
  }

  const recordKey = dateKey(record.date);
  if (!recordKey) return false;
  const { startKey, endKey } = mainPeriodDateRange();
  if (startKey && recordKey < startKey) return false;
  if (endKey && recordKey > endKey) return false;
  return true;
}

function mainPeriodDateRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mode = state.filters.periodMode;

  if (mode === "custom") {
    return {
      startKey: state.filters.periodStartDate || null,
      endKey: state.filters.periodEndDate || null,
    };
  }

  if (mode === "yesterday") {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const key = dateKey(yesterday);
    return { startKey: key, endKey: key };
  }

  if (mode === "7") {
    return {
      startKey: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)),
      endKey: dateKey(today),
    };
  }

  if (mode === "currentMonth") {
    return {
      startKey: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      endKey: dateKey(today),
    };
  }

  const todayKey = dateKey(today);
  return { startKey: todayKey, endKey: todayKey };
}

function shouldHideCollaboratorMonth(month) {
  return isCollaboratorPage && hiddenCollaboratorMonths.has(Number(month));
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

function todayRecords() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return state.data.records.filter(record => {
    const date = new Date(record.date);
    if (date < start || date >= end) return false;
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
  if (shouldHideCollaboratorMonth(record.month)) return false;
  if (state.filters.account !== "all" && record.account !== state.filters.account) return false;
  if (state.filters.source !== "all" && record.source !== state.filters.source) return false;
  if (state.filters.person !== "all" && record.name !== state.filters.person) return false;
  return true;
}

function sumTotals(records) {
  return records.reduce((acc, record) => {
    const unitQty = recordUnitQty(record);
    acc.total += record.qty;
    if (record.source === "Full") acc.full += record.qty;
    if (record.source === "Tiny") acc.tiny += record.qty;
    acc.totalUnits += unitQty;
    if (record.source === "Full") acc.fullUnits += unitQty;
    if (record.source === "Tiny") acc.tinyUnits += unitQty;
    return acc;
  }, { total: 0, full: 0, tiny: 0, totalUnits: 0, fullUnits: 0, tinyUnits: 0 });
}

function byPerson(records) {
  const map = new Map();
  for (const record of records) {
    if (!map.has(record.name)) {
      map.set(record.name, { name: record.name, total: 0, full: 0, tiny: 0, totalUnits: 0, fullUnits: 0, tinyUnits: 0 });
    }
    const row = map.get(record.name);
    const unitQty = recordUnitQty(record);
    row.total += record.qty;
    row[record.source.toLowerCase()] += record.qty;
    row.totalUnits += unitQty;
    row[`${record.source.toLowerCase()}Units`] += unitQty;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function byMonth(records) {
  const rows = monthNames
    .map((name, idx) => ({ month: idx + 1, name, total: 0, full: 0, tiny: 0, totalUnits: 0, fullUnits: 0, tinyUnits: 0 }))
    .filter(row => !shouldHideCollaboratorMonth(row.month));
  for (const record of records) {
    const row = rows.find(item => item.month === record.month);
    if (!row) continue;
    const unitQty = recordUnitQty(record);
    row.total += record.qty;
    row[record.source.toLowerCase()] += record.qty;
    row.totalUnits += unitQty;
    row[`${record.source.toLowerCase()}Units`] += unitQty;
  }
  return rows;
}

function renderRanking(container, rows) {
  container.innerHTML = rows.length
    ? rows.map((row, idx) => `
        <div class="rank-row">
          <span>${idx + 1}</span>
          <div class="rank-person">
            <b>${escapeHtml(row.name)}</b>
            <small>${volumeSummary(row)}</small>
          </div>
          <div class="rank-score">
            <strong>${fmt(row.total)}</strong>
            <small>pontos</small>
          </div>
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

function renderPackedProductsSummary() {
  if (!els.packedProductsTable) return;

  const records = filteredPackedProductRecords();
  const rows = byPackedProduct(records);
  const totalQty = rows.reduce((acc, row) => acc + row.qty, 0);

  els.packedProductsSubtitle.textContent = `${fmt(totalQty)} produtos - ${packedProductsPeriodLabel()}`;
  els.packedProductsTable.innerHTML = rows.length
    ? rows.map(row => `
      <tr>
        <td><span class="account-pill">${escapeHtml(row.account)}</span></td>
        <td class="sku-cell"><strong>${escapeHtml(row.sku)}</strong></td>
        <td class="product-name-cell">${escapeHtml(row.description || "-")}</td>
        <td class="numeric-cell"><strong>${fmt(row.qty)}</strong></td>
        <td class="numeric-cell">${fmt(row.separations)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5">Sem produtos embalados para os filtros selecionados.</td></tr>`;
}

function filteredPackedProductRecords() {
  const { startKey, endKey } = packedProductsDateRange();
  const records = state.data.productRecords || [];

  return records.filter(record => {
    const recordKey = record.dateKey || dateKey(record.date);
    if (!recordKey) return false;
    if (startKey && recordKey < startKey) return false;
    if (endKey && recordKey > endKey) return false;
    if (state.filters.account !== "all" && record.account !== state.filters.account) return false;
    if (state.filters.person !== "all" && record.name !== state.filters.person) return false;
    return true;
  });
}

function packedProductsDateRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const period = state.filters.packedProductsPeriod;

  if (period === "custom") {
    return {
      startKey: state.filters.packedProductsStartDate || null,
      endKey: state.filters.packedProductsEndDate || null,
    };
  }

  if (period === "7") {
    return {
      startKey: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)),
      endKey: dateKey(today),
    };
  }

  if (period === "30") {
    return {
      startKey: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
      endKey: dateKey(today),
    };
  }

  const todayKey = dateKey(today);
  return { startKey: todayKey, endKey: todayKey };
}

function packedProductsPeriodLabel() {
  const period = state.filters.packedProductsPeriod;
  if (period === "7") return "últimos 7 dias";
  if (period === "30") return "últimos 30 dias";
  if (period === "custom") {
    const start = state.filters.packedProductsStartDate || "início";
    const end = state.filters.packedProductsEndDate || "hoje";
    return `${formatInputDate(start)} a ${formatInputDate(end)}`;
  }
  return "hoje";
}

function byPackedProduct(records) {
  const map = new Map();
  for (const record of records) {
    const key = `${record.account}|||${record.sku}|||${record.description}`;
    if (!map.has(key)) {
      map.set(key, {
        account: record.account,
        sku: record.sku,
        description: record.description,
        qty: 0,
        separationIds: new Set(),
      });
    }

    const row = map.get(key);
    row.qty += record.qty;
    if (record.separationId) row.separationIds.add(record.separationId);
  }

  return [...map.values()]
    .map(row => ({ ...row, separations: row.separationIds.size }))
    .sort((a, b) => b.qty - a.qty || a.account.localeCompare(b.account, "pt-BR") || a.sku.localeCompare(b.sku, "pt-BR", { numeric: true }));
}

function renderPayoutSummary() {
  if (!els.payoutTable || !state.data) return;

  const year = Number(state.filters.payoutYear || new Date().getFullYear());
  const month = Number(state.filters.payoutMonth || new Date().getMonth() + 1);
  const records = state.data.records.filter(record => {
    if (record.year !== year || record.month !== month) return false;
    if (state.filters.account !== "all" && record.account !== state.filters.account) return false;
    if (state.filters.source !== "all" && record.source !== state.filters.source) return false;
    if (state.filters.person !== "all" && record.name !== state.filters.person) return false;
    if (state.filters.payoutPerson !== "all" && record.name !== state.filters.payoutPerson) return false;
    return true;
  });

  const rows = byPerson(records).map(row => ({ ...row, payout: calculatePayout(row.total) }));
  const totalPoints = rows.reduce((acc, row) => acc + row.total, 0);
  const totalFullUnits = rows.reduce((acc, row) => acc + row.fullUnits, 0);
  const totalTinyUnits = rows.reduce((acc, row) => acc + row.tinyUnits, 0);
  const totalAmount = rows.reduce((acc, row) => acc + row.payout.total, 0);

  els.payoutSubtitle.textContent = `${monthNames[month - 1]} ${year}`;
  els.payoutTotalAmount.textContent = formatCurrency(totalAmount);
  els.payoutTotalPoints.textContent = fmtPoints(totalPoints);
  if (els.payoutTotalUnits) els.payoutTotalUnits.textContent = `${fmt(totalFullUnits)} pacotes Full + ${fmt(totalTinyUnits)} pacotes Tiny`;
  els.payoutPeople.textContent = fmt(rows.length);
  els.payoutTable.innerHTML = rows.length
    ? rows.map(row => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td><strong>${fmtPoints(row.total)}</strong></td>
        <td>${fmt(row.fullUnits)}</td>
        <td>${fmt(row.tinyUnits)}</td>
        <td>${formatCurrency(row.payout.tier1)}</td>
        <td>${formatCurrency(row.payout.tier2)}</td>
        <td>${formatCurrency(row.payout.tier3)}</td>
        <td><strong>${formatCurrency(row.payout.total)}</strong></td>
      </tr>
    `).join("")
    : `<tr><td colspan="8">Sem pontos para o mês selecionado.</td></tr>`;
}

function calculatePayout(points) {
  const tier1Points = Math.min(points, 8000);
  const tier2Points = Math.min(Math.max(points - 8000, 0), 4000);
  const tier3Points = Math.max(points - 12000, 0);
  const tier1 = tier1Points * 0.02;
  const tier2 = tier2Points * 0.03;
  const tier3 = tier3Points * 0.04;
  return { tier1, tier2, tier3, total: tier1 + tier2 + tier3 };
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPoints(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
    maximumFractionDigits: 2,
  });
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
        <td>${fmt(row.fullUnits)}</td>
        <td>${fmt(row.tinyUnits)}</td>
        <td>${fullShare}</td>
        <td>${tinyShare}</td>
      </tr>
    `;
    }).join("")
    : `<tr><td colspan="8">Sem pontos no mes anterior.</td></tr>`;
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
        <td>${fmt(row.fullUnits)}</td>
        <td>${fmt(row.tinyUnits)}</td>
        <td>${fullShare}</td>
        <td>${tinyShare}</td>
      </tr>
    `;
  }).join("");
}

function renderMonthDetail() {
  if (!els.monthDetailPanel || !els.monthDetailTable) return;

  if (isCollaboratorPage || !state.selectedMonth) {
    els.monthDetailPanel.hidden = true;
    return;
  }

  const month = state.selectedMonth;
  const records = state.data.records.filter(record => {
    if (record.month !== month) return false;
    if (!matchesMainPeriod(record)) return false;
    if (state.filters.account !== "all" && record.account !== state.filters.account) return false;
    if (state.filters.source !== "all" && record.source !== state.filters.source) return false;
    if (state.filters.person !== "all" && record.name !== state.filters.person) return false;
    return true;
  });

  const rows = byPerson(records);
  const total = rows.reduce((acc, row) => acc + row.total, 0);
  const fullUnits = rows.reduce((acc, row) => acc + row.fullUnits, 0);
  const tinyUnits = rows.reduce((acc, row) => acc + row.tinyUnits, 0);
  els.monthDetailPanel.hidden = false;
  els.monthDetailTitle.textContent = `${monthNames[month - 1]} - total por colaborador`;
  els.monthDetailSubtitle.textContent = `${fmt(total)} pontos - ${fmt(fullUnits)} pacotes Full + ${fmt(tinyUnits)} pacotes Tiny`;
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
          <td>${fmt(row.fullUnits)}</td>
          <td>${fmt(row.tinyUnits)}</td>
          <td>${fullShare}</td>
          <td>${tinyShare}</td>
        </tr>
      `;
    }).join("")
    : `<tr><td colspan="8">Sem pontos neste mes para os filtros atuais.</td></tr>`;
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
  const period = mainPeriodLabel();
  if (period) parts.push(period);
  if (state.filters.account !== "all") parts.push(state.filters.account);
  if (state.filters.source !== "all") parts.push(state.filters.source);
  if (state.filters.person !== "all") parts.push(state.filters.person);
  return parts.length ? parts.join(" · ") : "Todos os dados";
}

function mainPeriodLabel() {
  const mode = state.filters.periodMode;

  if (mode === "yearMonth") {
    const parts = [];
    if (state.filters.year !== "all") parts.push(state.filters.year);
    if (state.filters.month !== "all") parts.push(monthNames[Number(state.filters.month) - 1]);
    return parts.join(" ");
  }

  if (mode === "today") return "Hoje";
  if (mode === "yesterday") return "Ontem";
  if (mode === "7") return "Últimos 7 dias";
  if (mode === "currentMonth") return "Mês atual";

  const start = state.filters.periodStartDate || "início";
  const end = state.filters.periodEndDate || "hoje";
  return `${formatInputDate(start)} a ${formatInputDate(end)}`;
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

function todayLabel() {
  const now = new Date();
  return now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

function tinyUpdatedLabel() {
  const latest = latestTinyRecordDate();
  if (!latest) return "Tiny: nenhum registro importado";
  return `Tiny atualizado ate ${formatDateTime(latest)} (ultimo registro importado)`;
}

function latestTinyRecordDate() {
  const records = state.data?.records || [];
  let latest = null;

  for (const record of records) {
    if (record.source !== "Tiny") continue;
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) continue;
    if (!latest || date > latest) latest = date;
  }

  return latest;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function sheetDateKey(value) {
  const text = clean(value);
  if (!text) return "";

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  return "";
}

function formatInputDate(value) {
  if (!value || value === "início" || value === "hoje") return value;
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function recordUnitQty(record) {
  if (Number.isFinite(Number(record.unitQty))) return Number(record.unitQty);
  return record.source === "Tiny" ? 1 : Number(record.qty || 0);
}

function volumeSummary(row) {
  const parts = [];
  if (row.fullUnits) parts.push(`${fmt(row.fullUnits)} pacotes Full`);
  if (row.tinyUnits) parts.push(`${fmt(row.tinyUnits)} pacotes Tiny`);
  return parts.length ? parts.join(" + ") : "Sem pacotes ou itens";
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
    return dateFromSaoPauloParts(
      Number(br[3]),
      Number(br[2]) - 1,
      Number(br[1]),
      Number(br[4] || 0),
      Number(br[5] || 0),
      Number(br[6] || 0),
    );
  }

  const isoLocal = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoLocal) {
    return dateFromSaoPauloParts(
      Number(isoLocal[1]),
      Number(isoLocal[2]) - 1,
      Number(isoLocal[3]),
      Number(isoLocal[4] || 0),
      Number(isoLocal[5] || 0),
      Number(isoLocal[6] || 0),
    );
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20_000) {
      const utcDate = new Date(Math.round((serial - 25569) * 86400 * 1000));
      return dateFromSaoPauloParts(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth(),
        utcDate.getUTCDate(),
        utcDate.getUTCHours(),
        utcDate.getUTCMinutes(),
        utcDate.getUTCSeconds(),
      );
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateFromSaoPauloParts(year, monthIndex, day, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, monthIndex, day, hour + 3, minute, second));
}

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}












