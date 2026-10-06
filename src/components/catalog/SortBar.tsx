import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SORT_LABELS, type SortKey } from "@/hooks/useProducts";
import { plural } from "@/lib/formatters";

export function SortBar({ total, sort, view, onSort, onView, onOpenFilters, activeCount }: { total: number; sort: SortKey; view: "grid" | "list"; onSort: (s: SortKey) => void; onView: (v: "grid" | "list") => void; onOpenFilters?: () => void; activeCount?: number }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm text-muted-foreground">{plural(total, "produkt", "produkty", "produktów")}</p>
      {onOpenFilters && (
        <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenFilters}>
          <SlidersHorizontal className="h-4 w-4" /> Filtry{activeCount ? ` (${activeCount})` : ""}
        </Button>
      )}
      <Select value={sort} onValueChange={(v) => onSort(v as SortKey)}>
        <SelectTrigger className="h-9 w-[170px]" aria-label="Sortowanie">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <SelectItem key={k} value={k}>
              {SORT_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="hidden items-center rounded-md border sm:flex">
        <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => onView("grid")} aria-label="Widok siatki" aria-pressed={view === "grid"}>
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => onView("list")} aria-label="Widok listy" aria-pressed={view === "list"}>
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
