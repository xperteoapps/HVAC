// Reguły dostawy (CLAUDE.md sekcja 8). Czysta funkcja — bez dostępu do bazy.

import { grossCents, SHIPPING_VAT_RATE } from "./pricing.ts";

/** Próg wagi, powyżej którego wymagana jest dostawa paletowa. */
export const PALLET_WEIGHT_THRESHOLD_KG = 30;

export interface ShippingItemInput {
  weight_kg: number | null;
  pallet_required: boolean;
  qty: number;
  line_net_cents: number;
  line_gross_cents: number;
}

/** Wiersz `shipping_methods` (kolumny używane przez kalkulację). */
export interface ShippingMethodRow {
  code: string;
  name: string;
  carrier: string | null;
  description: string | null;
  price_net_cents: number;
  free_from_cents: number | null;
  free_from_cents_b2b: number | null;
  max_weight_kg: number | string | null;
  pallet: boolean;
  pickup: boolean;
  active: boolean;
  position: number;
}

export interface ShippingOption {
  code: string;
  name: string;
  carrier: string | null;
  description: string | null;
  price_net_cents: number;
  price_gross_cents: number;
  /** true, gdy koszt wynosi 0 (próg darmowej dostawy albo odbiór osobisty) */
  free: boolean;
  pallet: boolean;
  pickup: boolean;
}

export interface ShippingComputation {
  needsPallet: boolean;
  totalWeightKg: number;
  subtotalNetCents: number;
  subtotalGrossCents: number;
  options: ShippingOption[];
}

export interface ComputeShippingArgs {
  items: ShippingItemInput[];
  methods: ShippingMethodRow[];
  priceMode: "gross" | "net";
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function computeShippingOptions(args: ComputeShippingArgs): ShippingComputation {
  const { items, methods, priceMode } = args;

  let totalWeightKg = 0;
  let subtotalNetCents = 0;
  let subtotalGrossCents = 0;
  let anyPallet = false;
  for (const item of items) {
    const w = toNumber(item.weight_kg) ?? 0;
    totalWeightKg += w * item.qty;
    subtotalNetCents += item.line_net_cents;
    subtotalGrossCents += item.line_gross_cents;
    if (item.pallet_required) anyPallet = true;
  }
  totalWeightKg = Math.round(totalWeightKg * 1000) / 1000;

  const needsPallet = anyPallet || totalWeightKg > PALLET_WEIGHT_THRESHOLD_KG;

  const options: ShippingOption[] = [];
  const sorted = [...methods]
    .filter((m) => m.active)
    .sort((a, b) => (a.position - b.position) || a.code.localeCompare(b.code));

  for (const m of sorted) {
    const maxWeight = toNumber(m.max_weight_kg);
    const withinWeight = maxWeight === null || totalWeightKg <= maxWeight;

    let eligible: boolean;
    if (m.pickup) {
      eligible = true;
    } else if (m.pallet) {
      eligible = needsPallet && withinWeight;
    } else {
      eligible = !needsPallet && withinWeight;
    }
    if (!eligible) continue;

    let priceNet = Math.max(0, Math.round(m.price_net_cents));
    if (priceMode === "net") {
      if (m.free_from_cents_b2b !== null && subtotalNetCents >= m.free_from_cents_b2b) priceNet = 0;
    } else {
      if (m.free_from_cents !== null && subtotalGrossCents >= m.free_from_cents) priceNet = 0;
    }

    options.push({
      code: m.code,
      name: m.name,
      carrier: m.carrier,
      description: m.description,
      price_net_cents: priceNet,
      price_gross_cents: grossCents(priceNet, SHIPPING_VAT_RATE),
      free: priceNet === 0,
      pallet: m.pallet,
      pickup: m.pickup,
    });
  }

  return { needsPallet, totalWeightKg, subtotalNetCents, subtotalGrossCents, options };
}
