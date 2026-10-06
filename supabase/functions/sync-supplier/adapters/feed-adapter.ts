// Generyczny szkielet adaptera feedu HTTP (CSV / XML / JSON z basic auth).
// Prawdziwe hurtownie (iglocar, autoklima, kaisai, termosilesia, sinclair) używają go
// z własną mapą pól. Nazwy pól są PLACEHOLDERAMI do czasu uzupełnienia docs/suppliers/<code>.md.

import { NotConfiguredError, type SupplierAdapter, type SupplierOfferRaw } from "./types.ts";
import { parseCsv, parseIntSafe, parseXmlItems, splitCategoryPath, splitList, toCents } from "../parsers.ts";

export type FeedFormat = "csv" | "xml" | "json";

/** Mapa: nasze pole → nazwa kolumny / elementu / klucza w feedzie hurtowni. */
export interface FeedFieldMap {
  supplierSku: string;
  ean?: string;
  name: string;
  brand?: string;
  /** pojedyncze pole ze ścieżką ("A > B") albo lista pól poziomów */
  category?: string | string[];
  purchaseNet: string;
  stock?: string;
  leadTimeDays?: string;
  images?: string;
  /** pola, które trafiają do attributes (nazwa w feedzie → etykieta) */
  attributes?: Record<string, string>;
  /** pola z dokumentami: nazwa w feedzie → etykieta dokumentu */
  documents?: Record<string, string>;
}

export interface FeedAdapterOptions {
  code: string;
  supplierName: string;
  fieldMap: FeedFieldMap;
  /** nazwa elementu rekordu w XML (np. "product", "item", "offer") */
  xmlItemTag?: string;
  /** separator CSV (domyślnie ";") */
  csvDelimiter?: string;
  /** klucze w JSON, pod którymi może być tablica rekordów */
  jsonRootKeys?: string[];
  /** cena w feedzie jest brutto → przelicz na netto wg stawki (np. 23) */
  priceIsGrossVatRate?: number;
}

export interface ResolvedFeedConfig {
  url: string | null;
  login: string | null;
  password: string | null;
  format: FeedFormat | null;
  /** pozostałe klucze z feed_config (np. token, nagłówki) */
  extra: Record<string, string>;
}

/** feed_config z bazy + zmienne SUPPLIER_<CODE>_URL / _LOGIN / _PASSWORD / _FORMAT (env ma niższy priorytet). */
export function resolveFeedConfig(code: string, config: Record<string, string>): ResolvedFeedConfig {
  const prefix = `SUPPLIER_${code.toUpperCase()}_`;
  const pick = (key: string): string | null => {
    const fromConfig = config[key] ?? config[key.toLowerCase()];
    if (fromConfig && fromConfig.trim()) return fromConfig.trim();
    const fromEnv = Deno.env.get(`${prefix}${key.toUpperCase()}`);
    return fromEnv && fromEnv.trim() ? fromEnv.trim() : null;
  };
  const formatRaw = pick("format")?.toLowerCase() ?? null;
  const format: FeedFormat | null = formatRaw === "csv" || formatRaw === "xml" || formatRaw === "json"
    ? formatRaw
    : null;
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (!["url", "login", "password", "format"].includes(k.toLowerCase())) extra[k] = v;
  }
  return { url: pick("url"), login: pick("login"), password: pick("password"), format, extra };
}

function detectFormat(url: string, contentType: string | null, configured: FeedFormat | null): FeedFormat {
  if (configured) return configured;
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("json")) return "json";
  if (ct.includes("xml")) return "xml";
  if (ct.includes("csv") || ct.includes("text/plain")) return "csv";
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".xml")) return "xml";
  if (path.endsWith(".csv") || path.endsWith(".txt")) return "csv";
  return "json";
}

