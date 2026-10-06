import { useAuth } from "@/hooks/useAuth";
import { displayPrice, type ProductPriceInput } from "@/lib/pricing";
import { formatPrice } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface PriceProps {
  product: ProductPriceInput;
  size?: "sm" | "md" | "lg";
  showSecondary?: boolean;
  className?: string;
}

/** Cena wg trybu użytkownika (B2C brutto / B2B netto + rabat), z ceną pomocniczą. */
export function Price({ product, size = "md", showSecondary = true, className }: PriceProps) {
  const { pricing } = useAuth();
  const p = displayPrice(product, pricing);
  if (!p) return <span className={cn("text-muted-foreground", className)}>Cena na zapytanie</span>;
  const mainCls = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("font-bold leading-tight text-foreground", mainCls)}>
        {formatPrice(p.main)} <span className="text-xs font-normal text-muted-foreground">{pricing.mode === "net" ? "netto" : "brutto"}</span>
      </span>
      {showSecondary && (
        <span className="text-xs text-muted-foreground">
          {formatPrice(p.secondary)} {pricing.mode === "net" ? "brutto" : "netto"}
          {p.discountPct > 0 && (
            <>
              {" "}
              · rabat {p.discountPct}% <s>{formatPrice(pricing.mode === "net" ? p.listNet : p.listGross)}</s>
            </>
          )}
        </span>
      )}
    </div>
  );
}
