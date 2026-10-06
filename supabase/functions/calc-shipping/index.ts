// calc-shipping — kalkulacja dostępnych metod dostawy dla koszyka (gość lub użytkownik).
// POST { items: [{ product_id, qty }], postal_code?, price_mode? }
// To tylko podgląd dla checkoutu — źródłem prawdy dla cen i dostawy jest create-order.

import { z } from "zod";
import { errorToResponse, handleOptions, HttpError, jsonResponse, readJson } from "../_shared/cors.ts";
import { enabledPaymentProviders } from "../_shared/payments/imoje.ts";
import { assertNoError, createAdminClient, getCaller } from "../_shared/supabase.ts";
import { lineTotals, unitNetAfterDiscount } from "../_shared/pricing.ts";
import {
  computeShippingOptions,
  type ShippingItemInput,
  type ShippingMethodRow,
} from "../_shared/shipping.ts";

const bodySchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    qty: z.number().int().positive(),
  })).min(1, "Koszyk jest pusty."),
  postal_code: z.string().trim().optional(),
  price_mode: z.enum(["gross", "net"]).optional(),
});

interface ProductRow {
  id: string;
  name: string;
  status: "active" | "hidden" | "discontinued";
  stock_status: string;
  price_net_cents: number | null;
  vat_rate: number | string;
  weight_kg: number | string | null;
  pallet_required: boolean;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Dozwolona jest tylko metoda POST.");
    }

    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new HttpError(400, `Nieprawidłowe dane: ${issue?.message ?? "błąd walidacji"}`, "VALIDATION");
    }
    const body = parsed.data;

    const admin = createAdminClient();
    const caller = await getCaller(req, admin);

    // Tryb cen i rabat: zatwierdzony B2B bierze z grupy; inaczej podgląd wg body (domyślnie brutto, 0%).
    let priceMode: "gross" | "net" = body.price_mode ?? "gross";
    let discountPct = 0;
    if (caller.kind === "user" && caller.profile?.b2b_approved && caller.profile.customer_group) {
      priceMode = caller.profile.customer_group.price_mode;
      discountPct = caller.profile.customer_group.discount_pct;
    }

    // Scal duplikaty product_id.
    const qtyById = new Map<string, number>();
    for (const it of body.items) {
      qtyById.set(it.product_id, (qtyById.get(it.product_id) ?? 0) + it.qty);
    }
    const ids = [...qtyById.keys()];

    const { data: productsData, error: productsError } = await admin
      .from("products")
      .select("id, name, status, stock_status, price_net_cents, vat_rate, weight_kg, pallet_required")
      .in("id", ids);
    assertNoError(productsError, "products");
    const products = (productsData ?? []) as ProductRow[];
    const byId = new Map(products.map((p) => [p.id, p]));

    const shippingItems: ShippingItemInput[] = [];
    let subtotalNet = 0;
    let subtotalGross = 0;
    for (const [productId, qty] of qtyById) {
      const p = byId.get(productId);
      if (!p || p.status !== "active") {
        throw new HttpError(400, "Jeden z produktów w koszyku jest już niedostępny.", "PRODUCT_UNAVAILABLE");
      }
      if (p.price_net_cents === null) {
        throw new HttpError(400, `Produkt „${p.name}” nie ma aktualnej ceny.`, "PRODUCT_NO_PRICE");
      }
      const unitNet = unitNetAfterDiscount(p.price_net_cents, discountPct);
      const t = lineTotals({ qty, unit_net_cents: unitNet, vat_rate: Number(p.vat_rate) });
      subtotalNet += t.line_net_cents;
      subtotalGross += t.line_gross_cents;
      shippingItems.push({
        weight_kg: p.weight_kg === null ? null : Number(p.weight_kg),
        pallet_required: Boolean(p.pallet_required),
        qty,
        line_net_cents: t.line_net_cents,
        line_gross_cents: t.line_gross_cents,
      });
    }

    const { data: methodsData, error: methodsError } = await admin
      .from("shipping_methods")
      .select(
        "code, name, carrier, description, price_net_cents, free_from_cents, free_from_cents_b2b, max_weight_kg, pallet, pickup, active, position",
      )
      .eq("active", true)
      .order("position", { ascending: true });
    assertNoError(methodsError, "shipping_methods");
    const methods = (methodsData ?? []) as ShippingMethodRow[];

    // postal_code: na razie nieużywany (brak stref dostawy) — zostawiony w API pod przyszłe reguły.
    const result = computeShippingOptions({ items: shippingItems, methods, priceMode });

    return jsonResponse({
      price_mode: priceMode,
      discount_pct: discountPct,
      payment_providers: enabledPaymentProviders(),
      needsPallet: result.needsPallet,
      totalWeightKg: result.totalWeightKg,
      options: result.options,
      subtotal_net_cents: subtotalNet,
      subtotal_gross_cents: subtotalGross,
    });
  } catch (err) {
    return errorToResponse(err, "calc-shipping");
  }
});
