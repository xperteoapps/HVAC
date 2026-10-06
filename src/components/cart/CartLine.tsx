import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QtyInput } from "@/components/common/QtyInput";
import { StockBadge } from "@/components/product/StockBadge";
import { useCartStore, type CartItem } from "@/lib/cart-store";
import { useAuth } from "@/hooks/useAuth";
import { displayPrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/formatters";

export function CartLine({ item, compact = false }: { item: CartItem; compact?: boolean }) {
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const { pricing } = useAuth();
  const price = displayPrice(item, pricing);
  const unit = price?.main ?? 0;
  return (
    <div className="flex gap-3 py-3">
      <Link to={`/produkt/${item.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-white">
        {item.image ? <img src={item.image} alt="" className="h-full w-full object-contain p-1" /> : null}
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/produkt/${item.slug}`} className="line-clamp-2 text-sm font-medium hover:text-accent">
          {item.name}
        </Link>
        <p className="text-xs text-muted-foreground">{item.sku}</p>
        {item.stock_status === "unavailable" && <StockBadge status="unavailable" className="mt-1" />}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <QtyInput value={item.qty} onChange={(q) => updateQty(item.product_id, q)} size="sm" />
          <div className="text-right">
            <div className="text-sm font-semibold">{formatPrice(unit * item.qty)}</div>
            {!compact && (
              <div className="text-xs text-muted-foreground">
                {formatPrice(unit)} / szt. {pricing.mode === "net" ? "netto" : "brutto"}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeItem(item.product_id)} aria-label="Usuń z koszyka">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
