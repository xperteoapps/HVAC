/**
 * Abstrakcja dostawcy płatności (front).
 * Na start tylko `manual` (przelew tradycyjny / proforma).
 * Przelewy24 / PayU / Tpay / Stripe — TODO(ustalić): decyzja o dostawcy otwarta.
 * Serwerowa implementacja: supabase/functions/_shared/payments/.
 */
export type PaymentProviderCode = "manual" | "p24" | "payu" | "tpay" | "stripe";

export interface PaymentOrderSummary {
  id: string;
  number: string;
  total_gross_cents: number;
  email: string;
  payment_due_date?: string | null;
}

export interface PaymentProvider {
  code: PaymentProviderCode;
  label: string;
  description: string;
  /** Czy można wybrać w checkout */
  available: boolean;
  /** Po utworzeniu zamówienia: przekierowanie (bramka) lub instrukcje (manual) */
  createPayment(order: PaymentOrderSummary): Promise<{ redirectUrl?: string; instructions?: string }>;
}
