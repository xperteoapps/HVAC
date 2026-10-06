import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, LayoutGrid, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { SearchInput } from "@/components/admin/SearchInput";
import { DataTablePagination } from "@/components/admin/DataTablePagination";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/StatusBadge";
import { ORDER_STATUSES, centsToCsv, downloadCsv, errorMessage, sanitizeSearch } from "@/components/admin/helpers";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, formatDate, formatPrice } from "@/lib/formatters";
import { asAddress, type Order } from "@/types";

const PAGE_SIZE = 25;
const LOAD_LIMIT = 500;

function customerLabel(o: Order): { primary: string; secondary: string | null } {
  const addr = asAddress(o.shipping_address);
  const company = addr?.company_name?.trim();
  const name = addr?.full_name?.trim();
  return { primary: o.email, secondary: company || name || null };
}

export function Orders() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "board">("list");
  const [page, setPage] = useState(1);

  const orders = useQuery({
    queryKey: ["admin-orders", { status, search }],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(LOAD_LIMIT);
      if (status !== "all") q = q.eq("status", status);
      const s = sanitizeSearch(search);
      if (s) q = q.or(`number.ilike.%${s}%,email.ilike.%${s}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const rows = useMemo(() => orders.data ?? [], [orders.data]);
  const pageRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.info("Brak zamówień do eksportu");
      return;
    }
    try {
      const header = [
        "Numer",
        "Data",
        "E-mail",
        "Telefon",
        "Klient",
        "Firma",
        "NIP",
        "Status",
        "Płatność",
        "Netto",
        "VAT",
        "Dostawa netto",
        "Brutto",
        "Metoda dostawy",
        "Przewoźnik",
        "Nr przesyłki",
        "Grupa",
      ];
      const data = rows.map((o) => {
        const addr = asAddress(o.shipping_address);
        return [
          o.number,
          formatDate(o.created_at, true),
          o.email,
          o.phone ?? addr?.phone ?? "",
          addr?.full_name ?? "",
          addr?.company_name ?? "",
          o.nip ?? "",
          ORDER_STATUS_LABELS[o.status] ?? o.status,
          PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status,
          centsToCsv(o.subtotal_net_cents),
          centsToCsv(o.vat_cents),
          centsToCsv(o.shipping_net_cents),
          centsToCsv(o.total_gross_cents),
          o.shipping_method ?? "",
          o.carrier ?? "",
          o.tracking_number ?? "",
          o.customer_group_code,
        ];
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`zamowienia-${stamp}.csv`, header, data);
      toast.success(`Wyeksportowano ${rows.length} zamówień`);
    } catch (e) {
      toast.error(errorMessage(e, "Eksport nie powiódł się"));
    }
  };

  return (
    <div>
      <Seo noindex title="Zamówienia · Panel admina" />
      <PageHeader
        title="Zamówienia"
        description="Lista i tablica zamówień. Kliknij wiersz, aby przejść do szczegółów."
        actions={
          <>
            <div className="flex rounded-md border">
              <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="rounded-r-none" onClick={() => setView("list")} aria-label="Widok listy">
                <List /> <span className="hidden sm:inline">Lista</span>
              </Button>
              <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="rounded-l-none" onClick={() => setView("board")} aria-label="Widok tablicy">
                <LayoutGrid /> <span className="hidden sm:inline">Tablica</span>
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={orders.isLoading}>
              <Download /> CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Numer zamówienia lub e-mail…"
          className="sm:max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-56" aria-label="Filtr statusu">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {orders.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(orders.error)}</p>}

      {orders.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Brak zamówień" description="Nie znaleziono zamówień spełniających kryteria." />
      ) : view === "list" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numer</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Płatność</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((o) => {
                const c = customerLabel(o);
                return (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/admin/zamowienia/${o.id}`)}>
                    <TableCell className="font-medium whitespace-nowrap">{o.number}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(o.created_at, true)}</TableCell>
                    <TableCell>
                      <p className="max-w-[14rem] truncate">{c.primary}</p>
                      {c.secondary && <p className="max-w-[14rem] truncate text-xs text-muted-foreground">{c.secondary}</p>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">{formatPrice(o.total_gross_cents)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={o.payment_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/admin/zamowienia/${o.id}`}>Szczegóły</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <DataTablePagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} className="border-t p-3" />
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex gap-3">
            {ORDER_STATUSES.filter((s) => status === "all" || s === status).map((s) => {
              const col = rows.filter((o) => o.status === s);
              return (
                <div key={s} className="w-64 shrink-0 rounded-lg border bg-background">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <OrderStatusBadge status={s} />
                    <span className="text-xs text-muted-foreground">{col.length}</span>
                  </div>
                  <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                    {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Brak</p>}
                    {col.map((o) => {
                      const c = customerLabel(o);
                      return (
                        <Link
                          key={o.id}
                          to={`/admin/zamowienia/${o.id}`}
                          className="block rounded-md border bg-card p-2.5 text-sm shadow-sm transition-colors hover:border-accent"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{o.number}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{c.secondary ?? c.primary}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <PaymentStatusBadge status={o.payment_status} />
                            <span className="font-semibold tabular-nums">{formatPrice(o.total_gross_cents)}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {rows.length >= LOAD_LIMIT && (
        <p className="mt-2 text-xs text-muted-foreground">Wyświetlono {LOAD_LIMIT} najnowszych zamówień — zawęź filtry, aby zobaczyć starsze.</p>
      )}
    </div>
  );
}
