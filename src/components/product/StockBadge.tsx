import { Badge } from "@/components/ui/badge";
import { STOCK_STATUS_LABELS } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  in_stock: "bg-success",
  low: "bg-warning",
  on_order: "bg-accent",
  unavailable: "bg-muted-foreground",
};

export function StockBadge({ status, stock, leadTimeDays, className, size = "sm" }: { status: string; stock?: number; leadTimeDays?: number | null; className?: string; size?: "sm" | "md" }) {
  let label = STOCK_STATUS_LABELS[status] ?? status;
  if (status === "on_order" && leadTimeDays) label += ` · ok. ${leadTimeDays} dni`;
  if (status === "low" && stock) label += ` (${stock} szt.)`;
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", size === "md" && "px-3 py-1 text-sm", className)}>
      <span className={cn("h-2 w-2 rounded-full", DOT[status] ?? DOT.unavailable)} aria-hidden />
      {label}
    </Badge>
  );
}