/** Pobiera feed (basic auth gdy login+hasło). Timeout 120 s. */
export async function fetchFeedText(cfg: ResolvedFeedConfig): Promise<{ text: string; contentType: string | null }> {
  if (!cfg.url) throw new Error("brak URL feedu");
  const headers: Record<string, string> = { "Accept": "application/json, text/xml, application/xml, text/csv, */*" };
  if (cfg.login && cfg.password) {
    headers["Authorization"] = `Basic ${btoa(`${cfg.login}:${cfg.password}`)}`;
  } else if (cfg.extra.token) {
    headers["Authorization"] = `Bearer ${cfg.extra.token}`;
  }
  const res = await fetch(cfg.url, { headers, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    throw new Error(`feed HTTP ${res.status} ${res.statusText}`);
  }
  // TODO: dla feedów > 50k pozycji zamiast res.text() czytać res.body strumieniowo
  // i parsować rekord po rekordzie (CSV po liniach, XML przez SAX), upsertując paczkami.
  return { text: await res.text(), contentType: res.headers.get("content-type") };
}

type Rec = Record<string, unknown>;

function asRecords(value: unknown, rootKeys: string[]): Rec[] {
  if (Array.isArray(value)) return value.filter((v): v is Rec => typeof v === "object" && v !== null);
  if (typeof value === "object" && value !== null) {
    const obj = value as Rec;
    for (const key of rootKeys) {
      const inner = obj[key];
      if (Array.isArray(inner)) return asRecords(inner, rootKeys);
    }
  }
  return [];
}

/** Parsuje tekst feedu do płaskich rekordów (unknown → walidacja zod później w orchestratorze). */
export function parseFeedText(text: string, format: FeedFormat, opts: FeedAdapterOptions): Rec[] {
  switch (format) {
    case "csv":
      return parseCsv(text, opts.csvDelimiter ?? ";");
    case "xml":
      return parseXmlItems(text, opts.xmlItemTag ?? "item");
    case "json": {
      const json: unknown = JSON.parse(text);
      return asRecords(json, opts.jsonRootKeys ?? ["items", "products", "data", "offers", "rows"]);
    }
  }
}

function str(rec: Rec, field: string | undefined): string | undefined {
  if (!field) return undefined;
  const v = rec[field];
  if (v === null || v === undefined) return undefined;
  const s = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : undefined;
  return s !== undefined && s.trim() !== "" ? s.trim() : undefined;
}

function num(rec: Rec, field: string | undefined): string | number | undefined {
  if (!field) return undefined;
  const v = rec[field];
  return typeof v === "number" || typeof v === "string" ? v : undefined;
}

/** Mapuje jeden rekord feedu na SupplierOfferRaw wg mapy pól. Niekompletne pola → zod odrzuci rekord. */
export function mapRecord(rec: Rec, opts: FeedAdapterOptions): SupplierOfferRaw {
  const fm = opts.fieldMap;

  let purchaseNetCents = toCents(num(rec, fm.purchaseNet) ?? null);
  if (purchaseNetCents !== null && opts.priceIsGrossVatRate) {
    purchaseNetCents = Math.round(purchaseNetCents / (1 + opts.priceIsGrossVatRate / 100));
  }

  let categoryPath: string[] | undefined;
  if (Array.isArray(fm.category)) {
    categoryPath = fm.category.map((f) => str(rec, f)).filter((v): v is string => Boolean(v));
  } else if (fm.category) {
    categoryPath = splitCategoryPath(str(rec, fm.category));
  }

  const attributes: Record<string, string | number> = {};
  for (const [field, label] of Object.entries(fm.attributes ?? {})) {
    const v = rec[field];
    if (typeof v === "string" && v.trim()) attributes[label] = v.trim();
    else if (typeof v === "number") attributes[label] = v;
  }

  const documents: { name: string; url: string }[] = [];
  for (const [field, label] of Object.entries(fm.documents ?? {})) {
    const url = str(rec, field);
    if (url) documents.push({ name: label, url });
  }

  const stock = fm.stock ? parseIntSafe(num(rec, fm.stock) ?? null) : null;
  const lead = fm.leadTimeDays ? parseIntSafe(num(rec, fm.leadTimeDays) ?? null) : null;

  return {
    supplierSku: str(rec, fm.supplierSku) ?? "",
    ean: str(rec, fm.ean),
    name: str(rec, fm.name) ?? "",
    brand: str(rec, fm.brand),
    categoryPath: categoryPath && categoryPath.length ? categoryPath : undefined,
    // NaN celowo: zod odrzuci rekord i zapisze błąd z indeksem zamiast wstawiać cenę 0.
    purchaseNetCents: purchaseNetCents ?? Number.NaN,
    stock: stock ?? -1,
    leadTimeDays: lead !== null && lead >= 0 ? lead : undefined,
    attributes: Object.keys(attributes).length ? attributes : undefined,
    images: fm.images ? splitList(str(rec, fm.images)) : undefined,
    documents: documents.length ? documents : undefined,
    raw: rec,
  };
}

/** Tworzy adapter HTTP dla hurtowni; rzuca NotConfiguredError, gdy brak URL feedu. */
export function createFeedAdapter(opts: FeedAdapterOptions): SupplierAdapter {
  const notConfigured = () =>
    new NotConfiguredError(
      `Brak danych dostępowych do hurtowni ${opts.supplierName} — TODO(ustalić): format feedu i dostępy`,
    );

  return {
    code: opts.code,

    async fetch(config: Record<string, string>): Promise<SupplierOfferRaw[]> {
      const cfg = resolveFeedConfig(opts.code, config);
      if (!cfg.url) throw notConfigured();

      const { text, contentType } = await fetchFeedText(cfg);
      const format = detectFormat(cfg.url, contentType, cfg.format);
      const records = parseFeedText(text, format, opts);
      console.log(`[sync:${opts.code}] feed ${format}: ${records.length} rekordów`);
      return records.map((rec) => mapRecord(rec, opts));
    },

    async healthcheck(config: Record<string, string>): Promise<boolean> {
      const cfg = resolveFeedConfig(opts.code, config);
      if (!cfg.url) return false;
      try {
        const headers: Record<string, string> = {};
        if (cfg.login && cfg.password) headers["Authorization"] = `Basic ${btoa(`${cfg.login}:${cfg.password}`)}`;
        const res = await fetch(cfg.url, { method: "HEAD", headers, signal: AbortSignal.timeout(15_000) });
        return res.ok || res.status === 405; // niektóre serwery nie obsługują HEAD
      } catch {
        return false;
      }
    },
  };
}
