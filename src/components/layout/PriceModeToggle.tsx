import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function PriceModeToggle({ className }: { className?: string }) {
  const { priceMode, setPriceMode } = useAuth();
  return (
    <div className={cn("inline-flex items-center rounded-md border bg-background p-0.5 text-xs", className)} role="group" aria-label="Tryb cen">
      {(["gross", "net"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setPriceMode(m)}
          className={cn("rounded px-2 py-1 font-medium transition-colors", priceMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          aria-pressed={priceMode === m}
        >
          {m === "gross" ? "Brutto" : "Netto"}
        </button>
      ))}
    </div>
  );
}
