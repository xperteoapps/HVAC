import { ProductCard } from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import type { ProductListItem } from "@/types";
import { cn } from "@/lib/utils";

export function ProductGrid({ products, loading, view = "grid", emptyTitle = "Brak produktów", emptyDescription }: { products: ProductListItem[] | undefined; loading?: boolean; view?: "grid" | "list"; emptyTitle?: string; emptyDescription?: string }) {
  if (loading && !products) {
    return (
      <div className={cn("grid gap-4", view === "grid" ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "grid-cols-1")}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={view === "grid" ? "aspect-[3/4]" : "h-40"} />
        ))}
      </div>
    );
  }
  if (!products || products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription ?? "Zmień filtry lub wyszukaj inną frazę."} />;
  }
  return (
    <div className={cn("grid gap-3 sm:gap-4", view === "grid" ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "grid-cols-1", loading && "opacity-60")}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} view={view} />
      ))}
    </div>
  );
}
