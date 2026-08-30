/**
 * Downloads and atomically synchronizes the current official PortFIR and Swiss
 * FSVO spreadsheets. The app never scrapes search pages at request time.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-food-catalogs.mjs [--dry-run]
 */
import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import pg from "pg";

const PORTFIR_PAGE = "https://portfir.insa.min-saude.pt/";
const SWISS_PAGES = {
  en: "https://naehrwertdaten.ch/en/downloads/",
  de: "https://naehrwertdaten.ch/de/downloads/",
  fr: "https://naehrwertdaten.ch/fr/telechargement/",
  it: "https://naehrwertdaten.ch/it/downloads/",
};
const PORTFIR_ATTRIBUTION =
  "Fonte: Base de Dados da Composição de Alimentos. Instituto Nacional de Saúde Doutor Ricardo Jorge, I. P. – INSA.";
const SWISS_ATTRIBUTION =
  "Source: Swiss Food Composition Database, Federal Food Safety and Veterinary Office FSVO.";
const dryRun = process.argv.includes("--dry-run");

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cellText(row, column) {
  const value = row.getCell(column).value;
  if (value && typeof value === "object") {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value) return String(value.result ?? "").trim();
  }
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberOrNull(row, column) {
  const raw = row.getCell(column).value;
  const value = typeof raw === "object" && raw && "result" in raw ? raw.result : raw;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

async function officialXlsxUrl(pageUrl) {
  const response = await fetch(pageUrl, {
    headers: { "User-Agent": "Fitlog/0.2 (https://fitlog.site)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Official download page failed (${response.status}).`);
  const html = await response.text();
  const matches = [...html.matchAll(/href=["']([^"']+\.xlsx(?:\?[^"']*)?)["']/gi)];
  if (!matches[0]?.[1]) throw new Error(`No XLSX download found on ${pageUrl}`);
  return new URL(matches[0][1].replace(/&amp;/g, "&"), pageUrl).toString();
}

async function downloadWorkbook(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Fitlog/0.2 (https://fitlog.site)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Official spreadsheet failed (${response.status}).`);
  return parseWorkbook(new Uint8Array(await response.arrayBuffer()));
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
});
const decoder = new TextDecoder();

function list(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function xmlFile(files, path) {
  const bytes = files[path];
  if (!bytes) throw new Error(`XLSX archive is missing ${path}`);
  return xmlParser.parse(decoder.decode(bytes));
}

function xmlText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value["#text"] === "string") return value["#text"];
  return "";
}

function sharedString(item) {
  const direct = xmlText(item?.t);
  if (direct) return direct;
  return list(item?.r)
    .map((part) => xmlText(part?.t))
    .join("");
}

function columnNumber(reference) {
  const letters = String(reference ?? "").match(/^[A-Z]+/i)?.[0] ?? "";
  return [...letters.toUpperCase()].reduce(
    (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
    0
  );
}

function worksheet(files, path, name, sharedStrings) {
  const document = xmlFile(files, path);
  const rows = new Map();
  for (const xmlRow of list(document.worksheet?.sheetData?.row)) {
    const cells = new Map();
    for (const cell of list(xmlRow.c)) {
      const column = columnNumber(cell.r);
      let value = cell.v ?? "";
      if (cell.t === "s") value = sharedStrings[Number(value)] ?? "";
      else if (cell.t === "inlineStr") value = sharedString(cell.is);
      cells.set(column, value);
    }
    const number = Number(xmlRow.r);
    const row = {
      getCell(column) {
        return { value: cells.get(column) ?? null };
      },
      eachCell(callback) {
        for (const [column, value] of cells) callback({ value }, column);
      },
    };
    rows.set(number, row);
  }
  return {
    name,
    getRow(number) {
      return rows.get(number) ?? {
        getCell: () => ({ value: null }),
        eachCell: () => {},
      };
    },
    eachRow(callback) {
      for (const [number, row] of rows) callback(row, number);
    },
  };
}

function parseWorkbook(bytes) {
  const files = unzipSync(bytes);
  const sharedDocument = files["xl/sharedStrings.xml"]
    ? xmlFile(files, "xl/sharedStrings.xml")
    : { sst: { si: [] } };
  const sharedStrings = list(sharedDocument.sst?.si).map(sharedString);
  const workbookDocument = xmlFile(files, "xl/workbook.xml");
  const relationshipDocument = xmlFile(files, "xl/_rels/workbook.xml.rels");
  const targets = new Map(
    list(relationshipDocument.Relationships?.Relationship).map((relationship) => [
      relationship.Id,
      String(relationship.Target).replace(/^\/?xl\//, ""),
    ])
  );
  const worksheets = list(workbookDocument.workbook?.sheets?.sheet).map((sheet) => {
    const target = targets.get(sheet.id);
    if (!target) throw new Error(`XLSX relationship is missing for ${sheet.name}`);
    return worksheet(files, `xl/${target}`, sheet.name, sharedStrings);
  });
  return { worksheets };
}

function portfirItems(workbook, sourceUrl) {
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("PortFIR spreadsheet has no data sheet.");
  const version = sheet.name.replace(/^.*?(v\s*[\d.]+\s*-\s*\d{4}).*$/i, "$1").trim();
  const items = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    const providerId = cellText(row, 1);
    const name = cellText(row, 2);
    if (!providerId || !name) return;
    const level1 = cellText(row, 3);
    const category = [level1, cellText(row, 4), cellText(row, 5)]
      .filter(Boolean)
      .join(" / ");
    const isAlcoholicBeverage = normalizeText(level1).startsWith("bebidas alcoolicas");
    items.push({
      provider: "portfir",
      providerId,
      countryCode: "PT",
      category: category || null,
      basisQuantity: 100,
      basisUnit: isAlcoholicBeverage ? "ml" : "g",
      caloriesKcal: numberOrNull(row, 6),
      proteinG: numberOrNull(row, 20),
      carbsG: numberOrNull(row, 14),
      fatG: numberOrNull(row, 8),
      fiberG: numberOrNull(row, 19),
      sugarG: numberOrNull(row, 15),
      saturatedFatG: numberOrNull(row, 9),
      saltG: numberOrNull(row, 18),
      sodiumMg: null,
      sourceVersion: version,
      sourceUrl,
      attribution: `${PORTFIR_ATTRIBUTION} ${version}.`,
      names: [
        {
          language: "pt",
          name,
          synonyms: null,
          searchText: normalizeText(`${name} ${category}`),
        },
      ],
    });
  });
  if (items.length < 1_200) throw new Error("PortFIR spreadsheet appears incomplete.");
  return items;
}

function headerMap(sheet) {
  const map = new Map();
  sheet.getRow(3).eachCell((cell, column) => {
    map.set(normalizeText(cellText(sheet.getRow(3), column)), column);
  });
  return map;
}

function headerColumn(headers, label) {
  const column = headers.get(normalizeText(label));
  if (!column) throw new Error(`Swiss spreadsheet is missing column: ${label}`);
  return column;
}

function swissRows(workbook, language) {
  const rows = new Map();
  for (const [sheetIndex, kind] of [[0, "generic"], [1, "branded"]]) {
    const sheet = workbook.worksheets[sheetIndex];
    if (!sheet) continue;
    // These identity columns are structurally fixed across the four localized
    // official workbooks even though their header labels are translated.
    const idColumn = 1;
    const nameColumn = 4;
    const synonymColumn = 5;
    const categoryColumn = 6;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) return;
      const id = cellText(row, idColumn);
      const name = cellText(row, nameColumn);
      if (!id || !name) return;
      const category = cellText(row, categoryColumn);
      const synonyms = cellText(row, synonymColumn) || null;
      rows.set(`${kind}:${id}`, {
        name,
        synonyms,
        category: category || null,
        searchText: normalizeText(`${name} ${synonyms ?? ""} ${category}`),
        language,
      });
    });
  }
  return rows;
}

function swissItems(workbooks, sourceUrl) {
  const englishWorkbook = workbooks.en;
  const localized = Object.fromEntries(
    Object.entries(workbooks).map(([language, workbook]) => [
      language,
      swissRows(workbook, language),
    ])
  );
  const versionTitle = cellText(englishWorkbook.worksheets[0].getRow(1), 1);
  const version = versionTitle.match(/V\s*[\d.]+\s*\([^)]*\)/i)?.[0] ?? versionTitle;
  const items = [];
  for (const [sheetIndex, kind] of [[0, "generic"], [1, "branded"]]) {
    const sheet = englishWorkbook.worksheets[sheetIndex];
    if (!sheet) continue;
    const headers = headerMap(sheet);
    const columns = {
      id: headerColumn(headers, "ID"),
      name: headerColumn(headers, "Name"),
      category: headerColumn(headers, "Category"),
      matrix: headerColumn(headers, "Matrix unit"),
      calories: headerColumn(headers, "Energy, kilocalories (kcal)"),
      protein: headerColumn(headers, "Protein (g)"),
      carbs: headerColumn(headers, "Carbohydrates, available (g)"),
      fat: headerColumn(headers, "Fat, total (g)"),
      fiber: headerColumn(headers, "Dietary fibres (g)"),
      sugar: headerColumn(headers, "Sugars (g)"),
      saturatedFat: headerColumn(headers, "Fatty acids, saturated (g)"),
      salt: headerColumn(headers, "Salt (NaCl) (g)"),
      sodium: headerColumn(headers, "Sodium (Na) (mg)"),
    };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) return;
      const id = cellText(row, columns.id);
      const englishName = cellText(row, columns.name);
      if (!id || !englishName) return;
      const providerId = `${kind}:${id}`;
      const matrix = normalizeText(cellText(row, columns.matrix));
      const names = Object.values(localized)
        .map((byId) => byId.get(providerId))
        .filter(Boolean);
      items.push({
        provider: "swiss",
        providerId,
        countryCode: "CH",
        category: cellText(row, columns.category) || null,
        basisQuantity: 100,
        basisUnit: matrix.includes("100ml") ? "ml" : "g",
        caloriesKcal: numberOrNull(row, columns.calories),
        proteinG: numberOrNull(row, columns.protein),
        carbsG: numberOrNull(row, columns.carbs),
        fatG: numberOrNull(row, columns.fat),
        fiberG: numberOrNull(row, columns.fiber),
        sugarG: numberOrNull(row, columns.sugar),
        saturatedFatG: numberOrNull(row, columns.saturatedFat),
        saltG: numberOrNull(row, columns.salt),
        sodiumMg: numberOrNull(row, columns.sodium),
        sourceVersion: version,
        sourceUrl,
        attribution: `${SWISS_ATTRIBUTION} ${version}.`,
        names,
      });
    });
  }
  if (items.length < 1_200) throw new Error("Swiss spreadsheet appears incomplete.");
  const incomplete = items.filter((item) => item.names.length < 4);
  if (incomplete.length > 0) {
    throw new Error(
      `Swiss localized spreadsheets could not be matched safely ` +
        `(${incomplete.length} incomplete; first ${incomplete[0].providerId} has ` +
        `${incomplete[0].names.length} languages).`
    );
  }
  return items;
}

