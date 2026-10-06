// Małe, czyste parsery feedów (CSV / XML / liczby). Bez zależności zewnętrznych.
//
// Ograniczenia parseXmlItems: prosty parser regexowy (bez DOM) — obsługuje płaskie rekordy
// <item><sku>..</sku><name>..</name></item> z CDATA i encjami; NIE obsługuje zagnieżdżonych
// powtarzalnych struktur, przestrzeni nazw (prefiksy są usuwane) ani atrybutów elementów.
// TODO: dla feedów > 50k pozycji potrzebny parser strumieniowy (np. SAX przez ReadableStream).

export type CsvRow = Record<string, string>;

/** Parsuje CSV z nagłówkiem. Obsługuje cudzysłowy, podwojone cudzysłowy, \r\n. */
export function parseCsv(text: string, delimiter = ";"): CsvRow[] {
  const records = splitCsvRecords(text.replace(/^﻿/, ""), delimiter);
  if (records.length === 0) return [];
  const header = records[0].map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const fields = records[i];
    if (fields.length === 1 && fields[0].trim() === "") continue; // pusta linia
    const row: CsvRow = {};
    header.forEach((name, idx) => {
      if (name) row[name] = (fields[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      fields.push(field);
      records.push(fields);
      fields = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || fields.length > 0) {
    fields.push(field);
    records.push(fields);
  }
  return records;
}

export type XmlRow = Record<string, string>;

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wyciąga płaskie rekordy z XML: każdy <itemTag> → obiekt { nazwaElementu: tekst }.
 * Powtórzone elementy potomne są łączone separatorem " | ". Prefiksy przestrzeni nazw są usuwane.
 */
export function parseXmlItems(text: string, itemTag: string): XmlRow[] {
  const tag = escapeRegExp(itemTag);
  const itemRe = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "g");
  const childRe = /<([A-Za-z_][\w.:-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<([A-Za-z_][\w.:-]*)(?:\s[^>]*)?\/>/g;
  const rows: XmlRow[] = [];

  for (const itemMatch of text.matchAll(itemRe)) {
    const inner = itemMatch[1];
    const row: XmlRow = {};
    for (const child of inner.matchAll(childRe)) {
      const rawName = child[1] ?? child[3];
      if (!rawName) continue;
      const name = rawName.includes(":") ? rawName.slice(rawName.indexOf(":") + 1) : rawName;
      let value = child[2] ?? "";
      const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(value);
      value = cdata ? cdata[1] : decodeXmlEntities(value.replace(/<[^>]+>/g, " "));
      value = value.trim();
      row[name] = name in row ? `${row[name]} | ${value}` : value;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Kwota tekstowa → grosze: "1 234,56" → 123456, "1234.56" → 123456, "1,234.56" → 123456.
 * Gdy występuje tylko jeden separator, traktujemy go jako dziesiętny. null gdy nie da się sparsować.
 */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }
  let s = value.replace(/[\s ]/g, "").replace(/(zł|pln|eur|€)/gi, "").trim();
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const decimalIsComma = s.lastIndexOf(",") > s.lastIndexOf(".");
    s = decimalIsComma ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Bezpieczne parsowanie liczby całkowitej ("12", "12.0", " 7 szt.") → 12; null gdy brak liczby. */
export function parseIntSafe(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  const match = /-?\d+/.exec(value.replace(/[\s ]/g, ""));
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) ? n : null;
}

/** Dzieli ścieżkę kategorii "A > B / C" na elementy. */
export function splitCategoryPath(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/\s*(?:>|\/|\||»)\s*/).map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Dzieli listę URL-i ("a.jpg, b.jpg" / "a.jpg|b.jpg"). */
export function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/\s*[,|;]\s*/).map((v) => v.trim()).filter((v) => v.length > 0);
}
