// create-payment — ponowne wygenerowanie linku płatności imoje dla nieopłaconego zamówienia
// („Zapłać online” w koncie klienta / na stronie potwierdzenia).
// POST { order_id } (zalogowany właściciel lub admin) lub { order_number, email } (gość).

import { z } from "zod";
import { errorToResponse, handleOptions, HttpError, jsonResponse, readJson } from "../_shared/cors.ts";
import { assertNoError, createAdminClient, getCaller, isAdminCaller } from "../_shared/supabase.ts";
import { createImojePaymentLink, isImojeConfigured } from "../_shared/payments/imoje.ts";

const bodySchema = z.union([
  z.object({ order_id: z.string().uuid() }),
  z.object({ order_number: z.string().min(5), email: z.string().email() }),
]);

interface OrderRow {
  id: string;
  number: string;
  email: string;
  phone: string | null;
  profile_id: string | null;
  status: string;
  payment_status: string;
  payment_provider: string;
  total_gross_cents: number;
  shipping_address: { full_name?: string } | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  try {
    if (req.method !== "POST") throw new HttpError(405, "Dozwolona tylko metoda POST", "METHOD_NOT_ALLOWED");
    if (!isImojeConfigured()) throw new HttpError(503, "Płatności online są chwilowo niedostępne.", "NOT_CONFIGURED");

    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Nieprawidłowe dane żądania.", "VALIDATION");
    const body = parsed.data;

    const admin = createAdminClient();
    const caller = await getCaller(req, admin);

    let q = admin.from("orders").select("id, number, email, phone, profile_id, status, payment_status, payment_provider, total_gross_cents, shipping_address");
    q = "order_id" in body ? q.eq("id", body.order_id) : q.eq("number", body.order_number).ilike("email", body.email);
    const { data, error } = await q.maybeSingle();
    assertNoError(error, "orders.select");
    const order = data as OrderRow | null;
    if (!order) throw new HttpError(404, "Nie znaleziono zamówienia.", "NOT_FOUND");

    if ("order_id" in body) {
      const owner = caller.kind === "user" && order.profile_id === caller.userId;
      if (!owner && !isAdminCaller(caller)) throw new HttpError(403, "Brak dostępu do tego zamówienia.", "FORBIDDEN");
    }
    if (order.payment_status === "paid") throw new HttpError(400, "To zamówienie jest już opłacone.", "ALREADY_PAID");
    if (["cancelled", "refunded", "delivered", "shipped"].includes(order.status)) {
      throw new HttpError(400, "Tego zamówienia nie można już opłacić online.", "NOT_PAYABLE");
    }

    const result = await createImojePaymentLink(
      { id: order.id, number: order.number, email: order.email, total_gross_cents: order.total_gross_cents, payment_status: order.payment_status, payment_due_date: null },
      { fullName: order.shipping_address?.full_name ?? "", phone: order.phone },
    );

    const { error: upErr } = await admin
      .from("orders")
      .update({ payment_provider: "imoje", ...(order.payment_status === "failed" ? { payment_status: "pending" } : {}) })
      .eq("id", order.id);
    if (upErr) console.warn("[create-payment] orders.update:", upErr.message);
    const { error: evErr } = await admin.from("order_events").insert({
      order_id: order.id,
      type: "payment_link",
      payload: { provider: "imoje", payment_id: result.paymentId, url: result.redirectUrl },
      created_by: caller.kind === "user" ? caller.userId : null,
    });
    if (evErr) console.warn("[create-payment] order_events.insert:", evErr.message);

    return jsonResponse({ order_id: order.id, number: order.number, payment: { provider: "imoje", redirectUrl: result.redirectUrl } });
  } catch (err) {
    return errorToResponse(err, "create-payment");
  }
});
