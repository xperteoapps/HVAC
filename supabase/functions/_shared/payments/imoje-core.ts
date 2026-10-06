// Rdzeń integracji imoje (ING) — CZYSTY TypeScript bez Deno/npm (testowany w vitest).
// Źródła: dokumentacja imoje API (bump.sh/pgw/doc/imoje-api) oraz oficjalne moduły
// (WooCommerce `payment-core`, laravel-imoje). Kluczowe fakty:
// - REST: POST {apiUrl}/merchant/{merchantId}/payment  → link płatności (payment.url)
//         POST {apiUrl}/merchant/{merchantId}/transaction → transakcja z wybraną metodą (action.url)
//   Auth: `Authorization: Bearer <IMOJE_API_KEY>`, kwoty w groszach (integer), currency 'PLN'.
// - Notyfikacja: POST JSON na notificationUrl; nagłówek
//   `X-Imoje-Signature: merchantid=..;serviceid=..;signature=..;alg=sha256`
//   signature = hash(alg, rawBody + serviceKey). Odpowiedź: 200 {"status":"ok"}.
// - Statusy transakcji: new, authorized, pending, submitted_for_settlement, settled,
//   rejected, cancelled, error, refund (type 'sale' | 'refund').

export type ImojeEnv = "sandbox" | "production";

export interface ImojeConfig {
  env: ImojeEnv;
  merchantId: string;
  serviceId: string;
  serviceKey: string;
  apiKey: string;
  /** Nadpisanie bazowego URL API (np. https://api.pay.ing.pl/v1 po migracji domen ING) */
  apiUrl?: string;
}

export const IMOJE_API_URLS: Record<ImojeEnv, string> = {
  production: "https://api.imoje.pl/v1",
  sandbox: "https://sandbox.api.imoje.pl/v1",
};

export const IMOJE_TRANSACTION_STATUSES = [
  "new",
  "authorized",
  "pending",
  "submitted_for_settlement",
  "settled",
  "rejected",
  "cancelled",
  "error",
  "refund",
] as const;
export type ImojeTransactionStatus = (typeof IMOJE_TRANSACTION_STATUSES)[number];

export type ImojeTransactionType = "sale" | "refund";

export interface ImojeSignatureHeader {
  merchantid: string;
  serviceid: string;
  signature: string;
  alg: string;
}

/** Parsuje `merchantid=..;serviceid=..;signature=..;alg=..` (kolejność dowolna, wartości bez cudzysłowów). */
export function parseImojeSignatureHeader(header: string | null | undefined): ImojeSignatureHeader | null {
  if (!header) return null;
  const out: Record<string, string> = {};
  for (const part of header.replace(/^"|"$/g, "").split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  if (!out.merchantid || !out.serviceid || !out.signature || !out.alg) return null;
  return { merchantid: out.merchantid, serviceid: out.serviceid, signature: out.signature.toLowerCase(), alg: out.alg.toLowerCase() };
}

const WEB_CRYPTO_ALGS: Record<string, string> = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };

export function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** hash(alg, data + serviceKey) → hex. Obsługiwane alg: sha256/sha384/sha512 (sha224 brak w Web Crypto). */
export async function imojeHash(alg: string, data: string, serviceKey: string): Promise<string> {
  const name = WEB_CRYPTO_ALGS[alg.toLowerCase()];
  if (!name) throw new Error(`Nieobsługiwany algorytm podpisu imoje: ${alg}`);
  const digest = await crypto.subtle.digest(name, new TextEncoder().encode(data + serviceKey));
  return bytesToHex(digest);
}

/** Porównanie stałoczasowe hex-stringów. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/** Weryfikuje notyfikację: zgodność merchantId/serviceId + podpis hash(rawBody + serviceKey). */
export async function verifyImojeNotification(
  rawBody: string,
  header: ImojeSignatureHeader | null,
  cfg: Pick<ImojeConfig, "merchantId" | "serviceId" | "serviceKey">,
): Promise<VerifyResult> {
  if (!header) return { ok: false, reason: "Brak lub nieprawidłowy nagłówek X-Imoje-Signature" };
  if (header.merchantid !== cfg.merchantId) return { ok: false, reason: "merchantId nie zgadza się z konfiguracją" };
  if (header.serviceid !== cfg.serviceId) return { ok: false, reason: "serviceId nie zgadza się z konfiguracją" };
  let expected: string;
  try {
    expected = await imojeHash(header.alg, rawBody, cfg.serviceKey);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Błąd obliczania podpisu" };
  }
  if (!constantTimeEqual(expected, header.signature)) return { ok: false, reason: "Nieprawidłowy podpis" };
  return { ok: true };
}

/** Podpis formularza paywall (gdyby był potrzebny): sha256(sorted "k=v&k=v" + serviceKey) + ";sha256". */
export async function imojePaywallSignature(fields: Record<string, string | number>, serviceKey: string, alg = "sha256"): Promise<string> {
  const query = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
  return `${await imojeHash(alg, query, serviceKey)};${alg}`;
}

// --- Notyfikacja -----------------------------------------------------------------------

export interface ImojeNotificationTransaction {
  id: string;
  type: ImojeTransactionType;
  status: ImojeTransactionStatus;
  serviceId: string;
  amount: number;
  currency: string;
  orderId: string;
  title?: string;
  paymentMethod?: string;
  paymentMethodCode?: string;
  source?: string;
  created?: number;
  modified?: number;
}

export interface ImojeNotification {
  transaction: ImojeNotificationTransaction;
  payment?: Record<string, unknown>;
  action?: Record<string, unknown>;
}

