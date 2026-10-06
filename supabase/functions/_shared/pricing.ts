// Czyste funkcje cenowe. Wszystkie kwoty w groszach (integer), nigdy float.

/** VAT dla kosztów dostawy (stały, 23%). */
export const SHIPPING_VAT_RATE = 23;

/** Cena jednostkowa netto po rabacie grupy klienta. */
export function unitNetAfterDiscount(priceNetCents: number, discountPct: number): number {
  const pct = Number.isFinite(discountPct) ? Math.max(0, Math.min(100, discountPct)) : 0;
  return Math.round(priceNetCents * (1 - pct / 100));
}

/** Kwota VAT od kwoty netto przy danej stawce (np. 23). */
export function vatCents(netCents: number, vatRate: number): number {
  const rate = Number.isFinite(vatRate) ? vatRate : 0;
  return Math.round(netCents * rate / 100);
}

/** Kwota brutto = netto + VAT. */
export function grossCents(netCents: number, vatRate: number): number {
  return netCents + vatCents(netCents, vatRate);
}

export interface PricedLine {
  qty: number;
  /** cena jednostkowa netto (po rabacie) */
  unit_net_cents: number;
  vat_rate: number;
}

export interface LineTotals {
  line_net_cents: number;
  line_vat_cents: number;
  line_gross_cents: number;
}

/** Sumy jednej pozycji: VAT liczony od wartości pozycji (nie od sztuki) — mniejszy błąd zaokrągleń. */
export function lineTotals(line: PricedLine): LineTotals {
  const line_net_cents = line.unit_net_cents * line.qty;
  const line_vat_cents = vatCents(line_net_cents, line.vat_rate);
  return { line_net_cents, line_vat_cents, line_gross_cents: line_net_cents + line_vat_cents };
}

export interface OrderTotals {
  subtotal_net_cents: number;
  items_vat_cents: number;
  shipping_net_cents: number;
  shipping_vat_cents: number;
  /** VAT łącznie (pozycje + dostawa) */
  vat_cents: number;
  total_gross_cents: number;
}

/** Sumy zamówienia dla listy pozycji i kosztu dostawy netto. */
export function orderTotals(lines: readonly PricedLine[], shippingNetCents: number): OrderTotals {
  let subtotal_net_cents = 0;
  let items_vat_cents = 0;
  for (const line of lines) {
    const t = lineTotals(line);
    subtotal_net_cents += t.line_net_cents;
    items_vat_cents += t.line_vat_cents;
  }
  const shipping_vat_cents = vatCents(shippingNetCents, SHIPPING_VAT_RATE);
  const vat_cents = items_vat_cents + shipping_vat_cents;
  return {
    subtotal_net_cents,
    items_vat_cents,
    shipping_net_cents: shippingNetCents,
    shipping_vat_cents,
    vat_cents,
    total_gross_cents: subtotal_net_cents + shippingNetCents + vat_cents,
  };
}

/** Formatowanie kwoty w groszach do "1 234,56 zł" (do e-maili / komunikatów). */
export function formatPln(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const zl = Math.floor(abs / 100);
  const gr = abs % 100;
  const zlStr = zl.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${zlStr},${gr.toString().padStart(2, "0")} zł`;
}
