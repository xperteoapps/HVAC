import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Koszyk — zustand + localStorage (gość). Dla zalogowanego użytkownika
 * hook `useCartSync` scala i zapisuje pozycje do tabel carts/cart_items.
 * Ceny w koszyku to snapshot do prezentacji; create-order przelicza z DB.
 */
export interface CartItem {
  product_id: string;
  sku: string;
  slug: string;
  name: string;
  image: string | null;
  qty: number;
  price_net_cents: number;
  price_gross_cents: number;
  vat_rate: number;
  weight_kg: number | null;
  pallet_required: boolean;
  stock_status: string;
  stock_total: number;
}

interface CartState {
  items: CartItem[];
  sessionId: string;
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  updateQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  replaceItems: (items: CartItem[]) => void;
  /** Aktualizacja snapshotu cen/stanów po odświeżeniu danych z DB */
  refreshItems: (fresh: Array<Pick<CartItem, "product_id"> & Partial<CartItem>>) => void;
  setOpen: (open: boolean) => void;
}

function newSessionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const MAX_QTY = 999;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      sessionId: newSessionId(),
      isOpen: false,
      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.product_id === item.product_id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product_id === item.product_id ? { ...i, ...item, qty: Math.min(MAX_QTY, i.qty + qty) } : i,
              ),
              isOpen: true,
            };
          }
          return { items: [...state.items, { ...item, qty: Math.min(MAX_QTY, qty) }], isOpen: true };
        }),
      updateQty: (productId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.product_id !== productId)
              : state.items.map((i) => (i.product_id === productId ? { ...i, qty: Math.min(MAX_QTY, qty) } : i)),
        })),
      removeItem: (productId) => set((state) => ({ items: state.items.filter((i) => i.product_id !== productId) })),
      clear: () => set({ items: [] }),
      replaceItems: (items) => set({ items }),
      refreshItems: (fresh) =>
        set((state) => ({
          items: state.items.map((i) => {
            const f = fresh.find((x) => x.product_id === i.product_id);
            return f ? { ...i, ...f } : i;
          }),
        })),
      setOpen: (open) => set({ isOpen: open }),
    }),
    {
      name: "hvac-cart",
      version: 1,
      partialize: (state) => ({ items: state.items, sessionId: state.sessionId }),
    },
  ),
);

export const selectCartCount = (s: CartState) => s.items.reduce((acc, i) => acc + i.qty, 0);
