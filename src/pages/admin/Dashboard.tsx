import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Clock, EyeOff, Link2, Loader2, Package, RefreshCw, ShoppingCart, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { StatCard } from "@/components/admin/StatCard";
import { OrderStatusBadge, PaymentStatusBadge, SyncStatusBadge } from "@/components/admin/StatusBadge";
import { errorMessage, runSupplierSync } from "@/components/admin/helpers";
import { formatDate, formatPrice } from "@/lib/formatters";
import type { Order, Supplier } from "@/types";

interface DashboardStats {
  orders_today?: number;
  orders_week?: number;
  revenue_week_gross_cents?: number;
  orders_awaiting?: number;
  products_active?: number;
  products_hidden?: number;
  offers_unmapped?: number;
  b2b_pending?: number;
}

type RecentOrder = Pick<Order, "id" | "number" | "email" | "status" | "payment_status" | "total_gross_cents" | "created_at">;

export function Dashboard() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState<string | null>(null);

  const stats = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats");
      if (error) throw error;
      return (data ?? {}) as unknown as DashboardStats;
    },
  });

  const suppliers = useQuery({
    queryKey: ["admin-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("priority");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const recent = useQuery({
    queryKey: ["admin-orders-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, email, status, payment_status, total_gross_cents, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as RecentOrder[];
    },
  });

  const sync = async (supplier: Supplier) => {
    setSyncing(supplier.code);
    try {
      const result = await runSupplierSync(supplier.code);
      if (result.ok) toast.success(`${supplier.name}: ${result.message}`);
      else toast.warning(`${supplier.name}: ${result.message}`);
    } catch (e) {
      toast.error(errorMessage(e, "Synchronizacja nie powiodła się"));
    } finally {
      setSyncing(null);
      qc.invalidateQueries({ queryKey: ["admin-suppliers"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    }
  };

  const s = stats.data ?? {};
  const loading = stats.isLoading;

  return (
    <div>
      <Seo noindex title="Dashboard · Panel admina" />
      <PageHeader title="Dashboard" description="Podsumowanie sprzedaży, stan synchronizacji hurtowni i ostatnie zamówienia." />
      {stats.isError && <p className="mb-4 text-sm text-destructive">Nie udało się pobrać statystyk: {errorMessage(stats.error)}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Zamówienia dziś" value={s.orders_today ?? 0} loading={loading} icon={<ShoppingCart className="h-5 w-5" />} to="/admin/zamowienia" />
        <StatCard title="Zamówienia (7 dni)" value={s.orders_week ?? 0} loading={loading} icon={<ShoppingCart className="h-5 w-5" />} to="/admin/zamowienia" />
        <StatCard
          title="Obrót brutto (7 dni)"
          value={formatPrice(s.revenue_week_gross_cents ?? 0)}
          loading={loading}
          icon={<Banknote className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          title="Oczekujące na realizację"
          value={s.orders_awaiting ?? 0}
          loading={loading}
          icon={<Clock className="h-5 w-5" />}
          tone={(s.orders_awaiting ?? 0) > 0 ? "warning" : "default"}
          to="/admin/zamowienia"
        />
        <StatCard title="Produkty aktywne" value={s.products_active ?? 0} loading={loading} icon={<Package className="h-5 w-5" />} to="/admin/produkty" />
        <StatCard title="Produkty ukryte" value={s.products_hidden ?? 0} loading={loading} icon={<EyeOff className="h-5 w-5" />} to="/admin/produkty" />
        <StatCard
          title="Oferty bez mapowania"
          value={s.offers_unmapped ?? 0}
          loading={loading}
          icon={<Link2 className="h-5 w-5" />}
          tone={(s.offers_unmapped ?? 0) > 0 ? "warning" : "default"}
          to="/admin/mapowanie"
        />
        <StatCard
          title="Wnioski B2B"
          value={s.b2b_pending ?? 0}
          loading={loading}
          icon={<Users className="h-5 w-5" />}
          tone={(s.b2b_pending ?? 0) > 0 ? "accent" : "default"}
          to="/admin/klienci"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Synchronizacja hurtowni</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link to="/admin/hurtownie">Konfiguracja</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {suppliers.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hurtownia</TableHead>
                    <TableHead>Aktywna</TableHead>
                    <TableHead>Ostatni sync</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Log</TableHead>
                    <TableHead className="text-right">Akcja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(suppliers.data ?? []).map((sup) => (
                    <TableRow key={sup.id}>
                      <TableCell className="font-medium">
                        {sup.name}
                        <span className="ml-1 text-xs text-muted-foreground">({sup.code})</span>
                      </TableCell>
                      <TableCell>{sup.active ? <Badge variant="success">tak</Badge> : <Badge variant="outline">nie</Badge>}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(sup.last_sync_at, true)}</TableCell>
                      <TableCell>
                        <SyncStatusBadge status={sup.last_sync_status} />
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground" title={sup.last_sync_log ?? undefined}>
                        {sup.last_sync_log ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={syncing !== null} onClick={() => sync(sup)}>
                          {syncing === sup.code ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                          <span className="hidden sm:inline">Synchronizuj teraz</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppliers.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Brak skonfigurowanych hurtowni.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Ostatnie zamówienia</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link to="/admin/zamowienia">Wszystkie</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recent.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : recent.data && recent.data.length > 0 ? (
              <ul className="divide-y">
                {recent.data.map((o) => (
                  <li key={o.id}>
                    <Link to={`/admin/zamowienia/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{o.number}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.email} · {formatDate(o.created_at, true)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold tabular-nums">{formatPrice(o.total_gross_cents)}</span>
                        <div className="flex gap-1">
                          <OrderStatusBadge status={o.status} />
                          <PaymentStatusBadge status={o.payment_status} />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <EmptyState title="Brak zamówień" description="Nowe zamówienia pojawią się tutaj." />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
