import type { ProductFilters, SortKey } from "@/hooks/useProducts";

/**
 * Stan filtrów w URL: ?marka=kaisai,gree&czynnik=R32&moc_chlodnicza_kw=3.5-5&cena=1000-5000
 *                     &dostepnosc=in_stock&sort=price_asc&strona=2&widok=list
 * Ceny w URL w złotych (brutto), w filtrach w groszach.
 */
export const RESERVED_PARAMS = new Set(["marka", "cena", "dostepnosc", "sort", "strona", "widok", "q", "wifi"]);

export interface UrlFilterState {
  brands: string[];
  attrValues: Record<string, string[]>;
  attrRanges: Record<string, [number | null, number | null]>;
  priceMin: number | null;
  priceMax: number | null;
  availability: "in_stock" | "on_order" | null;
  wifi: boolean;
  sort: SortKey;
  page: number;
  view: "grid" | "list";
  q: string | null;
}

function parseRange(v: string): [number | null, number | null] {
  const [a, b] = v.split("-");
  const min = a !== undefined && a !== "" ? Number(a) : null;
  const max = b !== undefined && b !== "" ? Number(b) : null;
  return [Number.isFinite(min as number) ? min : null, Number.isFinite(max as number) ? max : null];
}

export function parseFilters(params: URLSearchParams, numberKeys: Set<string>): UrlFilterState {
  const state: UrlFilterState = {
    brands: [],
    attrValues: {},
    attrRanges: {},
    priceMin: null,
    priceMax: null,
    availability: null,
    wifi: false,
    sort: "relevance",
    page: 1,
    view: "grid",
    q: null,
  };
  for (const [key, value] of params.entries()) {
    if (!value) continue;
    switch (key) {
      case "marka":
        state.brands = value.split(",").filter(Boolean);
        break;
      case "cena": {
        const [min, max] = parseRange(value);
        state.priceMin = min !== null ? Math.round(min * 100) : null;
        state.priceMax = max !== null ? Math.round(max * 100) : null;
        break;
      }
      case "dostepnosc":
        state.availability = value === "in_stock" || value === "on_order" ? value : null;
        break;
      case "sort":
        state.sort = (["relevance", "price_asc", "price_desc", "name_asc", "newest"] as SortKey[]).includes(value as SortKey) ? (value as SortKey) : "relevance";
        break;
      case "strona":
        state.page = Math.max(1, parseInt(value, 10) || 1);
        break;
      case "widok":
        state.view = value === "list" ? "list" : "grid";
        break;
      case "wifi":
        state.wifi = value === "1" || value === "true";
        break;
      case "q":
        state.q = value;
        break;
      default:
        if (numberKeys.has(key)) state.attrRanges[key] = parseRange(value);
        else state.attrValues[key] = value.split(",").filter(Boolean);
    }
  }
  return state;
}

export function toProductFilters(state: UrlFilterState, categoryIds: string[] | undefined, pageSize: number): ProductFilters {
  return {
    categoryIds,
    brandSlugs: state.brands,
    attrValues: state.attrValues,
    attrRanges: state.attrRanges,
    priceMin: state.priceMin,
    priceMax: state.priceMax,
    availability: state.availability,
    wifi: state.wifi,
    search: state.q,
    sort: state.sort,
    page: state.page,
    pageSize,
  };
}

export function countActiveFilters(state: UrlFilterState): number {
  return (
    state.brands.length +
    Object.values(state.attrValues).reduce((a, v) => a + v.length, 0) +
    Object.keys(state.attrRanges).length +
    (state.priceMin !== null || state.priceMax !== null ? 1 : 0) +
    (state.availability ? 1 : 0) +
    (state.wifi ? 1 : 0)
  );
}

export function serializeFilters(state: UrlFilterState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.q) out.q = state.q;
  if (state.brands.length) out.marka = state.brands.join(",");
  for (const [k, v] of Object.entries(state.attrValues)) if (v.length) out[k] = v.join(",");
  for (const [k, [lo, hi]] of Object.entries(state.attrRanges)) out[k] = `${lo ?? ""}-${hi ?? ""}`;
  if (state.priceMin !== null || state.priceMax !== null) out.cena = `${state.priceMin !== null ? state.priceMin / 100 : ""}-${state.priceMax !== null ? state.priceMax / 100 : ""}`;
  if (state.availability) out.dostepnosc = state.availability;
  if (state.wifi) out.wifi = "1";
  if (state.sort !== "relevance") out.sort = state.sort;
  if (state.page > 1) out.strona = String(state.page);
  if (state.view !== "grid") out.widok = state.view;
  return out;
}
