import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function DataTablePagination({ page, pageSize, total, onPageChange, className }: DataTablePaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground", className)}>
      <span>
        {from}–{to} z {total}
      </span>
      <div className="flex items-center gap-2">
        <span>
          Strona {page} z {pages}
        </span>
        <Button variant="outline" size="icon" aria-label="Poprzednia strona" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" aria-label="Następna strona" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
