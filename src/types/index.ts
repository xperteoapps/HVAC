import type { Database, Json } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

export type Category = Row<"categories">;
export type Brand = Row<"brands">;
export type Product = Row<"products">;
export type AttributeDef = Row<"product_attributes_def">;
export type Supplier = Row<"suppliers">;
export type SupplierOffer = Row<"supplier_offers">;
export type SyncRun = Row<"sync_runs">;
export type MarginRule = Row<"margin_rules">;
export type CustomerGroup = Row<"customer_groups">;
export type Profile = Row<"profiles">;
export type Address = Row<"addresses">;
export type ShippingMethod = Row<"shipping_methods">;
export type Order = Row<"orders">;
export type OrderItem = Row<"order_items">;
export type OrderEvent = Row<"order_events">;
export type StaticPage = Row<"static_pages">;

export type StockStatus = "in_stock" | "low" | "on_order" | "unavailable";
export type ProductStatus = "active" | "hidden" | "discontinued";
export type OrderStatus =
  | "new"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface ProductDocument {
  name: string;
  url: string;
  type?: "karta" | "instrukcja" | "deklaracja" | string;
}

export type ProductAttributes = Record<string, string | number | boolean | null>;

export interface ProductWithRelations extends Product {
  brand?: Pick<Brand, "id" | "slug" | "name"> | null;
  category?: Pick<Category, "id" | "slug" | "name" | "parent_id"> | null;
}

export type ProductListItem = Pick<
  Product,
  | "id"
  | "sku"
  | "slug"
  | "name"
  | "brand_id"
  | "category_id"
  | "images"
  | "price_net_cents"
  | "price_gross_cents"
  | "vat_rate"
  | "stock_status"
  | "stock_total"
  | "lead_time_days"
  | "attributes"
  | "weight_kg"
  | "pallet_required"
> & { brand?: Pick<Brand, "id" | "slug" | "name"> | null };

export interface CategoryNode extends Category {
  children: CategoryNode[];
  product_count: number;
}

export interface ProfileWithGroup extends Profile {
  customer_group?: Pick<CustomerGroup, "code" | "name" | "discount_pct" | "price_mode"> | null;
}

export interface ShippingOption {
  code: string;
  name: string;
  carrier: string | null;
  description: string | null;
  price_net_cents: number;
  price_gross_cents: number;
  free: boolean;
  pallet: boolean;
  pickup: boolean;
}

export interface ShippingCalcResult {
  needsPallet: boolean;
  totalWeightKg: number;
  options: ShippingOption[];
  subtotal_net_cents: number;
  subtotal_gross_cents: number;
  /** Dostawcy płatności włączeni po stronie serwera, np. ['manual','imoje'] */
  payment_providers?: string[];
}

export interface AddressJson {
  full_name: string;
  company_name?: string;
  nip?: string;
  street: string;
  building_no: string;
  apartment_no?: string;
  postal_code: string;
  city: string;
  country: string;
  phone?: string;
}

export interface CreatedOrder {
  order: {
    id: string;
    number: string;
    status: OrderStatus;
    payment_status: string;
    total_gross_cents: number;
    subtotal_net_cents: number;
    vat_cents: number;
    shipping_net_cents: number;
    shipping_method: string | null;
    price_mode: "gross" | "net";
    email: string;
    payment_due_date: string | null;
    created_at: string;
  };
  items: Array<{ sku: string; name: string; qty: number; price_net_cents: number; vat_rate: number }>;
  payment: { provider?: string; instructions?: string | null; redirectUrl?: string | null; warning?: string | null };
}

export function asAttributes(json: Json | null | undefined): ProductAttributes {
  if (json && typeof json === "object" && !Array.isArray(json)) return json as ProductAttributes;
  return {};
}

export function asDocuments(json: Json | null | undefined): ProductDocument[] {
  if (Array.isArray(json)) return json as unknown as ProductDocument[];
  return [];
}

export function asAddress(json: Json | null | undefined): AddressJson | null {
  if (json && typeof json === "object" && !Array.isArray(json)) return json as unknown as AddressJson;
  return null;
}
