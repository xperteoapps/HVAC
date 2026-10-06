// Adapter demo — dane z mock-data.ts (spójne z seed.sql). Używany do developmentu frontu i checkoutu.
// Supplier `mock` ma active=false na produkcji.

import { MOCK_ITEMS, type MockItem } from "./mock-data.ts";
import type { SupplierAdapter, SupplierOfferRaw } from "./types.ts";

const IMAGE_BASE = "https://placehold.co/800x800/F8FAFC/0F172A?text=";
const DOCS_BASE = "https://example.com/docs/";

/** Deterministyczny „ruch” stanów zależny od bieżącej godziny, żeby kolejne synce coś zmieniały. */
function jitterStock(stock: number, hour: number): number {
  if (stock <= 3) return stock; // niskie stany i braki zostawiamy bez zmian (stabilne scenariusze testowe)
  return Math.max(0, stock + ((hour % 3) - 1));
}

function toRawAttributes(attrs: MockItem["attributes"]): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(attrs)) {
    // Interfejs SupplierOfferRaw dopuszcza tylko string | number — booleany jako "tak"/"nie"
    // (normalize.ts zamienia je z powrotem na boolean dla kluczy typu wifi).
    out[key] = typeof value === "boolean" ? (value ? "tak" : "nie") : value;
  }
  return out;
}

export function mapMockItem(item: MockItem, hour: number): SupplierOfferRaw {
  const imageSeed = item.imageSeed || item.sku;
  return {
    supplierSku: item.sku,
    ean: item.ean,
    name: item.name,
    brand: item.brand,
    categoryPath: item.category,
    purchaseNetCents: item.purchaseNetCents,
    stock: jitterStock(item.stock, hour),
    leadTimeDays: item.leadTimeDays,
    attributes: { ...toRawAttributes(item.attributes), weight_kg: item.weightKg },
    images: [`${IMAGE_BASE}${encodeURIComponent(imageSeed)}`],
    documents: [{ name: "Karta katalogowa", url: `${DOCS_BASE}${encodeURIComponent(imageSeed)}.pdf` }],
    raw: item,
  };
}

export const mockAdapter: SupplierAdapter = {
  code: "mock",

  fetch(_config: Record<string, string>): Promise<SupplierOfferRaw[]> {
    const hour = new Date().getUTCHours();
    return Promise.resolve(MOCK_ITEMS.map((item) => mapMockItem(item, hour)));
  },

  healthcheck(): Promise<boolean> {
    return Promise.resolve(true);
  },
};
