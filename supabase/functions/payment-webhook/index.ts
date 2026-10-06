// payment-webhook — notyfikacje imoje (ING). Publiczny endpoint (verify_jwt = false);
// autentyczność zapewnia podpis hash(rawBody + serviceKey) w nagłówku X-Imoje-Signature.
//
// Przepływ: podpis → walidacja body → zamówienie po orderId (= orders.id) → kontrola kwoty/waluty
// → mapowanie statusu (settled → paid, rejected/cancelled/error → failed, refund settled → refunded)
// → aktualizacja orders (idempotentnie) + wpis order_events → 200 {"status":"ok"}.
// Przy nieudanej weryfikacji odpowiadamy 400/401 — imoje ponowi notyfikację.

import { corsHeaders, errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertNoError, createAdminClient } from "../_shared/supabase.ts";
import { getImojeConfig } from "../_shared/payments/imoje.ts";
import { mapImojeOutcome, parseImojeNotification, parseImojeSignatureHeader, verifyImojeNotification } from "../_shared/payments/imoje-core.ts";

interface OrderRow {
  id: string;
  number: string;
  status: string;
  payment_status: string;
  payment_provider: string;
  payment_ref: string | null;
  total_gross_cents: number;
}

const OK = () => new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method === "GET") return jsonResponse({ provider: "imoje", status: getImojeConfig() ? "configured" : "not_configured" });
  if (req.method !== "POST") return errorResponse("Dozwolona tylko metoda POST", 405, "METHOD_NOT_ALLOWED");

  const cfg = getImojeConfig();
  if (!cfg) {
    console.warn("[payment-webhook] odebrano notyfikację, ale IMOJE_* nie są skonfigurowane.");
    return errorResponse("Płatności online nie są skonfigurowane (brak sekretów IMOJE_*)", 501, "NOT_CONFIGURED");
  }

  const rawBody = await req.text();
  const header = parseImojeSignatureHeader(req.headers.get("x-imoje-signature"));
  const verified = await verifyImojeNotification(rawBody, header, cfg);
  if (!verified.ok) {
    console.warn("[payment-webhook] odrzucono notyfikację:", verified.reason);
    return errorResponse(`Nieprawidłowa notyfikacja: ${verified.reason}`, 401, "INVALID_SIGNATURE");
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return errorResponse("Body nie jest poprawnym JSON", 400, "BAD_JSON");
  }
  const parsed = parseImojeNotification(json);
  if (!parsed.ok) return errorResponse(parsed.reason, 400, "BAD_NOTIFICATION");
  const { transaction } = parsed.data;

  try {
    const admin = createAdminClient();
    const { data: orderData, error } = await admin
      .from("orders")
      .select("id, number, status, payment_status, payment_provider, payment_ref, total_gross_cents")
      .eq("id", transaction.orderId)
      .maybeSingle();
    assertNoError(error, "orders.select");
    const order = orderData as OrderRow | null;
    if (!order) {
      console.warn(`[payment-webhook] brak zamówienia dla orderId=${transaction.orderId}`);
      // 200, żeby imoje nie ponawiało w nieskończoność notyfikacji do nieistniejącego zamówienia.
      return OK();
    }

    const outcome = mapImojeOutcome(transaction.type, transaction.status);
    const eventPayload = {
      provider: "imoje",
      transaction_id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      payment_method: transaction.paymentMethod ?? null,
      payment_method_code: transaction.paymentMethodCode ?? null,
      outcome: outcome.kind,
    };

    const logEvent = async (extra: Record<string, unknown> = {}) => {
      const { error: evErr } = await admin.from("order_events").insert({ order_id: order.id, type: "payment_notification", payload: { ...eventPayload, ...extra } });
      if (evErr) console.warn("[payment-webhook] order_events.insert:", evErr.message);
    };

    if (transaction.currency !== "PLN" || (transaction.type === "sale" && transaction.amount !== order.total_gross_cents)) {
      console.error(`[payment-webhook] niezgodność kwoty/waluty dla ${order.number}: ${transaction.amount} ${transaction.currency} vs ${order.total_gross_cents} PLN`);
      await logEvent({ warning: "amount_mismatch", expected_amount: order.total_gross_cents });
      return OK();
    }

    const patch: Record<string, unknown> = {};
    switch (outcome.kind) {
      case "paid":
        if (order.payment_status === "paid") break; // idempotencja
        patch.payment_status = "paid";
        patch.payment_ref = transaction.id;
        if (order.status === "new" || order.status === "awaiting_payment") patch.status = "paid";
        break;
      case "failed":
        if (order.payment_status === "paid") break; // nie cofamy opłaconego
        patch.payment_status = "failed";
        patch.payment_ref = transaction.id;
        break;
      case "refunded":
        patch.payment_status = "refunded";
        if (order.status !== "cancelled") patch.status = "refunded";
        break;
      case "pending":
        if (!order.payment_ref) patch.payment_ref = transaction.id;
        break;
      case "ignore":
        break;
    }

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await admin.from("orders").update(patch).eq("id", order.id);
      assertNoError(upErr, "orders.update");
    }
    await logEvent({ applied: patch });
    return OK();
  } catch (err) {
    console.error("[payment-webhook] błąd przetwarzania:", err);
    return errorResponse("Błąd przetwarzania notyfikacji", 500, "INTERNAL");
  }
});
