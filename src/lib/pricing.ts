/**
 * Logika prezentacji cen po stronie frontu.
 * Źródłem prawdy dla zamówienia jest DB / Edge Function `create-order` —
 * tutaj tylko odwzorowujemy ten sam algorytm na potrzeby wyświetlania.
 * Wszystkie kwoty w groszach (integer).
 */

export type PriceMode = "gross" | "net";

export interface PricingContext {
  /** Tryb prezentacji: B2C brutto, B2B netto */
  mode: PriceMode;
  /** Rabat grupy klienta (0 dla B2C / niezatwierdzonego B2B) */
  discountPct: number;
}

export const B2C_CONTEXT: PricingContext = { mode: "gross", discountPct: 0 };

export interface ProductPriceInput {
  price_net_cents: number | null;
  price_gross_cents: number | null;
  vat_rate: number | string | null;
}

export interface DisplayPrice {
  /** Cena główna (wg trybu), po rabacie */
  main: number;
  /** Cena pomocnicza (netto przy brutto i odwrotnie) */
  secondary: number;
  net: number;
  gross: number;
  /** Cena katalogowa netto przed rabatem */
  listNet: number;
  listGross: number;
  discountPct: number;
  vatRate: number;
}

export function toNumber(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Cena jednostkowa netto po rabacie grupy — identycznie jak w create-order. */
export function unitNetAfterDiscount(priceNetCents: number, discountPct: number): number {
  return Math.round(priceNetCents * (1 - discountPct / 100));
}

export function vatCents(netCents: number, vatRate: number): number {
  return Math.round((netCents * vatRate) / 100);
}

export function grossCents(netCents: number, vatRate: number): number {
  return netCents + vatCents(netCents, vatRate);
}

export function displayPrice(product: ProductPriceInput, ctx: PricingContext): DisplayPrice | null {
  if (product.price_net_cents === null || product.price_net_cents === undefined) return null;
  const vatRate = toNumber(product.vat_rate, 23);
  const listNet = product.price_net_cents;
  const listGross = product.price_gross_cents ?? grossCents(listNet, vatRate);
  const net = unitNetAfterDiscount(listNet, ctx.discountPct);
  const gross = ctx.discountPct > 0 ? grossCents(net, vatRate) : listGross;
  return {
    main: ctx.mode === "net" ? net : gross,
    secondary: ctx.mode === "net" ? gross : net,
    net,
    gross,
    listNet,
    listGross,
    discountPct: ctx.discountPct,
    vatRate,
  };
}

export interface CartLineInput {
  qty: number;
  price_net_cents: number;
  vat_rate: number | string | null;
}

export interface CartTotals {
  subtotalNet: number;
  vat: number;
  subtotalGross: number;
  itemsCount: number;
}

/** Suma koszyka wg tego samego algorytmu co create-order (VAT liczony per pozycja). */
export function cartTotals(lines: CartLineInput[], ctx: PricingContext): CartTotals {
  let subtotalNet = 0;
  let vat = 0;
  let itemsCount = 0;
  for (const line of lines) {
    const unitNet = unitNetAfterDiscount(line.price_net_cents, ctx.discountPct);
    const lineNet = unitNet * line.qty;
    subtotalNet += lineNet;
    vat += vatCents(lineNet, toNumber(line.vat_rate, 23));
    itemsCount += line.qty;
  }
  return { subtotalNet, vat, subtotalGross: subtotalNet + vat, itemsCount };
}

export const SHIPPING_VAT_RATE = 23;

export function orderTotals(totals: CartTotals, shippingNetCents: number) {
  const shippingVat = vatCents(shippingNetCents, SHIPPING_VAT_RATE);
  return {
    subtotalNet: totals.subtotalNet,
    shippingNet: shippingNetCents,
    vat: totals.vat + shippingVat,
    totalGross: totals.subtotalGross + shippingNetCents + shippingVat,
  };
}
