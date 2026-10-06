// Normalizacja danych z feedów hurtowni do naszego słownika (CLAUDE.md 6.4).
// CZYSTY TypeScript — bez importów Deno/npm, żeby dało się testować vitestem z katalogu tests/.

// ---------------------------------------------------------------------------
// Tekst: diakrytyki, slugi
// ---------------------------------------------------------------------------

const POLISH_MAP: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
};

/** Usuwa polskie znaki i pozostałe diakrytyki (NFD). */
export function stripDiacritics(text: string): string {
  return text
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c) => POLISH_MAP[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Slug URL: bez diakrytyków, lowercase, myślniki. */
export function slugify(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Klucz atrybutu w snake_case (np. "Moc chłodnicza [kW]" → "moc_chlodnicza_kw"). */
export function snakeCase(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Normalizacja do porównań: bez diakrytyków, lowercase, pojedyncze spacje. */
function normalizeText(text: string): string {
  return stripDiacritics(text).toLowerCase().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Kategorie
// ---------------------------------------------------------------------------

/**
 * Słowo kluczowe (znormalizowane: bez diakrytyków, lowercase) → slug kategorii.
 * Klucz w formie "rodzic > dziecko" dopasowuje parę elementów ścieżki (dowolna odległość).
 * Dopasowanie: najpierw pary, potem dokładny element (od końca ścieżki), potem zawieranie.
 * W fazie 2 edytowalne z admina (category-map.json).
 */
export const CATEGORY_MAP: Record<string, string> = {
  // Klimatyzacja
  "klimatyzatory scienne split": "klimatyzatory-split",
  "klimatyzatory scienne": "klimatyzatory-split",
  "klimatyzatory split": "klimatyzatory-split",
  "klimatyzacja > split": "klimatyzatory-split",
  "scienne": "klimatyzatory-split",
  "systemy multi-split": "multi-split",
  "multi-split": "multi-split",
  "multi split": "multi-split",
  "multisplit": "multi-split",
  "kasetonowe": "kasetonowe",
  "kasetonowy": "kasetonowe",
  "kanalowe": "kanalowe",
  "kanalowy": "kanalowe",
  "przenosne": "przenosne",
  "przenosny": "przenosne",
  "klimatyzacja": "klimatyzacja",
  "klimatyzatory": "klimatyzacja",
  // Pompy ciepła
  "monoblok": "monoblok",
  "pompy ciepla > split": "pompy-split",
  "powietrze-woda > split": "pompy-split",
  "powietrze-woda": "powietrze-woda",
  "powietrze woda": "powietrze-woda",
  "cwu": "cwu",
  "ciepla woda uzytkowa": "cwu",
  "pompy ciepla": "pompy-ciepla",
  // Wentylacja
  "rekuperatory": "rekuperatory",
  "rekuperacja": "rekuperatory",
  "wentylatory": "wentylatory",
  "kanaly i ksztaltki": "kanaly-i-ksztaltki",
  "kanaly": "kanaly-i-ksztaltki",
  "ksztaltki": "kanaly-i-ksztaltki",
  "wentylacja": "wentylacja-i-rekuperacja",
  // Czynniki i narzędzia
  "czynniki chlodnicze": "czynniki-chlodnicze",
  "czynniki": "czynniki-chlodnicze",
  "manometry i pompy prozniowe": "manometry-i-pompy-prozniowe",
  "manometry": "manometry-i-pompy-prozniowe",
  "pompy prozniowe": "manometry-i-pompy-prozniowe",
  "narzedzia serwisowe": "narzedzia",
  "narzedzia": "narzedzia",
  // Akcesoria montażowe
  "rury miedziane": "rury-miedziane",
  "rury": "rury-miedziane",
  "wsporniki": "wsporniki",
  "wsporniki i podstawy": "wsporniki",
  "pompki skroplin": "pompki-skroplin",
  "pompki": "pompki-skroplin",
  "kable i przewody": "kable-i-przewody",
  "kable": "kable-i-przewody",
  "przewody": "kable-i-przewody",
  "izolacje": "izolacje",
  "izolacje i weze": "izolacje",
  "akcesoria montazowe": "akcesoria-montazowe",
  "akcesoria": "akcesoria-montazowe",
  // Serwis i części
  "filtry": "filtry",
  "piloty": "piloty",
  "czesci elektroniczne": "plytki-i-czujniki",
  "plytki i czujniki": "plytki-i-czujniki",
  "plytki": "plytki-i-czujniki",
  "czujniki": "plytki-i-czujniki",
  "serwis i czesci": "serwis-i-czesci",
  "serwis": "serwis-i-czesci",
  "czesci": "serwis-i-czesci",
};

const PAIR_KEYS: Array<[parent: string, child: string, slug: string]> = Object.entries(CATEGORY_MAP)
  .filter(([key]) => key.includes(" > "))
  .map(([key, slug]) => {
    const [parent, child] = key.split(" > ");
    return [parent, child, slug] as [string, string, string];
  });

const SINGLE_KEYS: Array<[key: string, slug: string]> = Object.entries(CATEGORY_MAP)
  .filter(([key]) => !key.includes(" > "))
  .sort((a, b) => b[0].length - a[0].length); // dłuższe (bardziej szczegółowe) najpierw

/**
 * Mapuje ścieżkę kategorii hurtowni na slug naszej kategorii; null gdy brak dopasowania.
 * Najbardziej szczegółowy element (ostatni) ma pierwszeństwo.
 */
export function mapCategory(path: readonly string[] | null | undefined): string | null {
  if (!path || path.length === 0) return null;
  const parts = path.map(normalizeText).filter((p) => p.length > 0);
  if (parts.length === 0) return null;

  // 1. Pary "rodzic > dziecko" (dziecko = dowolny późniejszy element), od końca.
  for (let i = parts.length - 1; i >= 1; i--) {
    for (let j = i - 1; j >= 0; j--) {
      for (const [parent, child, slug] of PAIR_KEYS) {
        if (parts[i] === child && (parts[j] === parent || parts[j].includes(parent))) return slug;
      }
    }
  }
  // 2. Dokładny element, od końca.
  for (let i = parts.length - 1; i >= 0; i--) {
    const exact = CATEGORY_MAP[parts[i]];
    if (exact) return exact;
  }
  // 3. Zawieranie słowa kluczowego, od końca (dłuższe klucze najpierw).
  for (let i = parts.length - 1; i >= 0; i--) {
    for (const [key, slug] of SINGLE_KEYS) {
      if (parts[i].includes(key)) return slug;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Atrybuty
// ---------------------------------------------------------------------------

/** Nasze klucze atrybutów (spójne z product_attributes_def w seed.sql) + weight_kg. */
export const KNOWN_ATTRIBUTE_KEYS: readonly string[] = [
  "typ", "moc_chlodnicza_kw", "moc_grzewcza_kw", "powierzchnia_m2",
  "klasa_energetyczna_chlodzenie", "klasa_energetyczna_grzanie", "czynnik", "zasilanie",
  "seer", "scop", "poziom_halasu_db", "wifi", "liczba_jednostek", "temp_zasilania_max_c",
  "pojemnosc_l", "wydajnosc_m3h", "odzysk_ciepla_pct", "srednica_mm", "srednica_cal",
  "dlugosc_m", "dlugosc_mm", "pojemnosc_kg", "udzwig_kg", "izolacja", "spręż_pa",
  "wydajnosc_lh", "podnoszenie_m", "przekroj_mm2", "liczba_zyl", "grubosc_mm",
  "pasuje_do", "zakres", "wydajnosc_lmin", "weight_kg",
];

/**
 * Etykieta surowa (znormalizowana funkcją normalizeLabel) → nasz klucz.
 * Jednostki w nawiasach są usuwane przed dopasowaniem, więc "Moc chłodnicza [kW]" == "moc chlodnicza".
 */
export const ATTRIBUTE_ALIASES: Record<string, string> = {
  // moc chłodnicza
  "moc chlodnicza": "moc_chlodnicza_kw",
  "moc chl": "moc_chlodnicza_kw",
  "moc chlodzenia": "moc_chlodnicza_kw",
  "wydajnosc chlodnicza": "moc_chlodnicza_kw",
  "cooling capacity": "moc_chlodnicza_kw",
  "cooling": "moc_chlodnicza_kw",
  // moc grzewcza
  "moc grzewcza": "moc_grzewcza_kw",
  "moc grz": "moc_grzewcza_kw",
  "moc grzania": "moc_grzewcza_kw",
  "wydajnosc grzewcza": "moc_grzewcza_kw",
  "heating capacity": "moc_grzewcza_kw",
  "heating": "moc_grzewcza_kw",
  // efektywność
  "seer": "seer",
  "wspolczynnik seer": "seer",
  "scop": "scop",
  "wspolczynnik scop": "scop",
  // czynnik
  "czynnik": "czynnik",
  "czynnik chlodniczy": "czynnik",
  "rodzaj czynnika": "czynnik",
  "refrigerant": "czynnik",
  // klasa energetyczna
  "klasa energetyczna": "klasa_energetyczna_chlodzenie",
  "klasa energetyczna chlodzenie": "klasa_energetyczna_chlodzenie",
  "klasa energetyczna chlodzenia": "klasa_energetyczna_chlodzenie",
  "klasa chlodzenie": "klasa_energetyczna_chlodzenie",
  "energy class": "klasa_energetyczna_chlodzenie",
  "energy class cooling": "klasa_energetyczna_chlodzenie",
  "klasa energetyczna grzanie": "klasa_energetyczna_grzanie",
  "klasa energetyczna grzania": "klasa_energetyczna_grzanie",
  "klasa grzanie": "klasa_energetyczna_grzanie",
  "energy class heating": "klasa_energetyczna_grzanie",
  // zasilanie
  "zasilanie": "zasilanie",
  "power supply": "zasilanie",
  "napiecie": "zasilanie",
  "napiecie zasilania": "zasilanie",
  "voltage": "zasilanie",
  "fazy": "zasilanie",
  "liczba faz": "zasilanie",
  // hałas
  "poziom halasu": "poziom_halasu_db",
  "poziom halasu jedn wewn": "poziom_halasu_db",
  "halas": "poziom_halasu_db",
  "glosnosc": "poziom_halasu_db",
  "noise level": "poziom_halasu_db",
  "noise": "poziom_halasu_db",
  "poziom cisnienia akustycznego": "poziom_halasu_db",
  // wifi
  "wi fi": "wifi",
  "wifi": "wifi",
  "sterowanie wi fi": "wifi",
  "modul wi fi": "wifi",
  "wi fi control": "wifi",
  // pozostałe
  "typ": "typ",
  "type": "typ",
  "rodzaj": "typ",
  "powierzchnia": "powierzchnia_m2",
  "powierzchnia pomieszczenia": "powierzchnia_m2",
  "zalecana powierzchnia": "powierzchnia_m2",
  "recommended area": "powierzchnia_m2",
  "wydajnosc": "wydajnosc_m3h",
  "air flow": "wydajnosc_m3h",
  "przeplyw powietrza": "wydajnosc_m3h",
  "pojemnosc zbiornika": "pojemnosc_l",
  "tank capacity": "pojemnosc_l",
  "waga": "weight_kg",
  "waga netto": "weight_kg",
  "masa": "weight_kg",
  "masa netto": "weight_kg",
  "weight": "weight_kg",
  "sprez pa": "spręż_pa",
  "sprez": "spręż_pa",
  "sprez dyspozycyjny": "spręż_pa",
};

/** Etykieta → forma do dopasowania: bez jednostek w nawiasach, bez diakrytyków, bez interpunkcji. */
export function normalizeLabel(label: string): string {
  return stripDiacritics(label)
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ") // usuń jednostki w nawiasach
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const KNOWN_KEY_BY_LABEL: Map<string, string> = new Map(
  KNOWN_ATTRIBUTE_KEYS.map((key) => [normalizeLabel(key), key]),
);

/** Zwraca nasz klucz dla etykiety surowej; nieznane → snake_case etykiety. */
export function resolveAttributeKey(rawLabel: string): string {
  const normalized = normalizeLabel(rawLabel);
  if (!normalized) return snakeCase(rawLabel) || "atrybut";
  const alias = ATTRIBUTE_ALIASES[normalized];
  if (alias) return alias;
  const known = KNOWN_KEY_BY_LABEL.get(normalized);
  if (known) return known;
  return snakeCase(rawLabel);
}

export type AttributeValue = string | number | boolean;

const BTU_TO_KW = 0.000293071;

/** Wyciąga pierwszą liczbę z tekstu ("3,5 kW" → 3.5). */
export function parseNumberLoose(value: AttributeValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;
  const match = /-?\d+(?:[.,]\d+)?/.exec(value.replace(/\s+/g, ""));
  if (!match) return null;
  const n = Number(match[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Moc: W / BTU / kW → kW (2 miejsca). Liczba bez jednostki > 100 traktowana jako W. */
export function parseCapacityKw(value: AttributeValue): number | null {
  const n = parseNumberLoose(value);
  if (n === null) return null;
  if (typeof value === "string") {
    const unit = value.toLowerCase();
    if (/btu/.test(unit)) return round2(n * BTU_TO_KW);
    if (/kw/.test(unit)) return round2(n);
    if (/(^|[^a-z])w([^a-z]|$)/.test(unit)) return round2(n / 1000);
  }
  return n > 100 ? round2(n / 1000) : round2(n);
}

/** Zasilanie: "1F" / "230V" / "1-fazowe" → "1-fazowe"; "3F" / "400V" → "3-fazowe". */
export function parsePhase(value: AttributeValue): string {
  const raw = String(value).trim();
  const v = normalizeText(raw).replace(/\s+/g, "");
  if (/(^|[^0-9])3f|400v|380v|3faz|3x|trojfaz|threephase|3ph/.test(v)) return "3-fazowe";
  if (/(^|[^0-9])1f|230v|220v|1faz|jednofaz|singlephase|1ph/.test(v)) return "1-fazowe";
  return raw;
}

/** "tak"/"yes"/"true"/"1" → true, "nie"/"no"/"false"/"0"/"brak" → false; inaczej null. */
export function parseBoolLoose(value: AttributeValue): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  const v = normalizeText(value);
  if (["tak", "yes", "true", "1", "jest", "wbudowane", "w standardzie", "standard"].includes(v)) return true;
  if (["nie", "no", "false", "0", "brak", "nie dotyczy"].includes(v)) return false;
  return null;
}

/** Waga w kg (obsługa "12 500 g", "12,5 kg", liczba). */
export function parseWeightKg(value: AttributeValue): number | null {
  const n = parseNumberLoose(value);
  if (n === null) return null;
  if (typeof value === "string" && /(^|[^a-z])g([^a-z]|$)/i.test(value) && !/kg/i.test(value)) {
    return round2(n / 1000);
  }
  return round2(n);
}

function normalizeRefrigerant(value: AttributeValue): string {
  return String(value).trim().toUpperCase().replace(/^R[-\s]+(\d)/, "R$1");
}

const NUMERIC_KEYS = new Set<string>([
  "seer", "scop", "poziom_halasu_db", "powierzchnia_m2", "liczba_jednostek",
  "temp_zasilania_max_c", "pojemnosc_l", "wydajnosc_m3h", "odzysk_ciepla_pct", "srednica_mm",
  "dlugosc_m", "dlugosc_mm", "pojemnosc_kg", "udzwig_kg", "spręż_pa", "wydajnosc_lh",
  "podnoszenie_m", "przekroj_mm2", "liczba_zyl", "grubosc_mm", "wydajnosc_lmin",
]);

/** Konwertuje wartość atrybutu wg docelowego klucza (jednostki, booleany, fazy). */
export function normalizeAttributeValue(key: string, value: AttributeValue): AttributeValue | null {
  if (typeof value === "string" && value.trim() === "") return null;
  switch (key) {
    case "moc_chlodnicza_kw":
    case "moc_grzewcza_kw":
      return parseCapacityKw(value) ?? value;
    case "zasilanie":
      return parsePhase(value);
    case "wifi": {
      const b = parseBoolLoose(value);
      return b === null ? value : b;
    }
    case "czynnik":
      return normalizeRefrigerant(value);
    case "klasa_energetyczna_chlodzenie":
    case "klasa_energetyczna_grzanie":
      return String(value).trim().toUpperCase();
    case "weight_kg":
      return parseWeightKg(value) ?? value;
    default:
      if (NUMERIC_KEYS.has(key)) return parseNumberLoose(value) ?? value;
      return typeof value === "string" ? value.trim() : value;
  }
}

/**
 * Mapuje surowe atrybuty hurtowni na nasz słownik: klucze przez aliasy (nieznane → snake_case),
 * wartości z konwersją jednostek. Puste wartości są pomijane.
 */
export function normalizeAttributes(
  raw: Record<string, AttributeValue | null | undefined> | null | undefined,
): Record<string, AttributeValue> {
  const out: Record<string, AttributeValue> = {};
  if (!raw) return out;
  for (const [label, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    const key = resolveAttributeKey(label);
    if (!key) continue;
    const normalized = normalizeAttributeValue(key, value);
    if (normalized === null) continue;
    // Pierwsze dopasowanie wygrywa (np. "Moc chłodnicza" i "Cooling capacity" w jednym feedzie).
    if (!(key in out)) out[key] = normalized;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Marki
// ---------------------------------------------------------------------------

export const KNOWN_BRANDS: readonly string[] = [
  "KAISAI", "Sinclair", "Gree", "Midea", "Haier", "LG", "Samsung", "Daikin",
  "Mitsubishi Electric", "Mitsubishi Heavy", "Rotenso", "Panasonic", "Fujitsu", "Toshiba",
  "Hisense", "Vents", "Armacell", "Refco", "Aspen", "Honeywell", "Rawicom", "Elektrokabel",
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BRAND_PATTERNS: Array<[brand: string, re: RegExp]> = [...KNOWN_BRANDS]
  .sort((a, b) => b.length - a.length)
  .map((brand) => [brand, new RegExp(`(^|[^a-z0-9])${escapeRegExp(brand.toLowerCase())}([^a-z0-9]|$)`, "i")]);

/** Marka: pole z feedu jeśli niepuste, inaczej pierwsza znana marka znaleziona w nazwie. */
export function extractBrand(name: string, brandRaw?: string | null): string | null {
  const explicit = (brandRaw ?? "").trim();
  if (explicit) {
    const canonical = KNOWN_BRANDS.find((b) => b.toLowerCase() === explicit.toLowerCase());
    return canonical ?? explicit;
  }
  const haystack = stripDiacritics(name).toLowerCase();
  for (const [brand, re] of BRAND_PATTERNS) {
    if (re.test(haystack)) return brand;
  }
  return null;
}

// ---------------------------------------------------------------------------
// SKU / EAN
// ---------------------------------------------------------------------------

/**
 * SKU produktu tworzonego automatycznie: `${CODE}-${supplierSku}`, uppercase, bezpieczne znaki.
 * Jeśli supplierSku już zaczyna się od prefiksu (np. "MOCK-…"), prefiks nie jest dublowany.
 */
export function makeSku(supplierCode: string, supplierSku: string): string {
  const code = snakeCase(supplierCode).toUpperCase().replace(/_/g, "-");
  const sanitized = stripDiacritics(supplierSku)
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!sanitized) return code;
  if (sanitized === code || sanitized.startsWith(`${code}-`)) return sanitized;
  return `${code}-${sanitized}`;
}

/** Zdejmuje prefiks `${CODE}-` z SKU hurtowni (do dopasowania po SKU). */
export function stripSupplierPrefix(supplierCode: string, supplierSku: string): string {
  const code = snakeCase(supplierCode).toUpperCase().replace(/_/g, "-");
  const upper = supplierSku.trim();
  if (upper.toUpperCase().startsWith(`${code}-`)) return upper.slice(code.length + 1);
  return upper;
}

/** EAN: same cyfry; dopuszczalne długości 8/12/13/14, inaczej null. */
export function normalizeEan(ean?: string | number | null): string | null {
  if (ean === null || ean === undefined) return null;
  const digits = String(ean).replace(/\D+/g, "");
  if (digits.length === 0) return null;
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (/^0+$/.test(digits)) return null;
  return digits;
}
