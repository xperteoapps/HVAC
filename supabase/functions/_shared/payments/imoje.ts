// Dostawca `imoje` (ING) — link płatności przez REST API + notyfikacje w payment-webhook.
// Konfiguracja przez sekrety Edge Functions (NIGDY w repo):
//   IMOJE_MERCHANT_ID, IMOJE_SERVICE_ID, IMOJE_SERVICE_KEY, IMOJE_API_KEY,
//   IMOJE_ENV=sandbox|production, opcjonalnie IMOJE_API_URL (nadpisanie bazy).
//   SHOP_URL (adresy powrotu), SUPABASE_URL (notificationUrl → payment-webhook).

import type { CreatePaymentResult, PaymentOrderRef, PaymentProvider, WebhookResult } from "./types.ts";
import {
  buildImojePaymentLinkPayload,
  extractImojeRedirectUrl,
  imojeApiUrl,
  splitFullName,
  type ImojeConfig,
  type ImojeEnv,
} from "./imoje-core.ts";

export class ImojeNotConfiguredError extends Error {
  constructor() {
    super("Płatności online (imoje) nie są skonfigurowane — brak sekretów IMOJE_*.");
    this.name = "ImojeNotConfiguredError";
  }
}

export function getImojeConfig(): ImojeConfig | null {
  const merchantId = Deno.env.get("IMOJE_MERCHANT_ID");
  const serviceId = Deno.env.get("IMOJE_SERVICE_ID");
  const serviceKey = Deno.env.get("IMOJE_SERVICE_KEY");
  const apiKey = Deno.env.get("IMOJE_API_KEY");
  if (!merchantId || !serviceId || !serviceKey || !apiKey) return null;
  const env: ImojeEnv = Deno.env.get("IMOJE_ENV") === "production" ? "production" : "sandbox";
  return { env, merchantId, serviceId, serviceKey, apiKey, apiUrl: Deno.env.get("IMOJE_API_URL") || undefined };
}

export function isImojeConfigured(): boolean {
  return getImojeConfig() !== null;
}

/** Lista aktywnych dostawców dla frontu: PAYMENT_PROVIDERS=manual,imoje (imoje tylko gdy skonfigurowane). */
export function enabledPaymentProviders(): string[] {
  const raw = Deno.env.get("PAYMENT_PROVIDERS") || Deno.env.get("PAYMENT_PROVIDER") || "manual";
  const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const out = list.filter((code) => code === "manual" || (code === "imoje" && isImojeConfigured()));
  return out.length ? [...new Set(out)] : ["manual"];
}

function shopUrl(): string {
  return (Deno.env.get("SHOP_URL") || "http://localhost:8080").replace(/\/$/, "");
}

function notificationUrl(): string | undefined {
  // Jawne nadpisanie (np. gdy SUPABASE_URL w runtime to adres wewnętrzny, jak lokalnie http://kong:8000)
  const explicit = Deno.env.get("IMOJE_NOTIFICATION_URL");
  if (explicit) return explicit;
  const base = Deno.env.get("SUPABASE_URL");
  return base ? `${base.replace(/\/$/, "")}/functions/v1/payment-webhook` : undefined;
}

export interface ImojePaymentContext {
  fullName: string;
  phone?: string | null;
}

export interface ImojeCreateResult extends CreatePaymentResult {
  paymentId: string | null;
}

/** Tworzy link płatności imoje dla zamówienia. Rzuca przy błędzie API (caller decyduje o fallbacku). */
export async function createImojePaymentLink(order: PaymentOrderRef, ctx: ImojePaymentContext): Promise<ImojeCreateResult> {
  const cfg = getImojeConfig();
  if (!cfg) throw new ImojeNotConfiguredError();
  const base = shopUrl();
  const confirm = `${base}/zamowienie/potwierdzenie/${encodeURIComponent(order.number)}`;
  const payload = buildImojePaymentLinkPayload({
    serviceId: cfg.serviceId,
    amountCents: order.total_gross_cents,
    orderId: order.id,
    title: `Zamówienie ${order.number}`,
    customer: { ...splitFullName(ctx.fullName), email: order.email, ...(ctx.phone ? { phone: ctx.phone } : {}) },
    successReturnUrl: `${confirm}?platnosc=ok`,
    failureReturnUrl: `${confirm}?platnosc=blad`,
    returnUrl: `${confirm}?platnosc=powrot`,
    notificationUrl: notificationUrl(),
  });

  const res = await fetch(`${imojeApiUrl(cfg)}/merchant/${encodeURIComponent(cfg.merchantId)}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    console.error(`[imoje] payment link HTTP ${res.status}:`, text.slice(0, 500));
    throw new Error(`imoje API odpowiedziało kodem ${res.status}`);
  }
  const redirect = extractImojeRedirectUrl(json);
  if (!redirect) {
    console.error("[imoje] brak payment.url w odpowiedzi:", text.slice(0, 500));
    throw new Error("imoje API nie zwróciło adresu płatności");
  }
  return {
    redirectUrl: redirect.url,
    paymentId: redirect.id,
    instructions: "Dokończ płatność online (BLIK, karta, szybki przelew). Po zaksięgowaniu wpłaty zamówienie trafi do realizacji.",
  };
}

export const imojeProvider: PaymentProvider = {
  code: "imoje",
  createPayment(order: PaymentOrderRef): Promise<CreatePaymentResult> {
    return createImojePaymentLink(order, { fullName: order.customer_name ?? "", phone: order.customer_phone ?? null });
  },
  handleWebhook(_req: Request): Promise<WebhookResult> {
    // Obsługa notyfikacji jest w payment-webhook/index.ts (wymaga dostępu do DB).
    return Promise.reject(new Error("Użyj payment-webhook/index.ts do obsługi notyfikacji imoje."));
  },
};
