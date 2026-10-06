import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProductListItem, ProductWithRelations } from "@/types";

export const PRODUCT_LIST_COLUMNS =
  "id, sku, slug, name, brand_id, category_id, images, price_net_cents, price_gross_cents, vat_rate, stock_status, stock_total, lead_time_days, attributes, weight_kg, pallet_required, brand:brands(id, slug, name)";

export type SortKey = "relevance" | "price_asc" | "price_desc" | "name_asc" | "newest";

export interface ProductFilters {
  categoryId?: string | null;
  categoryIds?: string[];
  brandSlugs?: string[];
  /** klucz atrybutu → lista wartości (select) */
  attrValues?: Record<string, string[]>;
  /** klucz atrybutu → [min, max] (number) */
  attrRanges?: Record<string, [number | null, number | null]>;
  priceMin?: number | null; // grosze brutto
  priceMax?: number | null;
  availability?: "in_stock" | "on_order" | null;
  wifi?: boolean;
  search?: string | null;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Trafność",
  price_asc: "Cena rosnąco",
  price_desc: "Cena malejąco",
  name_asc: "Nazwa A–Z",
  newest: "Najnowsze",
};

export function useProducts(filters: ProductFilters, brandIdsBySlug?: Record<string, string>) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;
  return useQuery({
    queryKey: ["products", filters, brandIdsBySlug],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let searchIds: string[] | null = null;
      if (filters.search) {
        const { data, error } = await supabase.rpc("search_products", { p_query: filters.search, lim: 500, off: 0 });
        if (error) throw error;
        searchIds = (data ?? []).map((r) => r.id);
        if (searchIds.length === 0) return { items: [] as ProductListItem[], total: 0, page, pageSize };
      }

      let q = supabase.from("products").select(PRODUCT_LIST_COLUMNS, { count: "exact" }).eq("status", "active");

      if (filters.categoryIds && filters.categoryIds.length) q = q.in("category_id", filters.categoryIds);
      else if (filters.categoryId) q = q.eq("category_id", filters.categoryId);

      if (searchIds) q = q.in("id", searchIds);

      if (filters.brandSlugs?.length && brandIdsBySlug) {
        const ids = filters.brandSlugs.map((s) => brandIdsBySlug[s]).filter(Boolean);
        if (ids.length) q = q.in("brand_id", ids);
      }

      for (const [key, values] of Object.entries(filters.attrValues ?? {})) {
        if (values.length) q = q.in(`attributes->>${key}`, values);
      }
      for (const [key, [min, max]] of Object.entries(filters.attrRanges ?? {})) {
        if (min !== null && min !== undefined) q = q.gte(`attributes->${key}`, min);
        if (max !== null && max !== undefined) q = q.lte(`attributes->${key}`, max);
      }
      if (filters.wifi) q = q.eq("attributes->wifi", true);
      if (filters.priceMin) q = q.gte("price_gross_cents", filters.priceMin);
      if (filters.priceMax) q = q.lte("price_gross_cents", filters.priceMax);
      if (filters.availability === "in_stock") q = q.in("stock_status", ["in_stock", "low"]);
      if (filters.availability === "on_order") q = q.eq("stock_status", "on_order");

      switch (filters.sort ?? "relevance") {
        case "price_asc":
          q = q.order("price_gross_cents", { ascending: true, nullsFirst: false });
          break;
        case "price_desc":
          q = q.order("price_gross_cents", { ascending: false, nullsFirst: false });
          break;
        case "name_asc":
          q = q.order("name", { ascending: true });
          break;
        case "newest":
          q = q.order("created_at", { ascending: false });
          break;
        default:
          // trafność: dostępne najpierw, potem wyróżnione, potem nazwa
          q = q.order("stock_status", { ascending: true }).order("featured", { ascending: false }).order("name");
      }

      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      let items = (data ?? []) as unknown as ProductListItem[];
      if (searchIds && (filters.sort ?? "relevance") === "relevance") {
        const rank = new Map(searchIds.map((id, i) => [id, i]));
        items = [...items].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
      }
      return { items, total: count ?? 0, page, pageSize };
    },
  });
}

export function useFacets(categoryId: string | null | undefined, search?: string | null) {
  return useQuery({
    queryKey: ["facets", categoryId ?? null, search ?? null],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("product_facets", {
        p_category_id: categoryId ?? undefined,
        p_search: search || undefined,
      });
      if (error) throw error;
      return data as unknown as Facets;
    },
  });
}

export interface Facets {
  attributes: Array<{
    key: string;
    label: string;
    unit: string | null;
    type: "number" | "text" | "boolean" | "select";
    values: Array<{ value: string; count: number }>;
  }>;
  brands: Array<{ id: string; slug: string; name: string; count: number }>;
  price_min: number | null;
  price_max: number | null;
  total: number;
  availability: { in_stock: number; on_order: number };
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ["product", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, brand:brands(id, slug, name), category:categories(id, slug, name, parent_id)")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ProductWithRelations | null) ?? null;
    },
  });
}

export function useRelatedProducts(productId: string | undefined) {
  return useQuery({
    queryKey: ["related", productId],
    enabled: Boolean(productId),
    queryFn: async () => {
      const { data: rel, error } = await supabase
        .from("product_relations")
        .select("related_product_id, relation_type, position")
        .eq("product_id", productId!)
        .order("position");
      if (error) throw error;
      const ids = (rel ?? []).map((r) => r.related_product_id);
      if (!ids.length) return [] as Array<ProductListItem & { relation_type: string }>;
      const { data, error: pErr } = await supabase.from("products").select(PRODUCT_LIST_COLUMNS).in("id", ids).eq("status", "active");
      if (pErr) throw pErr;
      const typeById = new Map(rel!.map((r) => [r.related_product_id, r.relation_type]));
      return ((data ?? []) as unknown as ProductListItem[]).map((p) => ({ ...p, relation_type: typeById.get(p.id) ?? "accessory" }));
    },
  });
}

export function useFeaturedProducts(limit = 8) {
  return useQuery({
    queryKey: ["featured", limit],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_LIST_COLUMNS)
        .eq("status", "active")
        .eq("featured", true)
        .order("name")
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as ProductListItem[];
    },
  });
}

export function useProductsByIds(ids: string[]) {
  return useQuery({
    queryKey: ["products-by-ids", [...ids].sort()],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_LIST_COLUMNS).in("id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as ProductListItem[];
    },
  });
}

export function useSearchSuggestions(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["suggest", q],
    enabled: q.length >= 2,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_products", { p_query: q, lim: 6, off: 0 });
      if (error) throw error;
      return data ?? [];
    },
  });
}
