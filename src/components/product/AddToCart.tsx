import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QtyInput } from "@/components/common/QtyInput";
import { useCartStore } from "@/lib/cart-store";
import { toCartItem } from "@/hooks/useCartSync";
import type { ProductListItem } from "@/types";
import { toast } from "@/components/ui/sonner";

export function AddToCart({ product, compact = false, className }: { product: ProductListItem; compact?: boolean; className?: string }) {
  const addItem = useCartStore((s) => s.addItem);
  const [qty, setQty] = useState(1);
  const disabled = product.stock_status === "unavailable" || product.price_net_cents === null;

  const add = () => {
    addItem(toCartItem(product), qty);
    toast.success("Dodano do koszyka", { description: product.name });
  };

  if (compact) {
    return (
      <Button size="sm" variant="accent" onClick={add} disabled={disabled} className={className} aria-label={`Dodaj do koszyka: ${product.name}`}>
        <ShoppingCart className="h-4 w-4" />
        Do koszyka
      </Button>
    );
  }
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <QtyInput value={qty} onChange={setQty} />
        <Button size="lg" variant="accent" onClick={add} disabled={disabled} className="min-w-0 flex-1 basis-48 px-4">
          <ShoppingCart className="h-5 w-5" />
          <span className="truncate">{disabled ? "Niedostępny" : "Dodaj do koszyka"}</span>
        </Button>
      </div>
    </div>
  );
}
