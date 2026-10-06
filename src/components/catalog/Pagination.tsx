import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const window = new Set<number>([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const list = [...window].sort((a, b) => a - b);
  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Paginacja">
      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Poprzednia strona">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {list.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && list[i - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Button variant={p === page ? "default" : "outline"} size="icon" onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined}>
            {p}
          </Button>
        </span>
      ))}
      <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Następna strona">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
