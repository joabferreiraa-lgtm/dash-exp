import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const configPath = path.join(__dirname, "config.json");

const env = globalThis.process?.env || {};
const PORT = Number(env.PORT || 4280);
const SPREADSHEET_ID = env.SHEET_ID || "1bS2iqiMXsXxBXpTkHYW2q2d0pM7smxfhD6e3gWtYRUo";
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "";
const SHEETS = {
  full: "FULL",
  tinyRaw: "Tiny_raw",
  usuarios: "usuarios",
};
const SAO_PAULO_UTC_OFFSET_HOURS = 3;

let cache = null;
let cacheAt = 0;
const CACHE_MS = 45_000;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/data") {
      const force = url.searchParams.get("refresh") === "1";
      const data = await getDashboardData(force);
      sendJson(res, data);
      return;
    }

    if (url.pathname === "/api/config") {
      const config = await readConfig();
      sendJson(res, {
        fullEntryConfigured: Boolean(config.fullEntryWebAppUrl),
        fullEntryWebAppUrl: config.fullEntryWebAppUrl || ""
      });
      return;
    }

    if (url.pathname === "/api/full-recent") {
      const entries = await getRecentFullEntries();
      sendJson(res, { entries });
      return;
    }

    if (url.pathname === "/api/full-entry" && req.method === "POST") {
      const config = await readConfig();
      if (!config.fullEntryWebAppUrl) {
        sendJson(res, { ok: false, error: "Configure fullEntryWebAppUrl em dashboard/config.json." }, 400);
        return;
      }

      const payload = await readRequestJson(req);
      const response = await fetch(config.fullEntryWebAppUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await response.text();

      try {
        const result = JSON.parse(text);
        if (result.ok && (!result.row || typeof result.qtdTotal === "undefined")) {
          sendJson(res, {
            ok: false,
            error: `O Web App respondeu sem confirmar a linha inserida. Versão recebida: ${result.version || "sem versão"}. Confira se existe só uma função doPost(e) e reimplante o Apps Script com full_entry_webapp.gs v3.`,
            raw: result,
          }, 502);
          return;
        }
        sendJson(res, result, response.ok ? 200 : response.status);
      } catch {
        const looksLikeDriveError = text.includes("Google Drive") || text.includes("Não foi possível abrir");
        sendJson(res, {
          ok: false,
          error: looksLikeDriveError
            ? "A URL configurada não está abrindo o Web App. Copie novamente a URL /exec da implantação que funcionou no navegador."
            : "O Web App retornou uma resposta que não é JSON.",
          raw: text.slice(0, 500)
        }, response.ok ? 502 : response.status);
      }
      return;
    }

    if ((url.pathname === "/admin" || url.pathname === "/admin.html") && !isAdminAuthorized(req)) {
      requestAdminPassword(res);
      return;
    }

    const filePath = url.pathname === "/admin" ? "/admin.html" : (url.pathname === "/" ? "/index.html" : url.pathname);
    await serveStatic(res, filePath);
  } catch (error) {
    sendJson(res, { error: error.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Dashboard rodando em http://localhost:${PORT}`);
});

function isAdminAuthorized(req) {
  if (!ADMIN_PASSWORD) return true;

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    const password = separator >= 0 ? decoded.slice(separator + 1) : "";
    return password === ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

function requestAdminPassword(res) {
  res.writeHead(401, {
    "www-authenticate": 'Basic realm="Admin Dashboard", charset="UTF-8"',
    "content-type": "text/plain; charset=utf-8",
  });
  res.end("Senha necessaria para acessar o admin.");
}

async function getDashboardData(force = false) {
  if (!force && cache && Date.now() - cacheAt < CACHE_MS) return cache;

  const [fullRows, tinyRows, usuariosRows] = await Promise.all([
    fetchSheet(SHEETS.full),
    fetchSheet(SHEETS.tinyRaw),
    fetchSheet(SHEETS.usuarios),
  ]);

  const usuarios = buildUsuariosMap(usuariosRows);
  const records = [
    ...recordsFromFull(fullRows),
    ...recordsFromTinyRaw(tinyRows, usuarios),
  ];

  const years = [...new Set(records.map(r => r.year).filter(Boolean))].sort((a, b) => b - a);
  const accounts = [...new Set(records.map(r => r.account).filter(Boolean))].sort();
  const people = [...new Set(records.map(r => r.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const updatedAt = new Date().toISOString();

  cache = { updatedAt, records, years, accounts, people, counts: { fullRows: fullRows.length, tinyRows: tinyRows.length } };
  cacheAt = Date.now();
  return cache;
}

async function readConfig() {
  if (env.FULL_ENTRY_WEB_APP_URL) {
    return { fullEntryWebAppUrl: env.FULL_ENTRY_WEB_APP_URL };
  }

  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    return { fullEntryWebAppUrl: "" };
  }
}

async function getRecentFullEntries() {
  const rows = await fetchSheet(SHEETS.full);
  return rows
    .slice(1)
    .map((row, index) => {
      const date = toDate(row[8]);
      return {
        rowNumber: index + 2,
        name: clean(row[0]),
        qtd: toNumber(row[1]),
        sku: clean(row[2]),
        loja: clean(row[3]),
        envio: clean(row[4]),
        obs: clean(row[5]),
        qtdItens: toNumber(row[6]),
        qtdTotal: fullItemsQty(row),
        date: date ? date.toISOString() : "",
      };
    })
    .filter(entry => entry.name || entry.sku || entry.envio)
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return b.rowNumber - a.rowNumber;
    })
    .slice(0, 10);
}

async function readRequestJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não consegui ler a aba ${sheetName}: HTTP ${response.status}`);
  }
  const csv = await response.text();
  return parseCsv(csv);
}

function recordsFromFull(rows) {
  const data = rows.slice(1);
  return data.map(row => {
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
  const data = rows.slice(1);
  return data.map(row => {
    const id = clean(row[4]);
    const name = clean(usuarios[id] || row[5]);
    const qty = toNumber(row[13]) || toNumber(row[10]);
    const account = clean(row[12] || "CONTA1");
    const date = toDate(row[3] || row[1] || row[2]);
    if (!name || !qty || !date) return null;
    return {
      source: "Tiny",
      account,
      name,
      qty,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      date: date.toISOString(),
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
  if (typeof value === "number") return value;
  const text = clean(value).replace(/\./g, "").replace(",", ".");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value)) return value;

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
  return new Date(Date.UTC(year, monthIndex, day, hour + SAO_PAULO_UTC_OFFSET_HOURS, minute, second));
}

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

async function serveStatic(res, requestPath) {
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(publicDir, safePath);
  if (!fullPath.startsWith(publicDir)) throw new Error("Caminho inválido.");

  const body = await readFile(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const type = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
  }[ext] || "application/octet-stream";

  res.writeHead(200, {
    "content-type": type,
    "cache-control": ext === ".html" ? "no-cache" : "public, max-age=300",
  });
  res.end(body);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}
