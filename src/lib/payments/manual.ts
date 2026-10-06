import type { PaymentProvider } from "./types";
import { imojeProvider } from "./imoje";

export const manualProvider: PaymentProvider = {
  code: "manual",
  label: "Przelew tradycyjny / proforma",
  description: "Dane do przelewu otrzymasz w e-mailu z potwierdzeniem. Zamówienie realizujemy po zaksięgowaniu wpłaty.",
  available: true,
  async createPayment(order) {
    return {
      instructions: `Prosimy o przelew kwoty ${(order.total_gross_cents / 100).toFixed(2)} zł z tytułem: ${order.number}. Dane do przelewu znajdziesz w e-mailu.`,
    };
  },
};

export const deferredProvider: PaymentProvider = {
  code: "manual",
  label: "Płatność odroczona 14 dni",
  description: "Dla zweryfikowanych klientów B2B. Faktura z terminem płatności 14 dni.",
  available: true,
  async createPayment(order) {
    return {
      instructions: `Zamówienie ${order.number} zostanie zrealizowane od razu. Termin płatności: ${order.payment_due_date ?? "14 dni"}.`,
    };
  },
};

export const PAYMENT_PROVIDERS: PaymentProvider[] = [imojeProvider, manualProvider];
