// Klient Supabase z kluczem service role + identyfikacja wywołującego.
// Edge Functions omijają RLS (service role) i same sprawdzają uprawnienia.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./cors.ts";

export type AdminClient = SupabaseClient;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Brak zmiennej środowiskowej ${name}`);
  }
  return value;
}

export function createAdminClient(): AdminClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface CustomerGroupInfo {
  id: string;
  code: string;
  discount_pct: number;
  price_mode: "gross" | "net";
}

export interface CallerProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  nip: string | null;
  role: "customer" | "admin" | "staff";
  customer_group_id: string | null;
  b2b_approved: boolean;
  deferred_payment_allowed: boolean;
  customer_group: CustomerGroupInfo | null;
}

export type Caller =
  | { kind: "service" }
  | { kind: "user"; userId: string; profile: CallerProfile | null }
  | { kind: "anon" };

/** Wiersz z selecta `profiles` z joinem do `customer_groups`. */
interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  nip: string | null;
  role: "customer" | "admin" | "staff";
  customer_group_id: string | null;
  b2b_approved: boolean;
  deferred_payment_allowed: boolean;
  customer_groups:
    | { id: string; code: string; discount_pct: number | string; price_mode: "gross" | "net" }
    | null;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Ustala, kto wywołuje funkcję:
 *  - service: Bearer == SUPABASE_SERVICE_ROLE_KEY (pg_cron, skrypty);
 *  - user: poprawny JWT użytkownika (profil doładowany z `profiles`);
 *  - anon: brak tokenu, klucz anon albo nieważny token.
 */
export async function getCaller(req: Request, admin: AdminClient): Promise<Caller> {
  const token = bearerToken(req);
  if (!token) return { kind: "anon" };

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return { kind: "service" };

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (anonKey && token === anonKey) return { kind: "anon" };

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return { kind: "anon" };

  const userId = userData.user.id;
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, phone, company_name, nip, role, customer_group_id, b2b_approved, deferred_payment_allowed, customer_groups(id, code, discount_pct, price_mode)",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getCaller] błąd ładowania profilu:", error.message);
    return { kind: "user", userId, profile: null };
  }

  const row = (data ?? null) as ProfileRow | null;
  if (!row) return { kind: "user", userId, profile: null };

  const group = row.customer_groups;
  const profile: CallerProfile = {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone,
    company_name: row.company_name,
    nip: row.nip,
    role: row.role,
    customer_group_id: row.customer_group_id,
    b2b_approved: Boolean(row.b2b_approved),
    deferred_payment_allowed: Boolean(row.deferred_payment_allowed),
    customer_group: group
      ? {
        id: group.id,
        code: group.code,
        discount_pct: Number(group.discount_pct) || 0,
        price_mode: group.price_mode === "net" ? "net" : "gross",
      }
      : null,
  };
  return { kind: "user", userId, profile };
}

export function isAdminCaller(caller: Caller): boolean {
  if (caller.kind === "service") return true;
  if (caller.kind === "user") {
    const role = caller.profile?.role;
    return role === "admin" || role === "staff";
  }
  return false;
}

/** Rzuca HttpError 401/403, jeśli wywołujący nie jest service role ani admin/staff. */
export function requireAdmin(caller: Caller): void {
  if (caller.kind === "anon") {
    throw new HttpError(401, "Wymagane logowanie.", "UNAUTHORIZED");
  }
  if (!isAdminCaller(caller)) {
    throw new HttpError(403, "Brak uprawnień do tej operacji.", "FORBIDDEN");
  }
}

/** Minimalny kształt błędu PostgREST / Supabase. */
export interface DbErrorLike {
  message: string;
  code?: string;
  details?: string | null;
}

/** Rzuca Error z kontekstem, gdy zapytanie Supabase zwróciło błąd. */
export function assertNoError(error: DbErrorLike | null | undefined, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}${error.details ? ` (${error.details})` : ""}`);
  }
}

/** Wynik zapytania PostgREST (thenable builder) w minimalnej, wspólnej postaci. */
export interface DbResult {
  data: unknown;
  error: DbErrorLike | null;
}

/**
 * Pobiera wszystkie wiersze stronami (PostgREST domyślnie ucina odpowiedź do 1000 wierszy).
 * `build(from, to)` musi zwrócić builder z już nałożonymi filtrami; `.range()` dokładamy tutaj.
 */
export async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<DbResult>,
  context: string,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await build(from, from + pageSize - 1);
    assertNoError(error, context);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/** Dzieli tablicę na paczki o zadanym rozmiarze. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
