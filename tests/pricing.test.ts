import { describe, expect, it } from "vitest";
import { B2C_CONTEXT, cartTotals, displayPrice, grossCents, orderTotals, unitNetAfterDiscount, vatCents } from "@/lib/pricing";

describe("pricing", () => {
  it("liczy rabat grupy i VAT na pełnych groszach", () => {
    expect(unitNetAfterDiscount(28320, 0)).toBe(28320);
    expect(unitNetAfterDiscount(28320, 5)).toBe(26904);
    expect(vatCents(28320, 23)).toBe(6514);
    expect(grossCents(28320, 23)).toBe(34834);
  });

  it("displayPrice: B2C brutto, B2B netto z rabatem", () => {
    const product = { price_net_cents: 28320, price_gross_cents: 34834, vat_rate: "23.00" };
    const b2c = displayPrice(product, B2C_CONTEXT)!;
    expect(b2c.main).toBe(34834);
    expect(b2c.secondary).toBe(28320);
    const b2b = displayPrice(product, { mode: "net", discountPct: 10 })!;
    expect(b2b.main).toBe(25488);
    expect(b2b.gross).toBe(grossCents(25488, 23));
    expect(b2b.listNet).toBe(28320);
    expect(displayPrice({ price_net_cents: null, price_gross_cents: null, vat_rate: 23 }, B2C_CONTEXT)).toBeNull();
  });

  it("cartTotals liczy VAT per pozycja (jak create-order)", () => {
    const lines = [
      { qty: 2, price_net_cents: 10000, vat_rate: 23 },
      { qty: 1, price_net_cents: 3333, vat_rate: 8 },
    ];
    const t = cartTotals(lines, B2C_CONTEXT);
    expect(t.subtotalNet).toBe(23333);
    expect(t.vat).toBe(4600 + 267);
    expect(t.subtotalGross).toBe(23333 + 4867);
    expect(t.itemsCount).toBe(3);
    const o = orderTotals(t, 1990);
    expect(o.vat).toBe(4867 + 458);
    expect(o.totalGross).toBe(23333 + 4867 + 1990 + 458);
  });
});
