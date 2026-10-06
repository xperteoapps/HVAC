import { useCartStore } from "@/lib/cart-store";
import { CartSummary } from "@/components/cart/CartSummary";
import { useAuth } from "@/hooks/useAuth";
import { displayPrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/formatters";
import type { ShippingOption } from "@/types";

export function OrderReview({ shipping }: { shipping: ShippingOption | undefined }) {
  const items = useCartStore((s) => s.items);
  const { pricing } = useAuth();
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border">
        {items.map((i) => {
          const p = displayPrice(i, pricing);
          return (
            <li key={i.product_id} className="flex items-center gap-3 p-3 text-sm">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded border bg-white">
                {i.image && <img src={i.image} alt="" className="h-full w-full object-contain p-0.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground">
                  {i.qty} × {formatPrice(p?.main ?? 0)}
                </p>
              </div>
              <span className="font-semibold">{formatPrice((p?.main ?? 0) * i.qty)}</span>
            </li>
          );
        })}
      </ul>
      <CartSummary shippingNetCents={shipping ? shipping.price_net_cents : null} shippingLabel={shipping?.name} />
    </div>
  );
}
