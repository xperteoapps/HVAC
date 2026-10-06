import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/formatters";
import type { ShippingCalcResult } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function ShippingSelector({
  result,
  loading,
  error,
  value,
  onChange,
}: {
  result: ShippingCalcResult | undefined;
  loading: boolean;
  error?: string | null;
  value: string;
  onChange: (code: string) => void;
}) {
  const { priceMode } = useAuth();
  if (loading && !result) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!result || result.options.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak dostępnych metod dostawy dla tego koszyka — skontaktuj się z nami.</p>;
  }
  return (
    <div className="space-y-3">
      {result.needsPallet && (
        <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Zamówienie wymaga dostawy paletowej (waga {result.totalWeightKg.toFixed(1)} kg lub towar gabarytowy).
        </p>
      )}
      <RadioGroup value={value} onValueChange={onChange}>
        {result.options.map((o) => (
          <label
            key={o.code}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-secondary/50",
              value === o.code && "border-accent bg-accent/5",
            )}
          >
            <RadioGroupItem value={o.code} id={`ship-${o.code}`} />
            <span className="flex-1">
              <span className="block text-sm font-medium">{o.name}</span>
              {o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}
            </span>
            <span className="text-sm font-semibold">
              {o.free
                ? "Gratis"
                : o.price_net_cents === 0
                  ? "0,00 zł"
                  : formatPrice(priceMode === "net" ? o.price_net_cents : o.price_gross_cents)}
              {!o.free && o.price_net_cents > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">{priceMode === "net" ? "netto" : "brutto"}</span>
              )}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
