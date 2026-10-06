import { Truck, Package, ShieldCheck } from "lucide-react";
import { Price } from "@/components/common/Price";
import { StockBadge } from "./StockBadge";
import { AddToCart } from "./AddToCart";
import type { ProductListItem } from "@/types";
import { formatWeight } from "@/lib/formatters";

export function PriceBox({ product }: { product: ProductListItem }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <Price product={product} size="lg" />
      <div className="mt-3">
        <StockBadge status={product.stock_status} stock={product.stock_total} leadTimeDays={product.lead_time_days} size="md" />
      </div>
      <AddToCart product={product} className="mt-4" />
      <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-accent" />
          {product.pallet_required || (product.weight_kg !== null && Number(product.weight_kg) > 30)
            ? "Dostawa paletowa (2–4 dni robocze)"
            : "Kurier 1–2 dni robocze, od 16,90 zł"}
        </li>
        <li className="flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" />
          Waga: {formatWeight(product.weight_kg)} · SKU: {product.sku}
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Gwarancja producenta · faktura VAT
        </li>
      </ul>
    </div>
  );
}
