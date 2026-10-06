import { supabase } from "@/integrations/supabase/client";
import { extractFunctionError } from "@/hooks/useShipping";

export type PayOnlineArgs = { order_id: string } | { order_number: string; email: string };

/** Generuje nowy link płatności imoje (Edge Function `create-payment`) i przekierowuje do bramki. */
export async function startOnlinePayment(args: PayOnlineArgs): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ payment: { redirectUrl: string } }>("create-payment", { body: args });
  if (error) throw new Error(await extractFunctionError(error, "Nie udało się uruchomić płatności online"));
  const url = data?.payment?.redirectUrl;
  if (!url) throw new Error("Bramka płatności nie zwróciła adresu");
  window.location.assign(url);
}
