// Interfejs adaptera hurtowni (CLAUDE.md 6.1) + walidacja zod + błąd braku konfiguracji.

import { z } from "zod";

export interface SupplierOfferRaw {
  supplierSku: string;
  ean?: string;
  name: string;
  brand?: string;
  categoryPath?: string[]; // ścieżka kategorii hurtowni, mapowana w normalize.ts
  purchaseNetCents: number;
  stock: number; // -1 = nieznany
  leadTimeDays?: number;
  attributes?: Record<string, string | number>;
  images?: string[];
  documents?: { name: string; url: string }[];
  raw: unknown;
}

export interface SupplierAdapter {
  code: string;
  fetch(config: Record<string, string>): Promise<SupplierOfferRaw[]>; // pobierz i sparsuj cały feed
  healthcheck?(config: Record<string, string>): Promise<boolean>;
}

/** Brak danych dostępowych / konfiguracji feedu — sync kończy się statusem 'not_configured'. */
export class NotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConfiguredError";
  }
}

export const supplierOfferRawSchema = z.object({
  supplierSku: z.string().trim().min(1, "brak supplierSku").max(120),
  ean: z.string().trim().max(32).optional(),
  name: z.string().trim().min(1, "brak nazwy").max(500),
  brand: z.string().trim().max(120).optional(),
  categoryPath: z.array(z.string().trim().max(200)).max(10).optional(),
  purchaseNetCents: z.number().int("purchaseNetCents musi być liczbą całkowitą (grosze)").nonnegative(),
  stock: z.number().int().min(-1),
  leadTimeDays: z.number().int().nonnegative().max(365).optional(),
  attributes: z.record(z.union([z.string(), z.number()])).optional(),
  images: z.array(z.string().url()).max(30).optional(),
  documents: z.array(z.object({ name: z.string().trim().min(1), url: z.string().url() })).max(30).optional(),
  raw: z.unknown(),
});

/** Typ po walidacji — strukturalnie zgodny z SupplierOfferRaw. */
export type SupplierOfferValidated = z.infer<typeof supplierOfferRawSchema>;
