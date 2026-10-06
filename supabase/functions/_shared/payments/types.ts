// Abstrakcja dostawcy płatności (CLAUDE.md sekcja 7) — wersja serwerowa.
// Zaimplementowane: `manual` (przelew / odroczona) i `imoje` (ING: BLIK, karty, pbl).
// p24 / payu / tpay / stripe — niezaimplementowane (decyzja: imoje).

import { manualProvider } from "./manual.ts";
import { imojeProvider, isImojeConfigured } from "./imoje.ts";

export type PaymentProviderCode = "manual" | "imoje" | "p24" | "payu" | "tpay" | "stripe";

/** Minimalny podzbiór zamówienia potrzebny dostawcy płatności. */
export interface PaymentOrderRef {
  id: string;
  number: string;
  email: string;
  total_gross_cents: number;
  payment_status: string;
  payment_due_date: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}

export interface CreatePaymentResult {
  redirectUrl?: string;
  instructions?: string;
}

export interface WebhookResult {
  orderId: string;
  status: "paid" | "failed" | "pending";
}

export interface PaymentProvider {
  code: PaymentProviderCode;
  createPayment(order: PaymentOrderRef): Promise<CreatePaymentResult>;
  handleWebhook(req: Request): Promise<WebhookResult>;
}

export class PaymentProviderNotSupportedError extends Error {
  constructor(code: string) {
    super(`Dostawca płatności nie jest obsługiwany (${code}).`);
    this.name = "PaymentProviderNotSupportedError";
  }
}

/**
 * Fabryka dostawców. `manual` zawsze; `imoje` tylko gdy skonfigurowane sekrety IMOJE_*.
 * Pozostałe kody rzucają PaymentProviderNotSupportedError.
 */
export function getPaymentProvider(code: string): PaymentProvider {
  if (code === "manual") return manualProvider;
  if (code === "imoje") {
    if (!isImojeConfigured()) throw new PaymentProviderNotSupportedError("imoje — brak konfiguracji");
    return imojeProvider;
  }
  throw new PaymentProviderNotSupportedError(code);
}
