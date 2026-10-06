import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderEvent, OrderItem } from "@/types";

export function useMyOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-orders", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("profile_id", userId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });
}

export function useOrderDetails(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order", orderId],
    enabled: Boolean(orderId),
    queryFn: async () => {
      const [{ data: order, error }, { data: items, error: iErr }, { data: events, error: eErr }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId!).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", orderId!).order("created_at"),
        supabase.from("order_events").select("*").eq("order_id", orderId!).order("created_at"),
      ]);
      if (error) throw error;
      if (iErr) throw iErr;
      if (eErr) throw eErr;
      return { order: order as Order | null, items: (items ?? []) as OrderItem[], events: (events ?? []) as OrderEvent[] };
    },
  });
}

export function useMyAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: ["addresses", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("addresses").select("*").eq("profile_id", userId!).order("is_default", { ascending: false }).order("created_at");
      if (error) throw error;
      return data;
    },
  });
}
