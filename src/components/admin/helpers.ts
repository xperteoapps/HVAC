import { supabase } from "@/integrations/supabase/client";
import { extractFunctionError } from "@/hooks/useShipping";
import type { Json } from "@/integrations/supabase/types";
import type { Category, OrderStatus } from "@/types";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "awaiting_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "deferred", "refunded"] as const;
export const PRODUCT_STATUSES = ["active", "hidden", "discontinued"] as const;
export const FEED_TYPES = ["api", "xml", "csv", "ftp", "manual"] as const;
export const MARGIN_SCOPES = ["global", "category", "brand", "supplier", "product"] as const;

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: "Aktywny",
  hidden: "Ukryty",
  discontinued: "Wycofany",
};

export const ROLE_LABELS: Record<string, string> = {
  customer: "Klient",
  staff: "Pracownik",
  admin: "Administrator",
};

export const MARGIN_SCOPE_LABELS: Record<string, string> = {
  global: "Globalna",
  category: "Kategoria",
  brand: "Marka",
  supplier: "Hurtownia",
  product: "Produkt",
};

export const FEED_TYPE_LABELS: Record<string, string> = {
  api: "API",
  xml: "Plik XML",
  csv: "Plik CSV",
  ftp: "FTP",
  manual: "Ręcznie / brak",
};

/** Wartość sentinel dla "brak" w Select (Radix nie pozwala na pusty string). */
export const NONE_VALUE = "__none";

export function errorMessage(e: unknown, fallback = "Wystąpił nieoczekiwany błąd"): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

/** "1 234,56" → 123456; pusty tekst → null; niepoprawny → null */
export function zlToCents(text: string): number | null {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** 123456 → "1234.56"; null → "" */
export function centsToZl(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Kwota do CSV: 123456 → "1234,56" */
export function centsToCsv(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

const PL_MAP: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => PL_MAP[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Czyści frazę do użycia w filtrze `.or("col.ilike.%q%")` (przecinki i nawiasy psują składnię PostgREST). */
export function sanitizeSearch(q: string): string {
  return q.trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ");
}

export function jsonRecord(json: Json | null | undefined): Record<string, Json | undefined> {
  if (json && typeof json === "object" && !Array.isArray(json)) return json as Record<string, Json | undefined>;
  return {};
}

export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null | undefined>>): void {
  const escape = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Głębokość każdej kategorii (0 = korzeń) na podstawie parent_id. */
export function categoryDepths(categories: Pick<Category, "id" | "parent_id">[]): Map<string, number> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const depths = new Map<string, number>();
  const depthOf = (id: string, guard = 0): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    const c = byId.get(id);
    const d = c?.parent_id && byId.has(c.parent_id) && guard < 20 ? depthOf(c.parent_id, guard + 1) + 1 : 0;
    depths.set(id, d);
    return d;
  };
  for (const c of categories) depthOf(c.id);
  return depths;
}

export function indentLabel(name: string, depth: number): string {
  return `${"— ".repeat(depth)}${name}`;
}

interface SyncRunSummary {
  items_total?: number;
  items_new?: number;
  items_updated?: number;
  items_unmapped?: number;
  status?: string;
}

interface SyncResponse {
  status: string;
  run?: SyncRunSummary;
  message?: string;
}

export interface SyncResult {
  ok: boolean;
  message: string;
}

/** Wywołuje Edge Function `sync-supplier` i zwraca komunikat do toasta. */
export async function runSupplierSync(supplierCode: string): Promise<SyncResult> {
  const { data, error } = await supabase.functions.invoke<SyncResponse>("sync-supplier", {
    body: { supplierCode, source: "manual" },
  });
  if (error) throw new Error(await extractFunctionError(error, "Synchronizacja nie powiodła się"));
  if (!data) throw new Error("Brak odpowiedzi z funkcji synchronizacji");
  if (data.status === "ok") {
    const r = data.run ?? {};
    return {
      ok: true,
      message: `Zsynchronizowano ${r.items_total ?? 0} pozycji: nowe ${r.items_new ?? 0}, zaktualizowane ${r.items_updated ?? 0}, bez mapowania ${r.items_unmapped ?? 0}`,
    };
  }
  if (data.status === "not_configured") {
    return { ok: false, message: data.message || "Hurtownia nie ma skonfigurowanych danych dostępowych" };
  }
  return { ok: false, message: data.message ?? `Synchronizacja zakończona ze statusem: ${data.status}` };
}

/** Wysyła e-mail transakcyjny; błędy ignorowane (best effort). */
export async function sendEmailBestEffort(template: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await supabase.functions.invoke("send-email", { body: { template, payload } });
  } catch {
    /* best effort */
  }
}
