import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStaticPage(slug: string | undefined) {
  return useQuery({
    queryKey: ["static_page", slug],
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("static_pages").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useStaticPages() {
  return useQuery({
    queryKey: ["static_pages"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("static_pages").select("slug, title, position").eq("published", true).order("position");
      if (error) throw error;
      return data;
    },
  });
}
