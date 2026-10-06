import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/lib/cart-store";
import { cartTotals, orderTotals } from "@/lib/pricing";
import { formatPrice } from "@/lib/formatters";
import { Separator } from "@/components/ui/separator";

export function CartSummary({ shippingNetCents, shippingLabel }: { shippingNetCents?: number | null; shippingLabel?: string }) {
  const items = useCartStore((s) => s.items);
  const { pricing } = useAuth();
  const totals = cartTotals(items, pricing);
  const withShipping = shippingNetCents !== null && shippingNetCents !== undefined ? orderTotals(totals, shippingNetCents) : null;
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Wartość netto</dt>
        <dd>{formatPrice(totals.subtotalNet)}</dd>
      </div>
      {pricing.discountPct > 0 && (
        <div className="flex justify-between text-xs text-success">
          <dt>Rabat B2B {pricing.discountPct}% uwzględniony</dt>
          <dd />
        </div>
      )}
      {withShipping ? (
        <>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Dostawa{shippingLabel ? ` (${shippingLabel})` : ""} netto</dt>
            <dd>{withShipping.shippingNet === 0 ? "Gratis" : formatPrice(withShipping.shippingNet)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">VAT</dt>
            <dd>{formatPrice(withShipping.vat)}</dd>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-semibold">
            <dt>Razem do zapłaty</dt>
            <dd>{formatPrice(withShipping.totalGross)}</dd>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">VAT</dt>
            <dd>{formatPrice(totals.vat)}</dd>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-semibold">
            <dt>Razem brutto</dt>
            <dd>{formatPrice(totals.subtotalGross)}</dd>
          </div>
          <p className="text-xs text-muted-foreground">Koszt dostawy obliczymy w następnym kroku.</p>
        </>
      )}
    </dl>
  );
}
