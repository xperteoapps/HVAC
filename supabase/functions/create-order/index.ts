// create-order — źródło prawdy dla cen zamówienia. Przelicza ceny, VAT i dostawę po stronie
// serwera (nigdy nie ufa kwotom z frontu), zapisuje orders + order_items, czyści koszyk,
// generuje instrukcję płatności (manual) i wysyła e-maile (best effort).

import { z } from "zod";
import { errorToResponse, handleOptions, HttpError, jsonResponse, readJson } from "../_shared/cors.ts";
import { assertNoError, type Caller, createAdminClient, getCaller } from "../_shared/supabase.ts";
import { lineTotals, orderTotals, type PricedLine, unitNetAfterDiscount } from "../_shared/pricing.ts";
import {
  computeShippingOptions,
  type ShippingItemInput,
  type ShippingMethodRow,
} from "../_shared/shipping.ts";
import { getPaymentProvider } from "../_shared/payments/types.ts";
import {
  type EmailOrder,
  type EmailOrderItem,
  orderConfirmationCustomer,
  orderNotificationAdmin,
} from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";

// ---------------------------------------------------------------------------
// Walidacja wejścia
// ---------------------------------------------------------------------------

const POSTAL_CODE_RE = /^\d{2}-\d{3}$/;
const DEFERRED_PAYMENT_DAYS = 14;

const addressSchema = z.object({
  full_name: z.string().trim().min(2, "Podaj imię i nazwisko."),
  company_name: z.string().trim().max(200).optional(),
  street: z.string().trim().min(1, "Podaj ulicę."),
  building_no: z.string().trim().min(1, "Podaj numer budynku."),
  apartment_no: z.string().trim().max(20).optional(),
  postal_code: z.string().trim().regex(POSTAL_CODE_RE, "Kod pocztowy w formacie 00-000."),
  city: z.string().trim().min(1, "Podaj miejscowość."),
  country: z.string().trim().length(2).default("PL"),
  phone: z.string().trim().max(30).optional(),
});

const billingAddressSchema = addressSchema.extend({
  nip: z.string().trim().max(20).optional(),
});

const bodySchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    qty: z.number().int().positive(),
  })).min(1, "Koszyk jest pusty."),
  customer: z.object({
    email: z.string().trim().email("Podaj poprawny adres e-mail."),
    full_name: z.string().trim().min(2, "Podaj imię i nazwisko."),
    phone: z.string().trim().min(6, "Podaj numer telefonu.").max(30),
  }),
  shipping_address: addressSchema,
  billing_address: billingAddressSchema.optional(),
  invoice_requested: z.boolean(),
  nip: z.string().trim().max(20).optional(),
  shipping_method_code: z.string().trim().min(1, "Wybierz metodę dostawy."),
  payment_provider: z.literal("manual"),
  deferred_payment: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
  consents: z.object({
    terms: z.literal(true, { errorMap: () => ({ message: "Wymagana akceptacja regulaminu." }) }),
    privacy: z.literal(true, { errorMap: () => ({ message: "Wymagana akceptacja polityki prywatności." }) }),
    marketing: z.boolean().optional(),
  }),
  session_id: z.string().trim().max(200).optional(),
});

type Body = z.infer<typeof bodySchema>;

// ---------------------------------------------------------------------------
// Minimalne typy wierszy
// ---------------------------------------------------------------------------

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  images: string[] | null;
  status: "active" | "hidden" | "discontinued";
  stock_status: "in_stock" | "low" | "on_order" | "unavailable";
  price_net_cents: number | null;
  vat_rate: number | string;
  weight_kg: number | string | null;
  pallet_required: boolean;
  best_supplier_id: string | null;
}

interface OfferRow {
  product_id: string;
  supplier_id: string;
  supplier_sku: string;
}

interface OrderRow {
  id: string;
  number: string;
  status: string;
  payment_status: string;
  total_gross_cents: number;
  subtotal_net_cents: number;
  vat_cents: number;
  shipping_net_cents: number;
  shipping_method: string | null;
  price_mode: "gross" | "net";
  customer_group_code: string;
  email: string;
  payment_due_date: string | null;
  created_at: string;
}

interface OrderItemInsert {
  order_id: string;
  product_id: string;
  sku: string;
  name: string;
  image_url: string | null;
  qty: number;
  price_net_cents: number;
  vat_rate: number;
  supplier_id: string | null;
  supplier_sku: string | null;
}

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

