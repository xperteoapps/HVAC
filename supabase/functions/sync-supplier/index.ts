// sync-supplier — orchestrator synchronizacji hurtowni (CLAUDE.md 6.2).
// POST { supplierCode, source?: 'cron' | 'manual' }  — auth: service role (pg_cron) albo admin/staff.
//
// Przebieg: sync_runs(running) → adapter.fetch → walidacja zod → upsert supplier_offers (paczki 500)
// → dezaktywacja ofert nieobecnych w feedzie → auto-mapowanie (mapowania ręczne → EAN → SKU →
// auto-create gdy feed_config.auto_create_products) → recalc_products (paczki 200) → zamknięcie runu.
//
// Pamięć: cały feed jest ładowany do pamięci. Dla feedów > 50k pozycji adapter powinien
// zwracać rekordy strumieniowo (AsyncIterable) i ten plik powinien upsertować paczkami w trakcie
// parsowania — TODO, gdy pojawi się taka hurtownia. Paczkowanie zapisów już jest.

import { z } from "zod";
import { errorResponse, errorToResponse, handleOptions, HttpError, jsonResponse, readJson } from "../_shared/cors.ts";
import {
  type AdminClient,
  assertNoError,
  chunk,
  createAdminClient,
  getCaller,
  requireAdmin,
  selectAll,
} from "../_shared/supabase.ts";
import { sendEmail } from "../_shared/resend.ts";
import { syncFailedAdmin } from "../_shared/email-templates.ts";
import {
  NotConfiguredError,
  type SupplierAdapter,
  type SupplierOfferValidated,
  supplierOfferRawSchema,
} from "./adapters/types.ts";
import { mockAdapter } from "./adapters/mock.ts";
import { iglocarAdapter } from "./adapters/iglocar.ts";
import { autoklimaAdapter } from "./adapters/autoklima.ts";
import { kaisaiAdapter } from "./adapters/kaisai.ts";
import { termosilesiaAdapter } from "./adapters/termosilesia.ts";
import { sinclairAdapter } from "./adapters/sinclair.ts";
import {
  extractBrand,
  makeSku,
  mapCategory,
  normalizeAttributes,
  normalizeEan,
  slugify,
  stripSupplierPrefix,
} from "./normalize.ts";

// ---------------------------------------------------------------------------
// Rejestr adapterów
// ---------------------------------------------------------------------------

const ADAPTERS: Record<string, SupplierAdapter> = {
  mock: mockAdapter,
  iglocar: iglocarAdapter,
  autoklima: autoklimaAdapter,
  kaisai: kaisaiAdapter,
  termosilesia: termosilesiaAdapter,
  sinclair: sinclairAdapter,
};

const UPSERT_BATCH = 500;
const LOOKUP_BATCH = 200;
const RECALC_BATCH = 200;
const INSERT_BATCH = 100;
const MAX_STORED_ERRORS = 200;

const bodySchema = z.object({
  supplierCode: z.string().trim().min(1, "Podaj supplierCode."),
  source: z.enum(["cron", "manual"]).default("manual"),
});

// ---------------------------------------------------------------------------
// Minimalne typy wierszy
// ---------------------------------------------------------------------------

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
  feed_config: Record<string, unknown> | null;
}

interface ExistingOfferRow {
  id: string;
  supplier_sku: string;
  product_id: string | null;
}

interface UnmappedOfferRow {
  id: string;
  supplier_sku: string;
  ean: string | null;
  name_raw: string;
  brand_raw: string | null;
  category_path: string[] | null;
  raw: unknown;
}

interface IdSlugRow {
  id: string;
  slug: string;
}

interface MappingRow {
  supplier_sku: string;
  product_id: string;
}

interface SyncError {
  index: number;
  sku?: string;
  message: string;
}

type MatchedBy = "ean" | "sku" | "auto_create";

