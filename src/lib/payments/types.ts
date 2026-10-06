/**
 * Abstrakcja dostawcy płatności (front).
 * `manual` (przelew tradycyjny / proforma, płatność odroczona B2B) oraz `imoje` (ING — BLIK, karty, pbl).
 * Decyzja klienta: bramka online = imoje. p24 / payu / tpay / stripe — nieużywane.
 * Serwerowa implementacja: supabase/functions/_shared/payments/.
 */
export type PaymentProviderCode = "manual" | "imoje" | "p24" | "payu" | "tpay" | "stripe";

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