function resolveGroup(caller: Caller): { code: string; discountPct: number; priceMode: "gross" | "net" } {
  if (caller.kind === "user" && caller.profile?.b2b_approved && caller.profile.customer_group) {
    const g = caller.profile.customer_group;
    return { code: g.code, discountPct: g.discount_pct, priceMode: g.price_mode };
  }
  return { code: "b2c", discountPct: 0, priceMode: "gross" };
}

function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function validationError(issue: z.ZodIssue | undefined): HttpError {
  const path = issue?.path.join(".") ?? "";
  const msg = issue?.message ?? "błąd walidacji";
  return new HttpError(400, path ? `${msg} (${path})` : msg, "VALIDATION");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Dozwolona jest tylko metoda POST.");
    }

    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw validationError(parsed.error.issues[0]);
    const body: Body = parsed.data;

    const admin = createAdminClient();
    const caller = await getCaller(req, admin);
    const profile = caller.kind === "user" ? caller.profile : null;
    const profileId = caller.kind === "user" ? caller.userId : null;
    const group = resolveGroup(caller);

    // --- Płatność odroczona: tylko zatwierdzony B2B z flagą --------------------
    if (body.deferred_payment && !(profile?.b2b_approved && profile.deferred_payment_allowed)) {
      throw new HttpError(
        400,
        "Płatność odroczona nie jest dostępna dla tego konta.",
        "DEFERRED_NOT_ALLOWED",
      );
    }

    // --- Produkty ----------------------------------------------------------------
    const qtyById = new Map<string, number>();
    for (const it of body.items) {
      qtyById.set(it.product_id, (qtyById.get(it.product_id) ?? 0) + it.qty);
    }
    const productIds = [...qtyById.keys()];

    const { data: productsData, error: productsError } = await admin
      .from("products")
      .select(
        "id, sku, name, images, status, stock_status, price_net_cents, vat_rate, weight_kg, pallet_required, best_supplier_id",
      )
      .in("id", productIds);
    assertNoError(productsError, "products");
    const products = (productsData ?? []) as ProductRow[];
    const productById = new Map(products.map((p) => [p.id, p]));

    interface Line {
      product: ProductRow;
      qty: number;
      unit_net_cents: number;
      vat_rate: number;
      line_net_cents: number;
      line_gross_cents: number;
    }
    const lines: Line[] = [];
    for (const [productId, qty] of qtyById) {
      const p = productById.get(productId);
      if (!p) {
        throw new HttpError(400, "Jeden z produktów w koszyku nie istnieje.", "PRODUCT_NOT_FOUND");
      }
      if (p.status !== "active") {
        throw new HttpError(400, `Produkt „${p.name}” nie jest już dostępny w sprzedaży.`, "PRODUCT_INACTIVE");
      }
      if (p.price_net_cents === null) {
        throw new HttpError(400, `Produkt „${p.name}” nie ma aktualnej ceny — skontaktuj się z nami.`, "PRODUCT_NO_PRICE");
      }
      if (p.stock_status === "unavailable") {
        throw new HttpError(400, `Produkt „${p.name}” jest obecnie niedostępny.`, "PRODUCT_UNAVAILABLE");
      }
      const vatRate = Number(p.vat_rate);
      const unitNet = unitNetAfterDiscount(p.price_net_cents, group.discountPct);
      const t = lineTotals({ qty, unit_net_cents: unitNet, vat_rate: vatRate });
      lines.push({
        product: p,
        qty,
        unit_net_cents: unitNet,
        vat_rate: vatRate,
        line_net_cents: t.line_net_cents,
        line_gross_cents: t.line_gross_cents,
      });
    }

    // --- Dostawa (przeliczona od zera, wybór po kodzie) ---------------------------
    const { data: methodsData, error: methodsError } = await admin
      .from("shipping_methods")
      .select(
        "code, name, carrier, description, price_net_cents, free_from_cents, free_from_cents_b2b, max_weight_kg, pallet, pickup, active, position",
      )
      .eq("active", true);
    assertNoError(methodsError, "shipping_methods");
    const methods = (methodsData ?? []) as ShippingMethodRow[];

    const shippingItems: ShippingItemInput[] = lines.map((l) => ({
      weight_kg: l.product.weight_kg === null ? null : Number(l.product.weight_kg),
      pallet_required: Boolean(l.product.pallet_required),
      qty: l.qty,
      line_net_cents: l.line_net_cents,
      line_gross_cents: l.line_gross_cents,
    }));
    const shipping = computeShippingOptions({ items: shippingItems, methods, priceMode: group.priceMode });
    const shippingOption = shipping.options.find((o) => o.code === body.shipping_method_code);
    if (!shippingOption) {
      throw new HttpError(
        400,
        "Wybrana metoda dostawy nie jest dostępna dla tego zamówienia. Wybierz inną metodę.",
        "SHIPPING_NOT_ELIGIBLE",
      );
    }

    // --- Sumy ---------------------------------------------------------------------
    const pricedLines: PricedLine[] = lines.map((l) => ({
      qty: l.qty,
      unit_net_cents: l.unit_net_cents,
      vat_rate: l.vat_rate,
    }));
    const totals = orderTotals(pricedLines, shippingOption.price_net_cents);

    // --- Status / płatność --------------------------------------------------------
    const deferred = body.deferred_payment;
    const status = deferred ? "processing" : "awaiting_payment";
    const paymentStatus = deferred ? "deferred" : "pending";
    const paymentDueDate = deferred ? isoDatePlusDays(DEFERRED_PAYMENT_DAYS) : null;

    const nip = body.nip ?? body.billing_address?.nip ?? (body.invoice_requested ? profile?.nip ?? undefined : undefined);

    // --- Insert orders (numer nadaje trigger orders_set_number) ---------------------
    const { data: orderData, error: orderError } = await admin
      .from("orders")
      .insert({
        profile_id: profileId,
        email: body.customer.email,
        phone: body.customer.phone,
        status,
        customer_group_code: group.code,
        price_mode: group.priceMode,
        subtotal_net_cents: totals.subtotal_net_cents,
        discount_pct: group.discountPct,
        shipping_net_cents: totals.shipping_net_cents,
        vat_cents: totals.vat_cents,
        total_gross_cents: totals.total_gross_cents,
        shipping_method: shippingOption.code,
        shipping_address: { ...body.shipping_address, phone: body.shipping_address.phone ?? body.customer.phone },
        billing_address: body.billing_address ?? null,
        invoice_requested: body.invoice_requested,
        nip: nip ?? null,
        payment_provider: body.payment_provider,
        payment_status: paymentStatus,
        payment_due_date: paymentDueDate,
        notes: body.notes ?? null,
      })
      .select(
        "id, number, status, payment_status, total_gross_cents, subtotal_net_cents, vat_cents, shipping_net_cents, shipping_method, price_mode, customer_group_code, email, payment_due_date, created_at",
      )
      .single();
    assertNoError(orderError, "orders.insert");
    const order = orderData as OrderRow;

    // --- supplier_sku dla pozycji: jedno zapytanie po ofertach wszystkich produktów ---
    const { data: offersData, error: offersError } = await admin
      .from("supplier_offers")
      .select("product_id, supplier_id, supplier_sku")
      .in("product_id", productIds);
    assertNoError(offersError, "supplier_offers");
    const offers = (offersData ?? []) as OfferRow[];
    const offerKey = (productId: string, supplierId: string) => `${productId}|${supplierId}`;
    const offerBySupplier = new Map(offers.map((o) => [offerKey(o.product_id, o.supplier_id), o.supplier_sku]));

    const itemsInsert: OrderItemInsert[] = lines.map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      sku: l.product.sku,
      name: l.product.name,
      image_url: l.product.images?.[0] ?? null,
      qty: l.qty,
      price_net_cents: l.unit_net_cents,
      vat_rate: l.vat_rate,
      supplier_id: l.product.best_supplier_id,
      supplier_sku: l.product.best_supplier_id
        ? offerBySupplier.get(offerKey(l.product.id, l.product.best_supplier_id)) ?? null
        : null,
    }));

    const { error: itemsError } = await admin.from("order_items").insert(itemsInsert);
    if (itemsError) {
      // Kompensacja: brak transakcji w PostgREST — usuwamy zamówienie bez pozycji.
      console.error("[create-order] order_items.insert:", itemsError.message);
      const { error: cleanupError } = await admin.from("orders").delete().eq("id", order.id);
      if (cleanupError) console.error("[create-order] cleanup orders.delete:", cleanupError.message);
      throw new Error(`order_items.insert: ${itemsError.message}`);
    }

    // --- Koszyk ---------------------------------------------------------------------
    if (profileId) {
      const { error } = await admin.from("carts").delete().eq("profile_id", profileId);
      if (error) console.warn("[create-order] carts.delete(profile):", error.message);
    }
    if (body.session_id) {
      const { error } = await admin.from("carts").delete().eq("session_id", body.session_id);
      if (error) console.warn("[create-order] carts.delete(session):", error.message);
    }

    // --- Uzupełnienie profilu (tylko puste pola) -----------------------------------
    if (profileId && profile) {
      const patch: Record<string, string> = {};
      if (!profile.phone && body.customer.phone) patch.phone = body.customer.phone;
      if (!profile.full_name && body.customer.full_name) patch.full_name = body.customer.full_name;
      if (Object.keys(patch).length > 0) {
        const { error } = await admin.from("profiles").update(patch).eq("id", profileId);
        if (error) console.warn("[create-order] profiles.update:", error.message);
      }
    }

    // --- Instrukcja płatności -----------------------------------------------------
    const provider = getPaymentProvider(body.payment_provider);
    const payment = await provider.createPayment({
      id: order.id,
      number: order.number,
      email: order.email,
      total_gross_cents: order.total_gross_cents,
      payment_status: order.payment_status,
      payment_due_date: order.payment_due_date,
    });

    // --- E-maile (best effort) ------------------------------------------------------
    const emailOrder: EmailOrder = {
      id: order.id,
      number: order.number,
      email: order.email,
      status: order.status,
      payment_status: order.payment_status,
      price_mode: order.price_mode,
      customer_group_code: order.customer_group_code,
      subtotal_net_cents: order.subtotal_net_cents,
      shipping_net_cents: order.shipping_net_cents,
      vat_cents: order.vat_cents,
      total_gross_cents: order.total_gross_cents,
      shipping_method: order.shipping_method,
      shipping_method_name: shippingOption.name,
      shipping_address: { ...body.shipping_address, phone: body.shipping_address.phone ?? body.customer.phone },
      billing_address: body.billing_address ?? null,
      invoice_requested: body.invoice_requested,
      nip: nip ?? null,
      notes: body.notes ?? null,
      payment_due_date: order.payment_due_date,
      created_at: order.created_at,
    };
    const emailItems: EmailOrderItem[] = itemsInsert.map((i) => ({
      sku: i.sku,
      name: i.name,
      qty: i.qty,
      price_net_cents: i.price_net_cents,
      vat_rate: i.vat_rate,
    }));

    const emailJobs: Array<{ template: string; to: string; subject: string; html: string; text: string }> = [];
    const customerMail = orderConfirmationCustomer(emailOrder, emailItems, payment.instructions);
    emailJobs.push({ template: "order_confirmation", to: order.email, ...customerMail });
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    if (adminEmail) {
      const adminMail = orderNotificationAdmin(emailOrder, emailItems);
      emailJobs.push({ template: "order_admin", to: adminEmail, ...adminMail });
    } else {
      console.warn("[create-order] brak ADMIN_EMAIL — pomijam powiadomienie dla obsługi.");
    }

    for (const job of emailJobs) {
      const result = await sendEmail({ to: job.to, subject: job.subject, html: job.html, text: job.text });
      if (result.ok) {
        const { error } = await admin.from("order_events").insert({
          order_id: order.id,
          type: "email_sent",
          payload: { template: job.template, to: job.to, provider_id: result.id },
        });
        if (error) console.warn("[create-order] order_events.insert:", error.message);
      } else {
        console.warn(`[create-order] e-mail ${job.template} → ${job.to} nie wysłany:`, result);
      }
    }

    // --- Odpowiedź ------------------------------------------------------------------
    return jsonResponse({
      order: {
        id: order.id,
        number: order.number,
        status: order.status,
        payment_status: order.payment_status,
        total_gross_cents: order.total_gross_cents,
        subtotal_net_cents: order.subtotal_net_cents,
        vat_cents: order.vat_cents,
        shipping_net_cents: order.shipping_net_cents,
        shipping_method: order.shipping_method,
        shipping_method_name: shippingOption.name,
        price_mode: order.price_mode,
        email: order.email,
        payment_due_date: order.payment_due_date,
        created_at: order.created_at,
      },
      items: itemsInsert.map((i) => ({
        product_id: i.product_id,
        sku: i.sku,
        name: i.name,
        image_url: i.image_url,
        qty: i.qty,
        price_net_cents: i.price_net_cents,
        vat_rate: i.vat_rate,
      })),
      payment: { provider: provider.code, instructions: payment.instructions ?? null },
    }, 201);
  } catch (err) {
    return errorToResponse(err, "create-order");
  }
});
