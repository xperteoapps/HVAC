import type { PaymentProvider } from "./types";

/**
 * Płatności online imoje (ING): BLIK, karty, szybkie przelewy, Apple/Google Pay.
 * Link płatności tworzy Edge Function `create-order` (lub `create-payment` dla ponowienia);
 * front tylko przekierowuje na `redirectUrl`. Status wraca notyfikacją do `payment-webhook`.
 */
export const imojeProvider: PaymentProvider = {
  code: "imoje",
  label: "Płatność online — BLIK, karta, szybki przelew",
  description: "Bezpieczna płatność przez imoje (ING). Po zapłacie wrócisz do sklepu, a zamówienie od razu trafi do realizacji.",
  available: true,
  async createPayment() {
    return { instructions: "Przekierowujemy do bramki płatności imoje." };
  },
};
