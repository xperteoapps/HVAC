import { Link } from "react-router-dom";
import { Price } from "@/components/common/Price";
import { StockBadge } from "@/components/product/StockBadge";
import { AddToCart } from "@/components/product/AddToCart";
import type { ProductListItem } from "@/types";
import { asAttributes } from "@/types";
import { cn } from "@/lib/utils";

const KEY_ATTRS: Array<[string, string, string?]> = [
  ["moc_chlodnicza_kw", "Chłodzenie", "kW"],
  ["moc_grzewcza_kw", "Grzanie", "kW"],
  ["klasa_energetyczna_chlodzenie", "Klasa"],
  ["czynnik", "Czynnik"],
  ["zasilanie", "Zasilanie"],
  ["wydajnosc_m3h", "Wydajność", "m³/h"],
];

export function ProductCard({ product, view = "grid" }: { product: ProductListItem; view?: "grid" | "list" }) {
  const attrs = asAttributes(product.attributes);
  const highlights = KEY_ATTRS.filter(([k]) => attrs[k] !== undefined && attrs[k] !== null).slice(0, view === "list" ? 5 : 3);
  const image = product.images?.[0];
  const href = `/produkt/${product.slug}`;

  return (
    <article
      className={cn(
        "group relative flex overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md",
        view === "grid" ? "flex-col" : "flex-row gap-4 p-3",
      )}
    >
      <Link to={href} className={cn("block shrink-0 overflow-hidden bg-white", view === "grid" ? "aspect-square w-full" : "h-36 w-36 rounded-md border sm:h-44 sm:w-44")}>
        {image ? (
          <img src={image} alt={product.name} loading="lazy" className="h-full w-full object-contain p-3 transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">brak zdjęcia</div>
        )}
      </Link>
      <div className={cn("flex min-w-0 flex-1 flex-col", view === "grid" ? "p-3 sm:p-4" : "")}>
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{product.brand?.name ?? " "}</span>
          <span className="shrink-0">{product.sku}</span>
        </div>
        <Link to={href} className="line-clamp-2 text-sm font-medium leading-snug hover:text-accent">
          {product.name}
        </Link>
        {highlights.length > 0 && (
          <dl className={cn("mt-2 grid gap-x-3 gap-y-0.5 text-xs text-muted-foreground", view === "list" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1")}>
            {highlights.map(([k, label, unit]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt>{label}</dt>
                <dd className="font-medium text-foreground">
                  {String(attrs[k])}
                  {unit ? ` ${unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-auto pt-3">
          <StockBadge status={product.stock_status} stock={product.stock_total} leadTimeDays={product.lead_time_days} />
          <div className={cn("mt-2 flex items-end justify-between gap-2", view === "list" && "sm:mt-3")}>
            <Price product={product} size="sm" />
            <AddToCart product={product} compact />
          </div>
        </div>
      </div>
    </article>
  );
}
