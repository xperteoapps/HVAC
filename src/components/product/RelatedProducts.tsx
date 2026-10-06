import { useRelatedProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/catalog/ProductCard";

const GROUP_LABELS: Record<string, string> = {
  accessory: "Akcesoria montażowe do tego produktu",
  indoor_unit: "Jednostki wewnętrzne",
  outdoor_unit: "Jednostki zewnętrzne",
  similar: "Podobne produkty",
};

export function RelatedProducts({ productId }: { productId: string }) {
  const { data } = useRelatedProducts(productId);
  if (!data || !data.length) return null;
  const groups = new Map<string, typeof data>();
  for (const p of data) groups.set(p.relation_type, [...(groups.get(p.relation_type) ?? []), p]);
  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([type, items]) => (
        <section key={type}>
          <h2 className="mb-4 text-xl font-semibold">{GROUP_LABELS[type] ?? "Produkty powiązane"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
