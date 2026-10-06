import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageSquarePlus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/StatusBadge";
import { ORDER_STATUSES, PAYMENT_STATUSES, errorMessage, jsonRecord } from "@/components/admin/helpers";
import { useAuth } from "@/hooks/useAuth";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, formatDate, formatNip, formatPrice } from "@/lib/formatters";
import { grossCents, toNumber } from "@/lib/pricing";
import { asAddress, type AddressJson, type Order, type OrderEvent, type OrderItem, type Update } from "@/types";

const EVENT_LABELS: Record<string, string> = {
  created: "Utworzono",
  status_changed: "Zmiana statusu",
  payment: "Płatność",
  tracking: "Przesyłka",
  note: "Notatka",
};

function describeEvent(ev: OrderEvent): string {
  const p = jsonRecord(ev.payload);
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  switch (ev.type) {
    case "created":
      return "Zamówienie zostało złożone";
    case "status_changed": {
      const from = str(p.from ?? p.old);
      const to = str(p.to ?? p.new ?? p.status);
      return `${(ORDER_STATUS_LABELS[from] ?? from) || "—"} → ${ORDER_STATUS_LABELS[to] ?? to}`;
    }
    case "payment": {
      const to = str(p.to ?? p.new ?? p.payment_status ?? p.status);
      return `Status płatności: ${(PAYMENT_STATUS_LABELS[to] ?? to) || "—"}`;
    }
    case "tracking":
      return [str(p.carrier), str(p.tracking_number)].filter(Boolean).join(" · ") || "Zaktualizowano dane przesyłki";
    case "note":
      return str(p.text);
    default: {
      const entries = Object.entries(p);
      return entries.length ? entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : str(v)}`).join(", ") : "";
    }
  }
}

function AddressBlock({ title, address, nip }: { title: string; address: AddressJson | null; nip?: string | null }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {address ? (
        <address className="text-sm not-italic leading-relaxed">
          {address.company_name && <span className="block font-medium">{address.company_name}</span>}
          <span className="block">{address.full_name}</span>
          <span className="block">
            {address.street} {address.building_no}
            {address.apartment_no ? `/${address.apartment_no}` : ""}
          </span>
          <span className="block">
            {address.postal_code} {address.city}, {address.country}
          </span>
          {address.phone && <span className="block text-muted-foreground">tel. {address.phone}</span>}
          {(address.nip || nip) && <span className="block text-muted-foreground">NIP {formatNip(address.nip ?? nip)}</span>}
        </address>
      ) : (
        <p className="text-sm text-muted-foreground">Brak danych</p>
      )}
    </div>
  );
}

export function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { user } = useAuth();

  const details = useQuery({
    queryKey: ["admin-order", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [{ data: order, error }, { data: items, error: iErr }, { data: events, error: eErr }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id!).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id!).order("created_at"),
        supabase.from("order_events").select("*").eq("order_id", id!).order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (iErr) throw iErr;
      if (eErr) throw eErr;
      return { order: (order as Order | null) ?? null, items: (items ?? []) as OrderItem[], events: (events ?? []) as OrderEvent[] };
    },
  });

  const order = details.data?.order ?? null;

  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (order) {
      setTracking(order.tracking_number ?? "");
      setCarrier(order.carrier ?? "");
      setAdminNotes(order.admin_notes ?? "");
    }
  }, [order]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-order", id] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-orders-recent"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
  };

  const update = useMutation({
    mutationFn: async ({ patch, label }: { patch: Update<"orders">; label: string }) => {
      const { error } = await supabase.from("orders").update(patch).eq("id", id!);
      if (error) throw error;
      return label;
    },
    onSuccess: (label) => {
      toast.success(label);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać zmian")),
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("order_events").insert({ order_id: id!, type: "note", payload: { text }, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dodano notatkę");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się dodać notatki")),
  });

  if (details.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (details.isError) {
    return <EmptyState title="Błąd ładowania" description={errorMessage(details.error)} />;
  }

  if (!order) {
    return (
      <EmptyState
        title="Nie znaleziono zamówienia"
        action={
          <Button asChild variant="outline">
            <Link to="/admin/zamowienia">
              <ArrowLeft /> Wróć do listy
            </Link>
          </Button>
        }
      />
    );
  }

  const items = details.data?.items ?? [];
  const events = details.data?.events ?? [];
  const shipping = asAddress(order.shipping_address);
  const billing = asAddress(order.billing_address);
  const busy = update.isPending;

  return (
    <div>
      <Seo noindex title={`Zamówienie ${order.number} · Panel admina`} />
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/admin/zamowienia">
            <ArrowLeft /> Zamówienia
          </Link>
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Zamówienie {order.number}</h1>
            <p className="text-sm text-muted-foreground">
              Złożone {formatDate(order.created_at, true)} · {order.email}
              {order.phone && ` · ${order.phone}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
            {order.price_mode === "net" && <Badge variant="accent">B2B netto</Badge>}
            {order.invoice_requested && <Badge variant="outline">Faktura VAT</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pozycje</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nazwa</TableHead>
                    <TableHead className="text-right">Ilość</TableHead>
                    <TableHead className="text-right">Netto / szt.</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const vat = toNumber(it.vat_rate, 23);
                    const lineNet = it.price_net_cents * it.qty;
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{it.sku}</TableCell>
                        <TableCell>
                          <p className="min-w-[10rem]">{it.name}</p>
                          {it.supplier_sku && <p className="text-xs text-muted-foreground">Hurtownia: {it.supplier_sku}</p>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.qty}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatPrice(it.price_net_cents)}</TableCell>
                        <TableCell className="text-right tabular-nums">{vat}%</TableCell>
                        <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">{formatPrice(grossCents(lineNet, vat))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Separator />
              <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 p-4 text-sm">
                <dt className="text-muted-foreground">Produkty netto</dt>
                <dd className="text-right tabular-nums">{formatPrice(order.subtotal_net_cents)}</dd>
                <dt className="text-muted-foreground">Dostawa netto</dt>
                <dd className="text-right tabular-nums">{formatPrice(order.shipping_net_cents)}</dd>
                <dt className="text-muted-foreground">VAT</dt>
                <dd className="text-right tabular-nums">{formatPrice(order.vat_cents)}</dd>
                <dt className="font-semibold">Razem brutto</dt>
                <dd className="text-right text-base font-bold tabular-nums">{formatPrice(order.total_gross_cents)}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dane klienta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <AddressBlock title="Adres dostawy" address={shipping} />
              <AddressBlock title="Dane do faktury" address={billing ?? (order.invoice_requested ? shipping : null)} nip={order.nip} />
              <div className="sm:col-span-2 grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Dostawa:</span> {order.shipping_method ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Grupa klienta:</span> {order.customer_group_code}
                  {order.discount_pct > 0 && ` (rabat ${order.discount_pct}%)`}
                </p>
                <p>
                  <span className="text-muted-foreground">Płatność:</span> {order.payment_provider}
                  {order.payment_due_date && ` · termin ${formatDate(order.payment_due_date)}`}
                </p>
                {order.notes && (
                  <p>
                    <span className="text-muted-foreground">Uwagi klienta:</span> {order.notes}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historia</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="mb-4 flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) addNote.mutate(note.trim());
                }}
              >
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wewnętrzna notatka do zamówienia…" rows={2} className="flex-1" />
                <Button type="submit" variant="outline" disabled={!note.trim() || addNote.isPending} className="sm:self-end">
                  {addNote.isPending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />} Dodaj notatkę
                </Button>
              </form>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak zdarzeń.</p>
              ) : (
                <ol className="relative space-y-4 border-l pl-4">
                  {events.map((ev) => (
                    <li key={ev.id} className="text-sm">
                      <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent" />
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{EVENT_LABELS[ev.type] ?? ev.type}</span>
                        <span>{formatDate(ev.created_at, true)}</span>
                      </div>
                      <p className={ev.type === "note" ? "mt-0.5 whitespace-pre-wrap rounded bg-secondary/60 px-2 py-1" : "mt-0.5"}>{describeEvent(ev)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Status zamówienia" htmlFor="order-status">
                <Select value={order.status} disabled={busy} onValueChange={(v) => update.mutate({ patch: { status: v }, label: `Status: ${ORDER_STATUS_LABELS[v] ?? v}` })}>
                  <SelectTrigger id="order-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ORDER_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Status płatności" htmlFor="payment-status">
                <Select
                  value={order.payment_status}
                  disabled={busy}
                  onValueChange={(v) => update.mutate({ patch: { payment_status: v }, label: `Płatność: ${PAYMENT_STATUS_LABELS[v] ?? v}` })}
                >
                  <SelectTrigger id="payment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PAYMENT_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Przesyłka</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  update.mutate({ patch: { tracking_number: tracking.trim() || null, carrier: carrier.trim() || null }, label: "Zapisano dane przesyłki" });
                }}
              >
                <FormField label="Przewoźnik" htmlFor="carrier">
                  <Input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="np. DPD, Raben" />
                </FormField>
                <FormField label="Numer przesyłki" htmlFor="tracking">
                  <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Numer listu przewozowego" />
                </FormField>
                <Button type="submit" size="sm" disabled={busy} className="w-full">
                  <Save /> Zapisz przesyłkę
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notatki administratora</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  update.mutate({ patch: { admin_notes: adminNotes.trim() || null }, label: "Zapisano notatki" });
                }}
              >
                <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={5} placeholder="Widoczne tylko dla obsługi sklepu" />
                <Button type="submit" size="sm" variant="outline" disabled={busy} className="w-full">
                  <Save /> Zapisz notatki
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
