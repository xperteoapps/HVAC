import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_QTY } from "@/lib/cart-store";

export function QtyInput({ value, onChange, size = "md" }: { value: number; onChange: (qty: number) => void; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-8" : "h-10";
  const set = (n: number) => onChange(Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1)));
  return (
    <div className={`inline-flex items-center rounded-md border ${h}`}>
      <Button type="button" variant="ghost" size="icon" className={`${h} w-8 rounded-r-none`} onClick={() => set(value - 1)} aria-label="Zmniejsz ilość">
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_QTY}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="h-full w-12 border-x bg-transparent text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Ilość"
      />
      <Button type="button" variant="ghost" size="icon" className={`${h} w-8 rounded-l-none`} onClick={() => set(value + 1)} aria-label="Zwiększ ilość">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