/** Walidacja kształtu notyfikacji (bez zod — moduł musi być wolny od zależności). */
export function parseImojeNotification(body: unknown): { ok: true; data: ImojeNotification } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "Body nie jest obiektem" };
  const t = (body as { transaction?: unknown }).transaction;
  if (!t || typeof t !== "object") return { ok: false, reason: "Brak obiektu transaction" };
  const tr = t as Record<string, unknown>;
  const str = (k: string) => (typeof tr[k] === "string" ? (tr[k] as string) : null);
  const id = str("id");
  const type = str("type");
  const status = str("status");
  const serviceId = str("serviceId");
  const currency = str("currency");
  const orderId = str("orderId");
  const amount = typeof tr.amount === "number" ? tr.amount : Number(tr.amount);
  if (!id || !orderId || !serviceId || !currency) return { ok: false, reason: "Brak wymaganych pól transaction.{id,orderId,serviceId,currency}" };
  if (type !== "sale" && type !== "refund") return { ok: false, reason: `Nieznany transaction.type: ${type}` };
  if (!status || !(IMOJE_TRANSACTION_STATUSES as readonly string[]).includes(status)) return { ok: false, reason: `Nieznany transaction.status: ${status}` };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, reason: "Nieprawidłowe transaction.amount" };
  const data: ImojeNotification = {
    transaction: {
      id,
      type,
      status: status as ImojeTransactionStatus,
      serviceId,
      amount,
      currency,
      orderId,
      title: str("title") ?? undefined,
      paymentMethod: str("paymentMethod") ?? undefined,
      paymentMethodCode: str("paymentMethodCode") ?? undefined,
      source: str("source") ?? undefined,
    },
    payment: (body as { payment?: Record<string, unknown> }).payment,
    action: (body as { action?: Record<string, unknown> }).action,
  };
  return { ok: true, data };
}

export type OrderPaymentOutcome =
  | { kind: "paid" }
  | { kind: "failed" }
  | { kind: "pending" }
  | { kind: "refunded" }
  | { kind: "ignore"; reason: string };

/** Mapowanie statusu imoje na skutek dla zamówienia. */
export function mapImojeOutcome(type: ImojeTransactionType, status: ImojeTransactionStatus): OrderPaymentOutcome {
  if (type === "refund") {
    if (status === "settled" || status === "refund") return { kind: "refunded" };
    return { kind: "ignore", reason: `zwrot w statusie ${status}` };
  }
  switch (status) {
    case "settled":
      return { kind: "paid" };
    case "rejected":
    case "cancelled":
    case "error":
      return { kind: "failed" };
    case "new":
    case "authorized":
    case "pending":
    case "submitted_for_settlement":
      return { kind: "pending" };
    default:
      return { kind: "ignore", reason: `status ${status}` };
  }
}

// --- Żądanie utworzenia linku płatności ------------------------------------------------

export interface ImojeCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface ImojePaymentLinkInput {
  serviceId: string;
  amountCents: number;
  orderId: string;
  title: string;
  customer: ImojeCustomer;
  successReturnUrl: string;
  failureReturnUrl: string;
  returnUrl: string;
  notificationUrl?: string;
  /** Ważność linku w sekundach (domyślnie 7 dni) */
  validForSeconds?: number;
  nowMs?: number;
}

export interface ImojePaymentLinkPayload {
  serviceId: string;
  amount: number;
  currency: "PLN";
  orderId: string;
  title: string;
  customer: ImojeCustomer;
  successReturnUrl: string;
  failureReturnUrl: string;
  returnUrl: string;
  notificationUrl?: string;
  validTo: number;
}

export function buildImojePaymentLinkPayload(input: ImojePaymentLinkInput): ImojePaymentLinkPayload {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Kwota płatności musi być dodatnią liczbą groszy");
  const now = input.nowMs ?? Date.now();
  const valid = input.validForSeconds ?? 7 * 24 * 3600;
  return {
    serviceId: input.serviceId,
    amount: input.amountCents,
    currency: "PLN",
    orderId: input.orderId,
    title: input.title.slice(0, 100),
    customer: {
      firstName: input.customer.firstName.slice(0, 50) || "Klient",
      lastName: input.customer.lastName.slice(0, 50) || "-",
      email: input.customer.email,
      ...(input.customer.phone ? { phone: input.customer.phone } : {}),
    },
    successReturnUrl: input.successReturnUrl,
    failureReturnUrl: input.failureReturnUrl,
    returnUrl: input.returnUrl,
    ...(input.notificationUrl ? { notificationUrl: input.notificationUrl } : {}),
    validTo: Math.floor(now / 1000) + valid,
  };
}

/** "Jan Kowalski" → { firstName: "Jan", lastName: "Kowalski" } */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Klient", lastName: "-" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Wyciąga URL do przekierowania z odpowiedzi API (payment.url lub action.url). */
export function extractImojeRedirectUrl(response: unknown): { url: string; id: string | null } | null {
  if (!response || typeof response !== "object") return null;
  const r = response as { payment?: { url?: unknown; id?: unknown }; action?: { url?: unknown }; transaction?: { id?: unknown } };
  const url = typeof r.payment?.url === "string" ? r.payment.url : typeof r.action?.url === "string" ? r.action.url : null;
  if (!url) return null;
  const id = typeof r.payment?.id === "string" ? r.payment.id : typeof r.transaction?.id === "string" ? r.transaction.id : null;
  return { url, id };
}

export function imojeApiUrl(cfg: Pick<ImojeConfig, "env" | "apiUrl">): string {
  return (cfg.apiUrl || IMOJE_API_URLS[cfg.env]).replace(/\/$/, "");
}
