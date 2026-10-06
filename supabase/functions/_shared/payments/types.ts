// Abstrakcja dostawcy płatności (CLAUDE.md sekcja 7) — wersja serwerowa.
// Na start tylko `manual`; p24 / payu / tpay / stripe — TODO(ustalić): decyzja o dostawcy.

import { manualProvider } from "./manual.ts";

export type PaymentProviderCode = "manual" | "p24" | "payu" | "tpay" | "stripe";

/** Minimalny podzbiór zamówienia potrzebny dostawcy płatności. */
export interface PaymentOrderRef {
  id: string;
  number: string;
  email: string;
  total_gross_cents: number;
  payment_status: string;
  payment_due_date: string | null;
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
    super(`Dostawca płatności nie jest jeszcze obsługiwany (${code}).`);
    this.name = "PaymentProviderNotSupportedError";
  }
}

/**
 * Fabryka dostawców. `manual` jest jedynym zaimplementowanym; p24 / payu / tpay / stripe
 * (i każdy nieznany kod) rzucają PaymentProviderNotSupportedError do czasu decyzji o bramce.
 */
export function getPaymentProvider(code: string): PaymentProvider {
  if (code === "manual") return manualProvider;
  throw new PaymentProviderNotSupportedError(code);
}
