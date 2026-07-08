const employees = ["Livia", "Jean", "Gabi", "Ana"];
const fixedReserve = "Pedro";
const shops = ["Shopee 1", "Shopee 2", "Shopee 3"];
const baseDate = "2026-07-08";
const actualSchedules = {
  "2026-07-08": {
    "Shopee 1": ["Gabi"],
    "Shopee 2": ["Pedro"],
    "Shopee 3": ["Livia", "Jean", "Ana"],
    Reserva: []
  }
};

const permutations = allPermutations(employees);
let holidays = ["2026-07-09"];

const els = {
  subtitle: document.querySelector("#rodizioNextSubtitle"),
  table: document.querySelector("#rodizioNextTable"),
};

init();

async function init() {
  await loadHolidays();
  renderNextDays();
}

async function loadHolidays() {
  try {
    const response = await fetch("/api/rodizio-feriados");
    if (!response.ok) throw new Error("api indisponivel");
    const data = await response.json();
    if (Array.isArray(data.holidays)) holidays = data.holidays;
  } catch {
    holidays = ["2026-07-09"];
  }
}

function renderNextDays() {
  const start = normalizeBusinessDay(localDateString());
  const rows = [];
  let date = start;

  for (let index = 0; index < 15; index += 1) {
    const schedule = scheduleForDate(date);
    rows.push({ date, schedule });
    date = nextBusinessDay(date);
  }

  els.subtitle.textContent = `A partir de ${formatLongDate(start)}.`;
  els.table.innerHTML = rows.map(row => `
    <tr>
      <td><strong>${formatShortDate(row.date)}</strong></td>
      <td>${escapeHtml(formatPeople(row.schedule["Shopee 1"]))}</td>
      <td>${escapeHtml(formatPeople(row.schedule["Shopee 2"]))}</td>
      <td>${escapeHtml(formatPeople(row.schedule["Shopee 3"]))}</td>
      <td>${escapeHtml(formatPeople(row.schedule.Reserva))}</td>
      <td>${escapeHtml(fixedReserve)}</td>
    </tr>
  `).join("");
}

function localDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value, amount) {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return localDateString(date);
}

function isWeekend(value) {
  const day = parseDate(value).getDay();
  return day === 0 || day === 6;
}

function isHeavyDay(value) {
  const day = parseDate(value).getDay();
  return day === 1 || day === 2;
}

function isOffDay(value) {
  return isWeekend(value) || holidays.includes(value);
}

function nextBusinessDay(value) {
  let date = addDays(value, 1);
  while (isOffDay(date)) date = addDays(date, 1);
  return date;
}

function normalizeBusinessDay(value) {
  let date = value;
  while (isOffDay(date)) date = nextBusinessDay(date);
  return date;
}

function dayIndex(value) {
  const start = parseDate(baseDate) <= parseDate(value) ? baseDate : value;
  const end = parseDate(baseDate) <= parseDate(value) ? value : baseDate;
  let cursor = start;
  let count = 0;

  while (cursor !== end) {
    cursor = addDays(cursor, 1);
    if (!isOffDay(cursor)) count += 1;
  }

  return start === baseDate ? count : -count;
}

function allPermutations(items) {
  if (items.length === 1) return [items];
  const result = [];
  items.forEach((item, index) => {
    const rest = items.slice(0, index).concat(items.slice(index + 1));
    allPermutations(rest).forEach(permutation => {
      result.push([item].concat(permutation));
    });
  });
  return result;
}

function peopleFor(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function formatPeople(value) {
  const people = peopleFor(value);
  if (!people.length) return "-";
  if (people.length === 1) return people[0];
  return `${people.slice(0, -1).join(", ")} e ${people[people.length - 1]}`;
}

function addScheduleCounts(counts, schedule, date) {
  Object.entries(schedule).forEach(([position, value]) => {
    peopleFor(value).forEach(employee => {
      if (counts[employee] && counts[employee][position] !== undefined) {
        counts[employee][position] += 1;
        if (isHeavyDay(date) && shops.includes(position)) counts[employee].DiaForte += 1;
      }
    });
  });
}

function buildScheduleUntil(targetIndex) {
  const counts = {};
  employees.forEach(employee => {
    counts[employee] = { "Shopee 1": 0, "Shopee 2": 0, "Shopee 3": 0, Reserva: 0, DiaForte: 0 };
  });

  let previous = null;
  const schedules = [];
  const totalDays = Math.max(0, targetIndex);
  let currentDate = baseDate;

  for (let day = 0; day <= totalDays; day += 1) {
    let best = null;

    if (actualSchedules[currentDate]) {
      best = actualSchedules[currentDate];
    } else {
      let bestScore = Infinity;

      permutations.forEach((candidate, candidateIndex) => {
        const positions = {
          "Shopee 1": candidate[0],
          "Shopee 2": candidate[1],
          "Shopee 3": candidate[2],
          Reserva: candidate[3]
        };

        let score = 0;
        Object.entries(positions).forEach(([position, employee]) => {
          score += Math.pow(counts[employee][position] + 1, 2) * 18;
          if (previous && peopleFor(previous[position]).includes(employee)) score += 1000;
          if (isHeavyDay(currentDate) && shops.includes(position)) {
            score += Math.pow(counts[employee].DiaForte + 1, 2) * 35;
          }
        });

        if (previous && peopleFor(previous.Reserva).includes(positions.Reserva)) score += 1400;
        score += ((candidateIndex + day * 7) % 11) / 100;

        if (score < bestScore) {
          bestScore = score;
          best = positions;
        }
      });
    }

    addScheduleCounts(counts, best, currentDate);
    schedules.push(best);
    previous = best;
    currentDate = nextBusinessDay(currentDate);
  }

  return schedules[targetIndex] || schedules[0];
}

function scheduleForDate(value) {
  const index = dayIndex(value);
  if (index >= 0) return buildScheduleUntil(index);

  const shifted = ((index % permutations.length) + permutations.length) % permutations.length;
  const candidate = permutations[shifted];
  return {
    "Shopee 1": candidate[0],
    "Shopee 2": candidate[1],
    "Shopee 3": candidate[2],
    Reserva: candidate[3]
  };
}

function formatShortDate(value) {
  return parseDate(value).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatLongDate(value) {
  return parseDate(value).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
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
