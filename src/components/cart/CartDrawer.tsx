import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCartStore, selectCartCount } from "@/lib/cart-store";
import { CartLine } from "./CartLine";
import { CartSummary } from "./CartSummary";
import { plural } from "@/lib/formatters";

export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen);
  const setOpen = useCartStore((s) => s.setOpen);
  const items = useCartStore((s) => s.items);
  const count = useCartStore(selectCartCount);
  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Koszyk ({plural(count, "produkt", "produkty", "produktów")})</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <ShoppingCart className="h-10 w-10" />
              Twój koszyk jest pusty.
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Wróć do zakupów
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <CartLine key={item.product_id} item={item} compact />
              ))}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="space-y-3 border-t p-4">
            <CartSummary />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" asChild onClick={() => setOpen(false)}>
                <Link to="/koszyk">Zobacz koszyk</Link>
              </Button>
              <Button variant="accent" asChild onClick={() => setOpen(false)}>
                <Link to="/zamowienie">Do kasy</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
