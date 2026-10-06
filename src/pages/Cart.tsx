import { Link } from "react-router-dom";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { CartLine } from "@/components/cart/CartLine";
import { CartSummary } from "@/components/cart/CartSummary";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";

export default function Cart() {
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const hasUnavailable = items.some((i) => i.stock_status === "unavailable");

  return (
    <div>
      <Seo title="Koszyk" noindex />
      <PageHeader title="Koszyk" />
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-10 w-10" />}
          title="Twój koszyk jest pusty"
          description="Dodaj produkty z katalogu, aby przejść do zamówienia."
          action={
            <Button asChild>
              <Link to="/kategoria/klimatyzacja">Przeglądaj produkty</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border bg-card px-4">
            <div className="divide-y">
              {items.map((item) => (
                <CartLine key={item.product_id} item={item} />
              ))}
            </div>
            <div className="flex justify-between py-3">
              <Button variant="ghost" size="sm" onClick={clear}>
                Wyczyść koszyk
              </Button>
              <Button variant="link" size="sm" asChild>
                <Link to="/">Kontynuuj zakupy</Link>
              </Button>
            </div>
          </div>
          <aside className="h-fit rounded-lg border bg-card p-4 lg:sticky lg:top-40">
            <h2 className="mb-3 text-lg font-semibold">Podsumowanie</h2>
            <CartSummary />
            {hasUnavailable && <p className="mt-3 text-xs text-destructive">Niektóre produkty są niedostępne — usuń je, aby złożyć zamówienie.</p>}
            <Button variant="accent" size="lg" className="mt-4 w-full" disabled={hasUnavailable} asChild={!hasUnavailable}>
              {hasUnavailable ? (
                <span>Przejdź do zamówienia</span>
              ) : (
                <Link to="/zamowienie">
                  Przejdź do zamówienia <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
