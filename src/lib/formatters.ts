const plnFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Grosze → "1 234,56 zł" */
export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return plnFormatter.format(cents / 100);
}

export function formatPriceWithMode(cents: number | null | undefined, mode: "gross" | "net"): string {
  if (cents === null || cents === undefined) return "—";
  return `${formatPrice(cents)} ${mode === "net" ? "netto" : "brutto"}`;
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatNumber(value: number | string | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  const s = Number.isFinite(n) ? n.toLocaleString("pl-PL", { maximumFractionDigits: 2 }) : String(value);
  return unit ? `${s} ${unit}` : s;
}

export function formatAttributeValue(value: unknown, unit?: string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "tak" : "nie";
  if (typeof value === "number") return formatNumber(value, unit);
  if (Array.isArray(value)) return value.map((v) => formatAttributeValue(v)).join(", ");
  return unit ? `${String(value)} ${unit}` : String(value);
}

export function formatWeight(kg: number | string | null | undefined): string {
  if (kg === null || kg === undefined) return "—";
  return formatNumber(kg, "kg");
}

/** Liczba mnoga PL: 1 produkt, 2 produkty, 5 produktów */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return `${n} ${one}`;
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Nowe",
  awaiting_payment: "Oczekuje na płatność",
  paid: "Opłacone",
  processing: "W realizacji",
  shipped: "Wysłane",
  delivered: "Dostarczone",
  cancelled: "Anulowane",
  refunded: "Zwrócone",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Oczekuje",
  paid: "Opłacone",
  failed: "Nieudana",
  deferred: "Odroczona",
  refunded: "Zwrócona",
};

export const STOCK_STATUS_LABELS: Record<string, string> = {
  in_stock: "Dostępny",
  low: "Ostatnie sztuki",
  on_order: "Na zamówienie",
  unavailable: "Niedostępny",
};

export const SYNC_STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  failed: "Błąd",
  running: "W trakcie",
  not_configured: "Oczekuje na dane dostępowe",
};

export function formatNip(nip: string | null | undefined): string {
  if (!nip) return "—";
  const d = nip.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}` : nip;
}
