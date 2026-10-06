import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
import { expect, type Page, type BrowserContext } from "@playwright/test";

interface E2EEnv {
  E2E_API_URL: string;
  E2E_ANON_KEY: string;
  E2E_SERVICE_ROLE_KEY: string;
}

function env(): E2EEnv {
  if (process.env.E2E_SERVICE_ROLE_KEY) return process.env as unknown as E2EEnv;
  const file = join(HERE, ".env.e2e.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as E2EEnv;
  throw new Error("Brak kluczy e2e — globalSetup nie zadziałał");
}

/** Wywołanie REST/Auth/Functions lokalnego Supabase kluczem service_role. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const e = env();
  const res = await fetch(`${e.E2E_API_URL}${path}`, {
    ...init,
    headers: {
      apikey: e.E2E_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${e.E2E_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

export interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price_net_cents: number;
  price_gross_cents: number;
  best_supplier_id: string;
}

export async function getProduct(sku: string): Promise<ProductRow> {
  const rows = await api<ProductRow[]>(`/rest/v1/products?sku=eq.${encodeURIComponent(sku)}&select=id,sku,slug,name,price_net_cents,price_gross_cents,best_supplier_id`);
  if (!rows[0]) throw new Error(`Brak produktu ${sku}`);
  return rows[0];
}

/** Tworzy użytkownika z potwierdzonym e-mailem (Auth Admin API) i zwraca jego id. */
export async function createUser(email: string, password: string, fullName: string): Promise<string> {
  const user = await api<{ id: string }>("/auth/v1/admin/users", {
    method: "POST",
    json: { email, password, email_confirm: true, user_metadata: { full_name: fullName } },
  });
  return user.id;
}

export async function updateProfile(id: string, patch: Record<string, unknown>) {
  await api(`/rest/v1/profiles?id=eq.${id}`, { method: "PATCH", json: patch });
}

export async function customerGroupId(code: string): Promise<string> {
  const rows = await api<Array<{ id: string }>>(`/rest/v1/customer_groups?code=eq.${code}&select=id`);
  return rows[0].id;
}

export async function getOrder(number: string) {
  const rows = await api<Array<Record<string, unknown>>>(`/rest/v1/orders?number=eq.${encodeURIComponent(number)}&select=*`);
  return rows[0];
}

export async function runSync(code = "mock") {
  return api<{ status: string }>("/functions/v1/sync-supplier", { method: "POST", json: { supplierCode: code, source: "manual" } });
}

/** Podpisana notyfikacja imoje (jak wysyła bramka): sha256(rawBody + serviceKey). */
export async function sendImojeNotification(tx: Record<string, unknown>, serviceKey = process.env.IMOJE_SERVICE_KEY ?? "lokalny-klucz-testowy") {
  const merchantId = process.env.IMOJE_MERCHANT_ID ?? "testmerchant";
  const serviceId = process.env.IMOJE_SERVICE_ID ?? "11111111-2222-3333-4444-555555555555";
  const body = JSON.stringify({ transaction: { serviceId, currency: "PLN", type: "sale", ...tx } });
  const signature = createHash("sha256").update(body + serviceKey).digest("hex");
  const res = await fetch(`${env().E2E_API_URL}/functions/v1/payment-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Imoje-Signature": `merchantid=${merchantId};serviceid=${serviceId};signature=${signature};alg=sha256` },
    body,
  });
  return { status: res.status, body: await res.text() };
}

export const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@sklep.test`;

/** Zgoda cookies zapisana z góry (baner nie zasłania przycisków) + blokada zewnętrznych zasobów. */
export async function prepareContext(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("hvac-consent-v1", JSON.stringify({ analytics: false, marketing: false, ts: Date.now() }));
    } catch {
      /* ignore */
    }
  });
  await context.route(/^https:\/\/(placehold\.co|example\.com)\//, (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>" }));
}

/** Normalizacja tekstu ceny (spacje twarde/zwykłe) do porównań. */
export const squash = (s: string | null | undefined) => (s ?? "").replace(/\s/g, "");

export function plnText(cents: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 }).format(cents / 100);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/logowanie");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/konto/);
}

export async function fillCheckout(page: Page, opts: { email?: string; name?: string } = {}) {
  if (opts.email !== undefined) await page.locator("#email").fill(opts.email);
  if (opts.name !== undefined) await page.locator("#full_name").fill(opts.name);
  await page.locator("#phone").fill("600 100 200");
  await page.locator('[id="shipping.full_name"]').fill(opts.name ?? "Jan Testowy");
  await page.locator('[id="shipping.street"]').fill("Prosta");
  await page.locator('[id="shipping.building_no"]').fill("12");
  await page.locator('[id="shipping.postal_code"]').fill("00-850");
  await page.locator('[id="shipping.city"]').fill("Warszawa");
  await page.getByRole("checkbox", { name: /Akceptuję regulamin/ }).click();
  await page.getByRole("checkbox", { name: /Zapoznałem się z/ }).click();
}
