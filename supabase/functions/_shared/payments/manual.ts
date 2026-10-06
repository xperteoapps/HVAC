// Dostawca `manual`: przelew tradycyjny / proforma. Admin ręcznie oznacza zamówienie jako opłacone.

import type { CreatePaymentResult, PaymentOrderRef, PaymentProvider, WebhookResult } from "./types.ts";
import { formatPln } from "../pricing.ts";

export const DEFAULT_BANK_ACCOUNT = "TODO(ustalić): numer konta";

export function bankAccountNumber(): string {
  return Deno.env.get("BANK_ACCOUNT_NUMBER") || DEFAULT_BANK_ACCOUNT;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

/** Tekst instrukcji płatności (bez HTML — szablon e-maila sam go escapuje). */
export function manualPaymentInstructions(order: PaymentOrderRef): string {
  const shop = Deno.env.get("SHOP_NAME") || "Sklep HVAC";
  const account = bankAccountNumber();
  const amount = formatPln(order.total_gross_cents);

  if (order.payment_status === "deferred") {
    const due = formatDate(order.payment_due_date);
    return [
      "Płatność odroczona.",
      `Kwota do zapłaty: ${amount}${due ? ` — termin płatności: ${due}` : ""}.`,
      `Odbiorca: ${shop}`,
      `Numer konta: ${account}`,
      `Tytuł przelewu: ${order.number}`,
      "Fakturę VAT z terminem płatności prześlemy osobną wiadomością.",
    ].join("\n");
  }

  return [
    "Prosimy o opłacenie zamówienia przelewem tradycyjnym.",
    `Kwota: ${amount}`,
    `Odbiorca: ${shop}`,
    `Numer konta: ${account}`,
    `Tytuł przelewu: ${order.number}`,
    "Zamówienie przekażemy do realizacji po zaksięgowaniu wpłaty (zwykle 1 dzień roboczy).",
  ].join("\n");
}

export const manualProvider: PaymentProvider = {
  code: "manual",

  createPayment(order: PaymentOrderRef): Promise<CreatePaymentResult> {
    return Promise.resolve({ instructions: manualPaymentInstructions(order) });
  },

  handleWebhook(_req: Request): Promise<WebhookResult> {
    // Przelew tradycyjny nie ma webhooka — status zmienia admin w panelu.
    return Promise.reject(new Error("Dostawca płatności „manual” nie obsługuje webhooków."));
  },
};
