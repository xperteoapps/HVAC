
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "addresses": {
                  Row: {
                    "apartment_no": string | null,"building_no": string,"city": string,"company_name": string | null,"country": string,"created_at": string,"full_name": string,"id": string,"is_default": boolean,"nip": string | null,"phone": string | null,"postal_code": string,"profile_id": string,"street": string,"type": string,"updated_at": string
                  }
                  Insert: {
                    "apartment_no"?: string | null,"building_no": string,"city": string,"company_name"?: string | null,"country"?: string,"created_at"?: string,"full_name": string,"id"?: string,"is_default"?: boolean,"nip"?: string | null,"phone"?: string | null,"postal_code": string,"profile_id": string,"street": string,"type"?: string,"updated_at"?: string
                  }
                  Update: {
                    "apartment_no"?: string | null,"building_no"?: string,"city"?: string,"company_name"?: string | null,"country"?: string,"created_at"?: string,"full_name"?: string,"id"?: string,"is_default"?: boolean,"nip"?: string | null,"phone"?: string | null,"postal_code"?: string,"profile_id"?: string,"street"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"brands": {
                  Row: {
                    "created_at": string,"id": string,"logo_url": string | null,"name": string,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"logo_url"?: string | null,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"logo_url"?: string | null,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "cart_id": string,"created_at": string,"id": string,"price_net_cents_snapshot": number | null,"product_id": string,"qty": number,"updated_at": string
                  }
                  Insert: {
                    "cart_id": string,"created_at"?: string,"id"?: string,"price_net_cents_snapshot"?: number | null,"product_id": string,"qty": number,"updated_at"?: string
                  }
                  Update: {
                    "cart_id"?: string,"created_at"?: string,"id"?: string,"price_net_cents_snapshot"?: number | null,"product_id"?: string,"qty"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_cart_id_fkey"
      columns: ["cart_id"]
isOneToOne: false
      referencedRelation: "carts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"carts": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"profile_id": string | null,"session_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"profile_id"?: string | null,"session_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"profile_id"?: string | null,"session_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "carts_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"image_url": string | null,"name": string,"parent_id": string | null,"position": number,"seo_description": string | null,"seo_title": string | null,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"name": string,"parent_id"?: string | null,"position"?: number,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"name"?: string,"parent_id"?: string | null,"position"?: number,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_groups": {
                  Row: {
                    "code": string,"created_at": string,"discount_pct": number,"id": string,"name": string,"price_mode": string,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"discount_pct"?: number,"id"?: string,"name": string,"price_mode"?: string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"discount_pct"?: number,"id"?: string,"name"?: string,"price_mode"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"margin_rules": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"margin_pct": number,"min_margin_cents": number,"name": string | null,"priority": number,"scope": string,"scope_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"margin_pct"?: number,"min_margin_cents"?: number,"name"?: string | null,"priority"?: number,"scope": string,"scope_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"margin_pct"?: number,"min_margin_cents"?: number,"name"?: string | null,"priority"?: number,"scope"?: string,"scope_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"order_counters": {
                  Row: {
                    "last_number": number,"year": number
                  }
                  Insert: {
                    "last_number"?: number,"year": number
                  }
                  Update: {
                    "last_number"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"order_events": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"order_id": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"order_id": string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"order_id"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "created_at": string,"id": string,"image_url": string | null,"name": string,"order_id": string,"price_net_cents": number,"product_id": string | null,"qty": number,"sku": string,"supplier_id": string | null,"supplier_sku": string | null,"updated_at": string,"vat_rate": number
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_url"?: string | null,"name": string,"order_id": string,"price_net_cents": number,"product_id"?: string | null,"qty": number,"sku": string,"supplier_id"?: string | null,"supplier_sku"?: string | null,"updated_at"?: string,"vat_rate"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_url"?: string | null,"name"?: string,"order_id"?: string,"price_net_cents"?: number,"product_id"?: string | null,"qty"?: number,"sku"?: string,"supplier_id"?: string | null,"supplier_sku"?: string | null,"updated_at"?: string,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "admin_notes": string | null,"billing_address": Json | null,"carrier": string | null,"created_at": string,"customer_group_code": string,"discount_pct": number,"email": string,"id": string,"invoice_requested": boolean,"nip": string | null,"notes": string | null,"number": string,"payment_due_date": string | null,"payment_provider": string,"payment_ref": string | null,"payment_status": string,"phone": string | null,"price_mode": string,"profile_id": string | null,"shipping_address": NonNullable<Json>,"shipping_method": string | null,"shipping_net_cents": number,"status": string,"subtotal_net_cents": number,"total_gross_cents": number,"tracking_number": string | null,"updated_at": string,"vat_cents": number
                  }
                  Insert: {
                    "admin_notes"?: string | null,"billing_address"?: Json | null,"carrier"?: string | null,"created_at"?: string,"customer_group_code"?: string,"discount_pct"?: number,"email": string,"id"?: string,"invoice_requested"?: boolean,"nip"?: string | null,"notes"?: string | null,"number": string,"payment_due_date"?: string | null,"payment_provider"?: string,"payment_ref"?: string | null,"payment_status"?: string,"phone"?: string | null,"price_mode"?: string,"profile_id"?: string | null,"shipping_address"?: NonNullable<Json>,"shipping_method"?: string | null,"shipping_net_cents"?: number,"status"?: string,"subtotal_net_cents"?: number,"total_gross_cents"?: number,"tracking_number"?: string | null,"updated_at"?: string,"vat_cents"?: number
                  }
                  Update: {
                    "admin_notes"?: string | null,"billing_address"?: Json | null,"carrier"?: string | null,"created_at"?: string,"customer_group_code"?: string,"discount_pct"?: number,"email"?: string,"id"?: string,"invoice_requested"?: boolean,"nip"?: string | null,"notes"?: string | null,"number"?: string,"payment_due_date"?: string | null,"payment_provider"?: string,"payment_ref"?: string | null,"payment_status"?: string,"phone"?: string | null,"price_mode"?: string,"profile_id"?: string | null,"shipping_address"?: NonNullable<Json>,"shipping_method"?: string | null,"shipping_net_cents"?: number,"status"?: string,"subtotal_net_cents"?: number,"total_gross_cents"?: number,"tracking_number"?: string | null,"updated_at"?: string,"vat_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_attributes_def": {
                  Row: {
                    "category_ids": (string)[],"created_at": string,"filterable": boolean,"id": string,"key": string,"label": string,"position": number,"type": string,"unit": string | null,"updated_at": string
                  }
                  Insert: {
                    "category_ids"?: (string)[],"created_at"?: string,"filterable"?: boolean,"id"?: string,"key": string,"label": string,"position"?: number,"type"?: string,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category_ids"?: (string)[],"created_at"?: string,"filterable"?: boolean,"id"?: string,"key"?: string,"label"?: string,"position"?: number,"type"?: string,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_mappings": {
                  Row: {
                    "created_at": string,"id": string,"matched_by": string,"product_id": string,"supplier_id": string,"supplier_sku": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"matched_by"?: string,"product_id": string,"supplier_id": string,"supplier_sku": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"matched_by"?: string,"product_id"?: string,"supplier_id"?: string,"supplier_sku"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_mappings_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_mappings_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"product_relations": {
                  Row: {
                    "position": number,"product_id": string,"related_product_id": string,"relation_type": string
                  }
                  Insert: {
                    "position"?: number,"product_id": string,"related_product_id": string,"relation_type"?: string
                  }
                  Update: {
                    "position"?: number,"product_id"?: string,"related_product_id"?: string,"relation_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_relations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_relations_related_product_id_fkey"
      columns: ["related_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "attributes": NonNullable<Json>,"best_supplier_id": string | null,"brand_id": string | null,"category_id": string | null,"created_at": string,"description_html": string | null,"documents": NonNullable<Json>,"ean": string | null,"featured": boolean,"id": string,"images": (string)[],"lead_time_days": number | null,"name": string,"pallet_required": boolean,"price_gross_cents": number | null,"price_net_cents": number | null,"price_override_net_cents": number | null,"search_vector": unknown,"sku": string,"slug": string,"status": string,"stock_status": string,"stock_total": number,"updated_at": string,"vat_rate": number,"weight_kg": number | null
                  }
                  Insert: {
                    "attributes"?: NonNullable<Json>,"best_supplier_id"?: string | null,"brand_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"description_html"?: string | null,"documents"?: NonNullable<Json>,"ean"?: string | null,"featured"?: boolean,"id"?: string,"images"?: (string)[],"lead_time_days"?: number | null,"name": string,"pallet_required"?: boolean,"price_gross_cents"?: number | null,"price_net_cents"?: number | null,"price_override_net_cents"?: number | null,"search_vector"?: unknown,"sku": string,"slug": string,"status"?: string,"stock_status"?: string,"stock_total"?: number,"updated_at"?: string,"vat_rate"?: number,"weight_kg"?: number | null
                  }
                  Update: {
                    "attributes"?: NonNullable<Json>,"best_supplier_id"?: string | null,"brand_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"description_html"?: string | null,"documents"?: NonNullable<Json>,"ean"?: string | null,"featured"?: boolean,"id"?: string,"images"?: (string)[],"lead_time_days"?: number | null,"name"?: string,"pallet_required"?: boolean,"price_gross_cents"?: number | null,"price_net_cents"?: number | null,"price_override_net_cents"?: number | null,"search_vector"?: unknown,"sku"?: string,"slug"?: string,"status"?: string,"stock_status"?: string,"stock_total"?: number,"updated_at"?: string,"vat_rate"?: number,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_best_supplier_id_fkey"
      columns: ["best_supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "b2b_approved": boolean,"b2b_requested": boolean,"company_name": string | null,"created_at": string,"customer_group_id": string | null,"deferred_payment_allowed": boolean,"email": string,"full_name": string | null,"id": string,"nip": string | null,"phone": string | null,"role": string,"updated_at": string
                  }
                  Insert: {
                    "b2b_approved"?: boolean,"b2b_requested"?: boolean,"company_name"?: string | null,"created_at"?: string,"customer_group_id"?: string | null,"deferred_payment_allowed"?: boolean,"email": string,"full_name"?: string | null,"id": string,"nip"?: string | null,"phone"?: string | null,"role"?: string,"updated_at"?: string
                  }
                  Update: {
                    "b2b_approved"?: boolean,"b2b_requested"?: boolean,"company_name"?: string | null,"created_at"?: string,"customer_group_id"?: string | null,"deferred_payment_allowed"?: boolean,"email"?: string,"full_name"?: string | null,"id"?: string,"nip"?: string | null,"phone"?: string | null,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_customer_group_id_fkey"
      columns: ["customer_group_id"]
isOneToOne: false
      referencedRelation: "customer_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"shipping_methods": {
                  Row: {
                    "active": boolean,"carrier": string | null,"code": string,"created_at": string,"description": string | null,"free_from_cents": number | null,"free_from_cents_b2b": number | null,"id": string,"max_weight_kg": number | null,"name": string,"pallet": boolean,"pickup": boolean,"position": number,"price_net_cents": number,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"carrier"?: string | null,"code": string,"created_at"?: string,"description"?: string | null,"free_from_cents"?: number | null,"free_from_cents_b2b"?: number | null,"id"?: string,"max_weight_kg"?: number | null,"name": string,"pallet"?: boolean,"pickup"?: boolean,"position"?: number,"price_net_cents"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"carrier"?: string | null,"code"?: string,"created_at"?: string,"description"?: string | null,"free_from_cents"?: number | null,"free_from_cents_b2b"?: number | null,"id"?: string,"max_weight_kg"?: number | null,"name"?: string,"pallet"?: boolean,"pickup"?: boolean,"position"?: number,"price_net_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"static_pages": {
                  Row: {
                    "content_html": string,"created_at": string,"id": string,"position": number,"published": boolean,"seo_description": string | null,"seo_title": string | null,"slug": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "content_html"?: string,"created_at"?: string,"id"?: string,"position"?: number,"published"?: boolean,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "content_html"?: string,"created_at"?: string,"id"?: string,"position"?: number,"published"?: boolean,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"supplier_offers": {
                  Row: {
                    "active": boolean,"brand_raw": string | null,"category_path": (string)[] | null,"created_at": string,"ean": string | null,"fetched_at": string,"id": string,"ignored": boolean,"lead_time_days": number | null,"name_raw": string,"product_id": string | null,"purchase_net_cents": number,"raw": Json | null,"stock": number,"supplier_id": string,"supplier_sku": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"brand_raw"?: string | null,"category_path"?: (string)[] | null,"created_at"?: string,"ean"?: string | null,"fetched_at"?: string,"id"?: string,"ignored"?: boolean,"lead_time_days"?: number | null,"name_raw": string,"product_id"?: string | null,"purchase_net_cents": number,"raw"?: Json | null,"stock"?: number,"supplier_id": string,"supplier_sku": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"brand_raw"?: string | null,"category_path"?: (string)[] | null,"created_at"?: string,"ean"?: string | null,"fetched_at"?: string,"id"?: string,"ignored"?: boolean,"lead_time_days"?: number | null,"name_raw"?: string,"product_id"?: string | null,"purchase_net_cents"?: number,"raw"?: Json | null,"stock"?: number,"supplier_id"?: string,"supplier_sku"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_offers_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_offers_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"feed_config": NonNullable<Json>,"feed_type": string,"id": string,"last_sync_at": string | null,"last_sync_log": string | null,"last_sync_status": string | null,"name": string,"priority": number,"sync_interval_min": number,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"feed_config"?: NonNullable<Json>,"feed_type"?: string,"id"?: string,"last_sync_at"?: string | null,"last_sync_log"?: string | null,"last_sync_status"?: string | null,"name": string,"priority"?: number,"sync_interval_min"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"feed_config"?: NonNullable<Json>,"feed_type"?: string,"id"?: string,"last_sync_at"?: string | null,"last_sync_log"?: string | null,"last_sync_status"?: string | null,"name"?: string,"priority"?: number,"sync_interval_min"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sync_runs": {
                  Row: {
                    "created_at": string,"errors": NonNullable<Json>,"finished_at": string | null,"id": string,"items_new": number,"items_total": number,"items_unmapped": number,"items_updated": number,"started_at": string,"status": string,"supplier_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"errors"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: string,"items_new"?: number,"items_total"?: number,"items_unmapped"?: number,"items_updated"?: number,"started_at"?: string,"status"?: string,"supplier_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"errors"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: string,"items_new"?: number,"items_total"?: number,"items_unmapped"?: number,"items_updated"?: number,"started_at"?: string,"status"?: string,"supplier_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sync_runs_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"category_ancestors":
{ Args: { "p_category_id": string }; Returns: {
              "depth": number,"id": string
            }[]
                           },
"category_descendants":
{ Args: { "p_category_id": string }; Returns: string[]
                           },
"category_product_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_id": string,"product_count": number
            }[]
                           },
"cleanup_expired_carts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"f_unaccent":
{ Args: { "": string }; Returns: string
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"next_order_number":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"preview_margin_rule":
{ Args: { "p_margin_pct": number,"p_min_margin_cents": number,"p_scope": string,"p_scope_id": string }; Returns: {
              "current_price_net_cents": number,"name": string,"new_price_net_cents": number,"product_id": string,"purchase_net_cents": number,"sku": string
            }[]
                           },
"product_facets":
{ Args: { "p_category_id"?: string,"p_search"?: string }; Returns: Json
                           },
"recalc_all_products":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"recalc_product":
{ Args: { "p_product_id": string }; Returns: undefined
                           },
"recalc_products":
{ Args: { "p_ids": (string)[] }; Returns: number
                           },
"resolve_margin_rule":
{ Args: { "p_brand_id": string,"p_category_id": string,"p_product_id": string,"p_supplier_id": string }; Returns: {
              "margin_pct": number,"min_margin_cents": number
            }[]
                           },
"schedule_supplier_sync":
{ Args: { "p_code": string,"p_cron": string }; Returns: undefined
                           },
"search_products":
{ Args: { "lim"?: number,"off"?: number,"p_query": string }; Returns: {
              "attributes": Json,"brand_id": string,"category_id": string,"id": string,"images": (string)[],"lead_time_days": number,"name": string,"price_gross_cents": number,"price_net_cents": number,"rank": number,"sku": string,"slug": string,"stock_status": string,"stock_total": number,"total_count": number,"vat_rate": number
            }[]
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"unaccent":
{ Args: { "": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
