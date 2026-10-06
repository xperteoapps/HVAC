import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore, type CartItem } from "@/lib/cart-store";
import { useAuth } from "./useAuth";
import { PRODUCT_LIST_COLUMNS } from "./useProducts";
import type { ProductListItem } from "@/types";

/**
 * Synchronizacja koszyka z DB dla zalogowanych:
 * - po zalogowaniu: scal koszyk lokalny z koszykiem z DB (suma ilości),
 * - każda zmiana lokalna → upsert do cart_items,
 * - przy starcie odśwież snapshot cen/stanów z products.
 */
export function useCartSync() {
  const { user } = useAuth();
  const items = useCartStore((s) => s.items);
  const replaceItems = useCartStore((s) => s.replaceItems);
  const refreshItems = useCartStore((s) => s.refreshItems);
  const mergedForUser = useRef<string | null>(null);
  const syncing = useRef(false);

  // 1. Odświeżenie snapshotu cen po załadowaniu aplikacji
  useEffect(() => {
    const ids = useCartStore.getState().items.map((i) => i.product_id);
    if (!ids.length) return;
    supabase
      .from("products")
      .select(PRODUCT_LIST_COLUMNS)
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const fresh = (data as unknown as ProductListItem[]).map(toCartPatch);
        refreshItems(fresh);
        // produkty niedostępne/ukryte zostają w koszyku z oznaczeniem — usuwa je checkout
      });
  }, [refreshItems]);

  // 2. Scalanie przy logowaniu
  useEffect(() => {
    if (!user || mergedForUser.current === user.id) return;
    mergedForUser.current = user.id;
    (async () => {
      syncing.current = true;
      try {
        const { data: cart } = await supabase.from("carts").select("id").eq("profile_id", user.id).maybeSingle();
        let cartId = cart?.id;
        if (!cartId) {
          const { data: created, error } = await supabase.from("carts").insert({ profile_id: user.id }).select("id").single();
          if (error) throw error;
          cartId = created.id;
        }
        const { data: dbItems } = await supabase.from("cart_items").select("product_id, qty").eq("cart_id", cartId);
        const local = useCartStore.getState().items;
        const merged = new Map<string, number>();
        for (const i of local) merged.set(i.product_id, i.qty);
        for (const i of dbItems ?? []) merged.set(i.product_id, (merged.get(i.product_id) ?? 0) + i.qty);
        const ids = [...merged.keys()];
        if (ids.length) {
          const { data: products } = await supabase.from("products").select(PRODUCT_LIST_COLUMNS).in("id", ids).eq("status", "active");
          const next: CartItem[] = ((products ?? []) as unknown as ProductListItem[])
            .filter((p) => p.price_net_cents !== null)
            .map((p) => ({ ...toCartItem(p), qty: merged.get(p.id) ?? 1 }));
          replaceItems(next);
          await writeCart(cartId, next);
        }
      } catch (e) {
        console.error("Synchronizacja koszyka nie powiodła się", e);
      } finally {
        syncing.current = false;
      }
    })();
  }, [user, replaceItems]);

  // 3. Zapis zmian lokalnych do DB
  useEffect(() => {
    if (!user || syncing.current || mergedForUser.current !== user.id) return;
    const t = setTimeout(async () => {
      const { data: cart } = await supabase.from("carts").select("id").eq("profile_id", user.id).maybeSingle();
      if (cart?.id) await writeCart(cart.id, items);
    }, 600);
    return () => clearTimeout(t);
  }, [items, user]);
}

async function writeCart(cartId: string, items: CartItem[]) {
  await supabase.from("cart_items").delete().eq("cart_id", cartId);
  if (items.length) {
    await supabase.from("cart_items").insert(
      items.map((i) => ({ cart_id: cartId, product_id: i.product_id, qty: i.qty, price_net_cents_snapshot: i.price_net_cents })),
    );
  }
}

export function toCartItem(p: ProductListItem): Omit<CartItem, "qty"> {
  return {
    product_id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    image: p.images?.[0] ?? null,
    price_net_cents: p.price_net_cents ?? 0,
    price_gross_cents: p.price_gross_cents ?? 0,
    vat_rate: Number(p.vat_rate ?? 23),
    weight_kg: p.weight_kg === null ? null : Number(p.weight_kg),
    pallet_required: p.pallet_required,
    stock_status: p.stock_status,
    stock_total: p.stock_total,
  };
}

function toCartPatch(p: ProductListItem): Pick<CartItem, "product_id"> & Partial<CartItem> {
  return toCartItem(p);
}
