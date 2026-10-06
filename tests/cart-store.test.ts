import { beforeEach, describe, expect, it } from "vitest";
import { MAX_QTY, selectCartCount, useCartStore } from "@/lib/cart-store";

const item = {
  product_id: "p1",
  sku: "SKU-1",
  slug: "sku-1",
  name: "Produkt",
  image: null,
  price_net_cents: 1000,
  price_gross_cents: 1230,
  vat_rate: 23,
  weight_kg: 1,
  pallet_required: false,
  stock_status: "in_stock",
  stock_total: 10,
};

describe("cart-store", () => {
  beforeEach(() => useCartStore.getState().clear());

  it("dodaje, sumuje ilości i otwiera drawer", () => {
    useCartStore.getState().addItem(item, 2);
    useCartStore.getState().addItem(item, 3);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(selectCartCount(useCartStore.getState())).toBe(5);
    expect(useCartStore.getState().isOpen).toBe(true);
  });

  it("ogranicza ilość do MAX_QTY i usuwa przy qty 0", () => {
    useCartStore.getState().addItem(item, 5000);
    expect(useCartStore.getState().items[0].qty).toBe(MAX_QTY);
    useCartStore.getState().updateQty("p1", 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("odświeża snapshot cen", () => {
    useCartStore.getState().addItem(item, 1);
    useCartStore.getState().refreshItems([{ product_id: "p1", price_net_cents: 900, stock_status: "low" }]);
    expect(useCartStore.getState().items[0].price_net_cents).toBe(900);
    expect(useCartStore.getState().items[0].stock_status).toBe("low");
  });
});
