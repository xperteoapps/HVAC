import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category, CategoryNode } from "@/types";

export function buildCategoryTree(categories: Category[], counts: Record<string, number>): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const c of categories) byId.set(c.id, { ...c, children: [], product_count: counts[c.id] ?? 0 });
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id)!.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pl"));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function findCategoryPath(tree: CategoryNode[], slug: string): CategoryNode[] {
  for (const node of tree) {
    if (node.slug === slug) return [node];
    const sub = findCategoryPath(node.children, slug);
    if (sub.length) return [node, ...sub];
  }
  return [];
}

export function flattenTree(tree: CategoryNode[]): CategoryNode[] {
  return tree.flatMap((n) => [n, ...flattenTree(n.children)]);
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [{ data: cats, error }, { data: counts, error: cErr }] = await Promise.all([
        supabase.from("categories").select("*").order("position"),
        supabase.rpc("category_product_counts"),
      ]);
      if (error) throw error;
      if (cErr) throw cErr;
      const countMap: Record<string, number> = {};
      for (const row of counts ?? []) countMap[row.category_id] = Number(row.product_count);
      const tree = buildCategoryTree(cats ?? [], countMap);
      return { tree, flat: flattenTree(tree), all: cats ?? [] };
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAttributeDefs() {
  return useQuery({
    queryKey: ["attribute_defs"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_attributes_def").select("*").order("position");
      if (error) throw error;
      return data;
    },
  });
}