async function replaceProvider(client, provider, items) {
  const payload = JSON.stringify(items);
  await client.query(
    `WITH incoming AS (
       SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
         "provider" text, "providerId" text, "countryCode" text, "category" text,
         "basisQuantity" real, "basisUnit" text, "caloriesKcal" real,
         "proteinG" real, "carbsG" real, "fatG" real, "fiberG" real,
         "sugarG" real, "saturatedFatG" real, "saltG" real, "sodiumMg" real,
         "sourceVersion" text, "sourceUrl" text, "attribution" text, "names" jsonb
       )
     )
     INSERT INTO food_catalog_items (
       provider, provider_id, country_code, category, basis_quantity, basis_unit,
       calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
       saturated_fat_g, salt_g, sodium_mg, source_version, source_url,
       attribution, imported_at
     )
     SELECT "provider", "providerId", "countryCode", "category", "basisQuantity",
       "basisUnit", "caloriesKcal", "proteinG", "carbsG", "fatG", "fiberG",
       "sugarG", "saturatedFatG", "saltG", "sodiumMg", "sourceVersion",
       "sourceUrl", "attribution", now()
     FROM incoming
     ON CONFLICT (provider, provider_id) DO UPDATE SET
       country_code = excluded.country_code, category = excluded.category,
       basis_quantity = excluded.basis_quantity, basis_unit = excluded.basis_unit,
       calories_kcal = excluded.calories_kcal, protein_g = excluded.protein_g,
       carbs_g = excluded.carbs_g, fat_g = excluded.fat_g, fiber_g = excluded.fiber_g,
       sugar_g = excluded.sugar_g, saturated_fat_g = excluded.saturated_fat_g,
       salt_g = excluded.salt_g, sodium_mg = excluded.sodium_mg,
       source_version = excluded.source_version, source_url = excluded.source_url,
       attribution = excluded.attribution, imported_at = now()`,
    [payload]
  );
  await client.query(
    `DELETE FROM food_catalog_names
     WHERE food_id IN (SELECT id FROM food_catalog_items WHERE provider = $1)`,
    [provider]
  );
  await client.query(
    `WITH incoming AS (
       SELECT "providerId" FROM jsonb_to_recordset($1::jsonb)
         AS x("providerId" text)
     )
     DELETE FROM food_catalog_items
     WHERE provider = $2
       AND provider_id NOT IN (SELECT "providerId" FROM incoming)`,
    [payload, provider]
  );
  await client.query(
    `WITH incoming AS (
       SELECT * FROM jsonb_to_recordset($1::jsonb)
         AS x("providerId" text, "names" jsonb)
     ), expanded AS (
       SELECT i."providerId", n.*
       FROM incoming i
       CROSS JOIN LATERAL jsonb_to_recordset(i."names")
         AS n("language" text, "name" text, "synonyms" text, "searchText" text)
     )
     INSERT INTO food_catalog_names (food_id, language, name, synonyms, search_text)
     SELECT f.id, e."language", e."name", e."synonyms", e."searchText"
     FROM expanded e
     JOIN food_catalog_items f
       ON f.provider = $2 AND f.provider_id = e."providerId"`,
    [payload, provider]
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("Set DATABASE_URL (or POSTGRES_URL) first.");

  const portfirUrl = await officialXlsxUrl(PORTFIR_PAGE);
  const swissUrls = Object.fromEntries(
    await Promise.all(
      Object.entries(SWISS_PAGES).map(async ([language, page]) => [
        language,
        await officialXlsxUrl(page),
      ])
    )
  );
  const [portfirWorkbook, ...swissWorkbookList] = await Promise.all([
    downloadWorkbook(portfirUrl),
    ...Object.values(swissUrls).map(downloadWorkbook),
  ]);
  const swissWorkbooks = Object.fromEntries(
    Object.keys(swissUrls).map((language, index) => [language, swissWorkbookList[index]])
  );
  const catalogs = {
    portfir: portfirItems(portfirWorkbook, portfirUrl),
    swiss: swissItems(swissWorkbooks, SWISS_PAGES.en),
  };

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await replaceProvider(client, "portfir", catalogs.portfir);
    await replaceProvider(client, "swiss", catalogs.swiss);
    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  console.log(
    `${dryRun ? "Validated" : "Synced"} ${catalogs.portfir.length} PortFIR and ` +
      `${catalogs.swiss.length} Swiss official foods${dryRun ? " (rolled back)" : ""}.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
