import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ShippingCalcResult } from "@/types";

export interface ShippingCalcInput {
  items: Array<{ product_id: string; qty: number }>;
  postal_code?: string;
}

export async function calcShipping(input: ShippingCalcInput): Promise<ShippingCalcResult> {
  const { data, error } = await supabase.functions.invoke<ShippingCalcResult>("calc-shipping", { body: input });
  if (error) throw new Error(await extractFunctionError(error, "Nie udało się obliczyć kosztów dostawy"));
  if (!data) throw new Error("Brak odpowiedzi z kalkulatora dostawy");
  return data;
}

export function useShippingOptions(input: ShippingCalcInput | null) {
  return useQuery({
    queryKey: ["shipping", input],
    enabled: Boolean(input && input.items.length > 0),
    staleTime: 30 * 1000,
    queryFn: () => calcShipping(input!),
  });
}

/** Wyciąga komunikat błędu zwrócony przez Edge Function ({ error: { message } }). */
export async function extractFunctionError(error: unknown, fallback: string): Promise<string> {
  const e = error as { context?: Response; message?: string };
  try {
    if (e?.context && typeof e.context.json === "function") {
      const body = (await e.context.json()) as { error?: { message?: string } };
      if (body?.error?.message) return body.error.message;
    }
  } catch {
    /* ignore */
  }
  return e?.message && !/non-2xx|FunctionsHttpError/.test(e.message) ? e.message : fallback;
}