interface Assignment {
  offerId: string;
  supplierSku: string;
  productId: string;
  /** null = istniejące mapowanie ręczne (nie zapisujemy ponownie) */
  matchedBy: MatchedBy | null;
}

interface SyncStats {
  items_total: number;
  items_valid: number;
  items_new: number;
  items_updated: number;
  items_deactivated: number;
  items_mapped: number;
  products_created: number;
  items_unmapped: number;
  products_recalculated: number;
  errors: SyncError[];
}

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

function flattenConfig(config: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!config) return out;
  for (const [k, v] of Object.entries(config)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return out;
}

function autoCreateEnabled(config: Record<string, unknown> | null): boolean {
  const v = config?.auto_create_products;
  return v === true || v === "true" || v === 1;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function documentType(name: string): "karta" | "instrukcja" | "deklaracja" {
  const n = name.toLowerCase();
  if (/instrukc|manual/.test(n)) return "instrukcja";
  if (/deklarac|certyf|declaration/.test(n)) return "deklaracja";
  return "karta";
}

function rawWeightKg(raw: unknown): number | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  const v = rec.weightKg ?? rec.weight_kg;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function finishRun(admin: AdminClient, runId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await admin
    .from("sync_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) console.error("[sync] sync_runs.update:", error.message);
}

async function updateSupplier(admin: AdminClient, supplierId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await admin.from("suppliers").update(patch).eq("id", supplierId);
  if (error) console.error("[sync] suppliers.update:", error.message);
}

function summaryLog(stats: SyncStats): string {
  return `Pozycje: ${stats.items_total} (poprawne ${stats.items_valid}, nowe ${stats.items_new}, ` +
    `zaktualizowane ${stats.items_updated}, wycofane ${stats.items_deactivated}). ` +
    `Zmapowane w tym przebiegu: ${stats.items_mapped}, utworzone produkty: ${stats.products_created}, ` +
    `bez mapowania: ${stats.items_unmapped}, przeliczone produkty: ${stats.products_recalculated}, ` +
    `błędy: ${stats.errors.length}.`;
}

async function lookupProductsBySku(admin: AdminClient, skus: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const batch of chunk(skus, LOOKUP_BATCH)) {
    const { data, error } = await admin.from("products").select("id, sku").in("sku", batch);
    assertNoError(error, "products.bySku");
    for (const p of (data ?? []) as Array<{ id: string; sku: string }>) out.set(p.sku, p.id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Główny przebieg
// ---------------------------------------------------------------------------

async function runSync(admin: AdminClient, supplier: SupplierRow, adapter: SupplierAdapter): Promise<SyncStats> {
  const startedAt = new Date().toISOString();
  const log = (msg: string) => console.log(`[sync:${supplier.code}] ${msg}`);
  const stats: SyncStats = {
    items_total: 0,
    items_valid: 0,
    items_new: 0,
    items_updated: 0,
    items_deactivated: 0,
    items_mapped: 0,
    products_created: 0,
    items_unmapped: 0,
    products_recalculated: 0,
    errors: [],
  };
  const pushError = (e: SyncError) => {
    if (stats.errors.length < MAX_STORED_ERRORS) stats.errors.push(e);
  };

  // 1. Pobranie feedu -----------------------------------------------------------
  const rawItems = await adapter.fetch(flattenConfig(supplier.feed_config));
  stats.items_total = rawItems.length;
  log(`pobrano ${rawItems.length} pozycji`);

  // 2. Walidacja zod + deduplikacja po supplierSku ---------------------------------
  const validBySku = new Map<string, SupplierOfferValidated>();
  rawItems.forEach((item: unknown, index: number) => {
    const parsed = supplierOfferRawSchema.safeParse(item);
    if (!parsed.success) {
      const skuRaw = typeof item === "object" && item !== null ? (item as { supplierSku?: unknown }).supplierSku : undefined;
      pushError({
        index,
        sku: typeof skuRaw === "string" ? skuRaw : undefined,
        message: parsed.error.issues.map((i) => `${i.path.join(".") || "?"}: ${i.message}`).join("; "),
      });
      return;
    }
    const offer = parsed.data;
    if (validBySku.has(offer.supplierSku)) {
      pushError({ index, sku: offer.supplierSku, message: "duplikat supplierSku w feedzie — użyto ostatniego wystąpienia" });
    }
    validBySku.set(offer.supplierSku, offer);
  });
  const valid = [...validBySku.values()];
  stats.items_valid = valid.length;

  // 3. Istniejące oferty (do liczenia new/updated i listy produktów do przeliczenia) ---
  const existing = await selectAll<ExistingOfferRow>(
    (from, to) =>
      admin.from("supplier_offers").select("id, supplier_sku, product_id").eq("supplier_id", supplier.id).range(from, to),
    "supplier_offers.existing",
  );
  const existingSkus = new Set(existing.map((e) => e.supplier_sku));
  const affectedProductIds = new Set<string>();
  for (const e of existing) if (e.product_id) affectedProductIds.add(e.product_id);
  stats.items_new = valid.filter((v) => !existingSkus.has(v.supplierSku)).length;
  stats.items_updated = valid.length - stats.items_new;

  // 4. Upsert supplier_offers paczkami ---------------------------------------------
  // Uwaga: trigger supplier_offers_recalc_on_change przelicza zmapowane produkty już tutaj;
  // recalc_products niżej jest celowo (spójność dla nowych mapowań i ofert wycofanych).
  const upsertRows = valid.map((v) => ({
    supplier_id: supplier.id,
    supplier_sku: v.supplierSku,
    ean: normalizeEan(v.ean),
    name_raw: v.name,
    brand_raw: v.brand ?? null,
    category_path: v.categoryPath ?? null,
    purchase_net_cents: v.purchaseNetCents,
    stock: v.stock,
    lead_time_days: v.leadTimeDays ?? null,
    active: true,
    raw: v.raw ?? null,
    fetched_at: startedAt,
  }));
  for (const batch of chunk(upsertRows, UPSERT_BATCH)) {
    const { error } = await admin.from("supplier_offers").upsert(batch, { onConflict: "supplier_id,supplier_sku" });
    assertNoError(error, "supplier_offers.upsert");
  }
  log(`upsert ${upsertRows.length} ofert`);

  // 5. Oferty nieobecne w feedzie → active=false, stock=0 ----------------------------
  const { data: deactivatedData, error: deactivateError } = await admin
    .from("supplier_offers")
    .update({ active: false, stock: 0 })
    .eq("supplier_id", supplier.id)
    .eq("active", true)
    .lt("fetched_at", startedAt)
    .select("id, product_id");
  assertNoError(deactivateError, "supplier_offers.deactivate");
  const deactivated = (deactivatedData ?? []) as Array<{ id: string; product_id: string | null }>;
  stats.items_deactivated = deactivated.length;
  for (const d of deactivated) if (d.product_id) affectedProductIds.add(d.product_id);

  // 6. Auto-mapowanie ofert bez product_id --------------------------------------------
  const unmapped = await selectAll<UnmappedOfferRow>(
    (from, to) =>
      admin
        .from("supplier_offers")
        .select("id, supplier_sku, ean, name_raw, brand_raw, category_path, raw")
        .eq("supplier_id", supplier.id)
        .is("product_id", null)
        .eq("ignored", false)
        .eq("active", true)
        .range(from, to),
    "supplier_offers.unmapped",
  );
  log(`oferty bez mapowania: ${unmapped.length}`);

  const assignments: Assignment[] = [];
  let remaining = unmapped;

  // 6.0 Istniejące mapowania (ręczne / z poprzednich przebiegów).
  if (remaining.length) {
    const mappings = await selectAll<MappingRow>(
      (from, to) =>
        admin.from("product_mappings").select("supplier_sku, product_id").eq("supplier_id", supplier.id).range(from, to),
      "product_mappings",
    );
    const bySku = new Map(mappings.map((m) => [m.supplier_sku, m.product_id]));
    remaining = remaining.filter((o) => {
      const pid = bySku.get(o.supplier_sku);
      if (!pid) return true;
      assignments.push({ offerId: o.id, supplierSku: o.supplier_sku, productId: pid, matchedBy: null });
      return false;
    });
  }

  // 6a. Po EAN.
  if (remaining.length) {
    const eans = [...new Set(remaining.map((o) => normalizeEan(o.ean)).filter((e): e is string => e !== null))];
    const productByEan = new Map<string, string>();
    for (const batch of chunk(eans, LOOKUP_BATCH)) {
      const { data, error } = await admin.from("products").select("id, ean").in("ean", batch);
      assertNoError(error, "products.byEan");
      for (const p of (data ?? []) as Array<{ id: string; ean: string | null }>) {
        if (p.ean && !productByEan.has(p.ean)) productByEan.set(p.ean, p.id);
      }
    }
    remaining = remaining.filter((o) => {
      const ean = normalizeEan(o.ean);
      const pid = ean ? productByEan.get(ean) : undefined;
      if (!pid) return true;
      assignments.push({ offerId: o.id, supplierSku: o.supplier_sku, productId: pid, matchedBy: "ean" });
      return false;
    });
  }

  // 6b. Po SKU (dokładnie albo po zdjęciu prefiksu `${CODE}-`).
  if (remaining.length) {
    const candidates = new Set<string>();
    for (const o of remaining) {
      candidates.add(o.supplier_sku);
      candidates.add(stripSupplierPrefix(supplier.code, o.supplier_sku));
    }
    const productBySku = await lookupProductsBySku(admin, [...candidates]);
    remaining = remaining.filter((o) => {
      const pid = productBySku.get(o.supplier_sku) ??
        productBySku.get(stripSupplierPrefix(supplier.code, o.supplier_sku));
      if (!pid) return true;
      assignments.push({ offerId: o.id, supplierSku: o.supplier_sku, productId: pid, matchedBy: "sku" });
      return false;
    });
  }

  // 6c. Auto-create (status 'hidden' do przeglądu w adminie).
  if (remaining.length && autoCreateEnabled(supplier.feed_config)) {
    stats.products_created = await autoCreateProducts(admin, supplier, remaining, validBySku, assignments, pushError);
    remaining = [];
  }

  // 6d. Zapis przypisań: supplier_offers.product_id (grupowane po produkcie) + product_mappings.
  if (assignments.length) {
    const offersByProduct = new Map<string, string[]>();
    for (const a of assignments) {
      const list = offersByProduct.get(a.productId) ?? [];
      list.push(a.offerId);
      offersByProduct.set(a.productId, list);
      affectedProductIds.add(a.productId);
    }
    for (const [productId, offerIds] of offersByProduct) {
      for (const batch of chunk(offerIds, LOOKUP_BATCH)) {
        const { error } = await admin.from("supplier_offers").update({ product_id: productId }).in("id", batch);
        assertNoError(error, "supplier_offers.assign");
      }
    }
    const mappingRows = assignments
      .filter((a): a is Assignment & { matchedBy: MatchedBy } => a.matchedBy !== null)
      .map((a) => ({
        supplier_id: supplier.id,
        supplier_sku: a.supplierSku,
        product_id: a.productId,
        matched_by: a.matchedBy,
      }));
    for (const batch of chunk(mappingRows, UPSERT_BATCH)) {
      const { error } = await admin
        .from("product_mappings")
        .upsert(batch, { onConflict: "supplier_id,supplier_sku", ignoreDuplicates: true });
      assertNoError(error, "product_mappings.upsert");
    }
    stats.items_mapped = assignments.length;
    log(`zmapowano ${assignments.length} ofert`);
  }

  // 7. recalc_products dla dotkniętych produktów ------------------------------------
  const productIds = [...affectedProductIds];
  for (const batch of chunk(productIds, RECALC_BATCH)) {
    const { error } = await admin.rpc("recalc_products", { p_ids: batch });
    assertNoError(error, "recalc_products");
  }
  stats.products_recalculated = productIds.length;
  log(`przeliczono ${productIds.length} produktów`);

  // 8. Ile zostało bez mapowania ----------------------------------------------------
  const { count, error: countError } = await admin
    .from("supplier_offers")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplier.id)
    .is("product_id", null)
    .eq("ignored", false)
    .eq("active", true);
  assertNoError(countError, "supplier_offers.countUnmapped");
  stats.items_unmapped = count ?? 0;

  return stats;
}

/**
 * Tworzy produkty (status 'hidden') dla ofert bez dopasowania. Jeśli SKU już istnieje —
 * używa istniejącego produktu. Zwraca liczbę utworzonych produktów.
 */
async function autoCreateProducts(
  admin: AdminClient,
  supplier: SupplierRow,
  offers: UnmappedOfferRow[],
  validBySku: Map<string, SupplierOfferValidated>,
  assignments: Assignment[],
  pushError: (e: SyncError) => void,
): Promise<number> {
  // SKU już zajęte → użyj istniejącego produktu.
  const desiredSku = new Map(offers.map((o) => [o.id, makeSku(supplier.code, o.supplier_sku)]));
  const takenSku = await lookupProductsBySku(admin, [...new Set(desiredSku.values())]);
  const toCreate = offers.filter((o) => {
    const pid = takenSku.get(desiredSku.get(o.id) ?? "");
    if (!pid) return true;
    assignments.push({ offerId: o.id, supplierSku: o.supplier_sku, productId: pid, matchedBy: "sku" });
    return false;
  });
  if (toCreate.length === 0) return 0;

  // Słowniki: marki, kategorie.
  const brands = await selectAll<IdSlugRow>(
    (from, to) => admin.from("brands").select("id, slug").range(from, to),
    "brands",
  );
  const brandIdBySlug = new Map(brands.map((b) => [b.slug, b.id]));
  const categories = await selectAll<IdSlugRow>(
    (from, to) => admin.from("categories").select("id, slug").range(from, to),
    "categories",
  );
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  // Brakujące marki — jedna wstawka (upsert po slug, bez nadpisywania nazw).
  const missingBrands = new Map<string, string>(); // slug → name
  for (const o of toCreate) {
    const brand = extractBrand(o.name_raw, o.brand_raw);
    if (!brand) continue;
    const slug = slugify(brand);
    if (slug && !brandIdBySlug.has(slug) && !missingBrands.has(slug)) missingBrands.set(slug, brand);
  }
  if (missingBrands.size) {
    const rows = [...missingBrands].map(([slug, name]) => ({ slug, name }));
    const { data, error } = await admin
      .from("brands")
      .upsert(rows, { onConflict: "slug", ignoreDuplicates: true })
      .select("id, slug");
    assertNoError(error, "brands.upsert");
    for (const b of (data ?? []) as IdSlugRow[]) brandIdBySlug.set(b.slug, b.id);
    // ignoreDuplicates nie zwraca wierszy pominiętych — doczytaj brakujące.
    const stillMissing = [...missingBrands.keys()].filter((slug) => !brandIdBySlug.has(slug));
    if (stillMissing.length) {
      const { data: more, error: moreError } = await admin.from("brands").select("id, slug").in("slug", stillMissing);
      assertNoError(moreError, "brands.reload");
      for (const b of (more ?? []) as IdSlugRow[]) brandIdBySlug.set(b.slug, b.id);
    }
  }

  // Zajęte slugi produktów (dla kandydatów).
  const baseSlugOf = (o: UnmappedOfferRow): string => slugify(o.name_raw) || slugify(desiredSku.get(o.id) ?? "") || "produkt";
  const baseSlugs = [...new Set(toCreate.map(baseSlugOf))];
  const takenSlugs = new Set<string>();
  for (const batch of chunk(baseSlugs, LOOKUP_BATCH)) {
    const { data, error } = await admin.from("products").select("slug").in("slug", batch);
    assertNoError(error, "products.bySlug");
    for (const p of (data ?? []) as Array<{ slug: string }>) takenSlugs.add(p.slug);
  }
  const uniqueSlug = (base: string, sku: string): string => {
    if (!takenSlugs.has(base)) {
      takenSlugs.add(base);
      return base;
    }
    const suffix = slugify(sku).slice(-8) || "x";
    let candidate = `${base}-${suffix}`;
    let n = 2;
    while (takenSlugs.has(candidate)) candidate = `${base}-${suffix}-${n++}`;
    takenSlugs.add(candidate);
    return candidate;
  };

  // Budowa wierszy products.
  interface ProductInsert {
    sku: string;
    slug: string;
    name: string;
    ean: string | null;
    brand_id: string | null;
    category_id: string | null;
    attributes: Record<string, string | number | boolean>;
    images: string[];
    documents: Array<{ name: string; url: string; type: string }>;
    weight_kg: number | null;
    status: "hidden";
  }
  const inserts: Array<{ offer: UnmappedOfferRow; row: ProductInsert }> = [];
  for (const o of toCreate) {
    const sku = desiredSku.get(o.id) ?? makeSku(supplier.code, o.supplier_sku);
    const feedOffer = validBySku.get(o.supplier_sku);
    const attributes = normalizeAttributes(feedOffer?.attributes ?? null);
    let weightKg: number | null = null;
    const attrWeight = attributes.weight_kg;
    if (typeof attrWeight === "number") weightKg = attrWeight;
    delete attributes.weight_kg;
    if (weightKg === null) weightKg = rawWeightKg(feedOffer?.raw ?? o.raw);

    const brand = extractBrand(o.name_raw, o.brand_raw);
    const categorySlug = mapCategory(o.category_path);
    inserts.push({
      offer: o,
      row: {
        sku,
        slug: uniqueSlug(baseSlugOf(o), sku),
        name: o.name_raw,
        ean: normalizeEan(o.ean),
        brand_id: brand ? brandIdBySlug.get(slugify(brand)) ?? null : null,
        category_id: categorySlug ? categoryIdBySlug.get(categorySlug) ?? null : null,
        attributes,
        images: feedOffer?.images ?? [],
        documents: (feedOffer?.documents ?? []).map((d) => ({ name: d.name, url: d.url, type: documentType(d.name) })),
        weight_kg: weightKg,
        status: "hidden",
      },
    });
  }

  let created = 0;
  for (const batch of chunk(inserts, INSERT_BATCH)) {
    const { data, error } = await admin
      .from("products")
      .insert(batch.map((b) => b.row))
      .select("id, sku");
    if (error) {
      // Nie przerywamy runu — paczka trafia do błędów, oferty zostają do ręcznego mapowania.
      console.error(`[sync:${supplier.code}] products.insert:`, error.message);
      pushError({ index: -1, message: `auto-create (${batch.length} produktów): ${error.message}` });
      continue;
    }
    const idBySku = new Map(((data ?? []) as Array<{ id: string; sku: string }>).map((p) => [p.sku, p.id]));
    for (const b of batch) {
      const pid = idBySku.get(b.row.sku);
      if (!pid) continue;
      created++;
      assignments.push({ offerId: b.offer.id, supplierSku: b.offer.supplier_sku, productId: pid, matchedBy: "auto_create" });
    }
  }
  console.log(`[sync:${supplier.code}] auto-create: ${created} produktów (hidden)`);
  return created;
}

// ---------------------------------------------------------------------------
// Handler HTTP
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Dozwolona jest tylko metoda POST.");
    }

    const admin = createAdminClient();
    const caller = await getCaller(req, admin);
    requireAdmin(caller);

    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new HttpError(400, `Nieprawidłowe dane: ${parsed.error.issues[0]?.message ?? "błąd walidacji"}`, "VALIDATION");
    }
    const { supplierCode, source } = parsed.data;

    const { data: supplierData, error: supplierError } = await admin
      .from("suppliers")
      .select("id, code, name, active, feed_config")
      .eq("code", supplierCode)
      .maybeSingle();
    assertNoError(supplierError, "suppliers");
    const supplier = (supplierData ?? null) as SupplierRow | null;
    if (!supplier) {
      throw new HttpError(404, `Hurtownia „${supplierCode}” nie istnieje.`, "SUPPLIER_NOT_FOUND");
    }
    if (!supplier.active && source === "cron") {
      return jsonResponse({ skipped: true, reason: "inactive", supplierCode });
    }

    const adapter = ADAPTERS[supplier.code];
    if (!adapter) {
      throw new HttpError(400, `Brak adaptera dla hurtowni „${supplier.code}”.`, "NO_ADAPTER");
    }

    const { data: runData, error: runError } = await admin
      .from("sync_runs")
      .insert({ supplier_id: supplier.id, status: "running" })
      .select("id")
      .single();
    assertNoError(runError, "sync_runs.insert");
    const runId = (runData as { id: string }).id;
    await updateSupplier(admin, supplier.id, { last_sync_status: "running" });

    try {
      const stats = await runSync(admin, supplier, adapter);
      const logText = summaryLog(stats);
      await finishRun(admin, runId, {
        status: "ok",
        items_total: stats.items_total,
        items_new: stats.items_new,
        items_updated: stats.items_updated,
        items_unmapped: stats.items_unmapped,
        errors: stats.errors,
      });
      await updateSupplier(admin, supplier.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_status: "ok",
        last_sync_log: logText,
      });
      console.log(`[sync:${supplier.code}] OK — ${logText}`);
      return jsonResponse({
        status: "ok",
        run: {
          id: runId,
          items_total: stats.items_total,
          items_new: stats.items_new,
          items_updated: stats.items_updated,
          items_unmapped: stats.items_unmapped,
          items_deactivated: stats.items_deactivated,
          products_created: stats.products_created,
          errors_count: stats.errors.length,
        },
      });
    } catch (err) {
      if (err instanceof NotConfiguredError) {
        await finishRun(admin, runId, { status: "not_configured", errors: [{ index: -1, message: err.message }] });
        await updateSupplier(admin, supplier.id, {
          last_sync_at: new Date().toISOString(),
          last_sync_status: "not_configured",
          last_sync_log: err.message,
        });
        console.warn(`[sync:${supplier.code}] ${err.message}`);
        return jsonResponse({ status: "not_configured", message: err.message, run: { id: runId } });
      }

      const message = errorMessage(err);
      console.error(`[sync:${supplier.code}] FAILED:`, err);
      await finishRun(admin, runId, { status: "failed", errors: [{ index: -1, message }] });
      await updateSupplier(admin, supplier.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_status: "failed",
        last_sync_log: `Błąd: ${message}`.slice(0, 2000),
      });

      const adminEmail = Deno.env.get("ADMIN_EMAIL");
      if (adminEmail) {
        const mail = syncFailedAdmin(supplier.name, message);
        await sendEmail({ to: adminEmail, subject: mail.subject, html: mail.html, text: mail.text });
      }
      return errorResponse(
        `Synchronizacja hurtowni „${supplier.name}” nie powiodła się: ${message}`,
        500,
        "SYNC_FAILED",
      );
    }
  } catch (err) {
    return errorToResponse(err, "sync-supplier");
  }
});
