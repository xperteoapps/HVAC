// payment-webhook — placeholder. Bramka płatności online nie została jeszcze wybrana
// (CLAUDE.md sekcja 7: p24 / payu / tpay / stripe — TODO(ustalić)).
//
// Docelowo: wybrać dostawcę przez getPaymentProvider(Deno.env.get("PAYMENT_PROVIDER"))
// z _shared/payments/types.ts, wywołać provider.handleWebhook(req), zweryfikować podpis,
// zaktualizować orders.payment_status / status i dodać wpis w order_events (type 'payment').

import { errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve((req: Request): Response => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  console.warn("[payment-webhook] odebrano wywołanie, ale dostawca płatności nie jest skonfigurowany.");
  return errorResponse(
    "Płatności online nie są jeszcze skonfigurowane (TODO(ustalić): dostawca płatności)",
    501,
    "NOT_IMPLEMENTED",
  );
});
