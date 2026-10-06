import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (!isSupabaseConfigured) {
  console.warn("Brak VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — skopiuj .env.example do .env");
}

export const supabase = createClient<Database>(SUPABASE_URL ?? "http://localhost:54321", SUPABASE_KEY ?? "anon", {
  auth: { persistSession: true, autoRefreshToken: true, storage: typeof window !== "undefined" ? localStorage : undefined },
});

export function functionsUrl(name: string): string {
  return `${SUPABASE_URL ?? "http://localhost:54321"}/functions/v1/${name}`;
}
