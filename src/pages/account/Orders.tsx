import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrders, useOrderDetails } from "@/hooks/useOrders";
import { formatDate, formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/formatters";
import { grossCents, toNumber } from "@/lib/pricing";
import { asAddress } from "@/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "accent" | "success" | "warning" | "destructive" | "outline"> = {
  new: "secondary",
  awaiting_payment: "warning",
  paid: "accent",
  processing: "accent",
  shipped: "default",
  delivered: "success",
  cancelled: "destructive",
  refunded: "outline",
};

export function OrdersList() {
  const { user } = useAuth();
  const { data: orders, isLoading } = useMyOrders(user?.id);
  if (isLoading) return <Skeleton className="h-48" />;
  if (!orders || orders.length === 0) {
    return <EmptyState title="Brak zamówień" description="Twoje zamówienia pojawią się tutaj po złożeniu." action={<Button asChild><Link to="/">Przejdź do sklepu</Link></Button>} />;
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numer</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Płatność</TableHead>
            <TableHead className="text-right">Kwota brutto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Link to={`/konto/zamowienia/${o.id}`} className="font-medium hover:text-accent">
                  {o.number}
                </Link>
              </TableCell>
              <TableCell>{formatDate(o.created_at)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
              </TableCell>
              <TableCell>{PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status}</TableCell>
              <TableCell className="text-right font-semibold">{formatPrice(o.total_gross_cents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useOrderDetails(id);
  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.order) return <EmptyState title="Nie znaleziono zamówienia" action={<Button asChild><Link to="/konto/zamowienia">Wróć</Link></Button>} />;
  const { order, items, events } = data;
  const ship = asAddress(order.shipping_address);
  const bill = asAddress(order.billing_address);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/konto/zamowienia">
            <ArrowLeft className="h-4 w-4" /> Zamówienia
          </Link>
        </Button>
        <h2 className="text-xl font-semibold">{order.number}</h2>
        <Badge variant={STATUS_VARIANT[order.status] ?? "secondary"}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
        <span className="text-sm text-muted-foreground">{formatDate(order.created_at, true)}</span>
      </div>

      {order.tracking_number && (
        <div className="flex items-center gap-3 rounded-md border bg-card p-4 text-sm">
          <Truck className="h-5 w-5 text-accent" />
          <span>
            Przesyłka {order.carrier ? `${order.carrier} ` : ""}nr <strong>{order.tracking_number}</strong>
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border bg-card p-4 text-sm">
          <h3 className="mb-2 font-semibold">Adres dostawy</h3>
          {ship ? <AddressBlock a={ship} /> : "—"}
          <p className="mt-2 text-muted-foreground">Metoda: {order.shipping_method ?? "—"}</p>
        </div>
        <div className="rounded-md border bg-card p-4 text-sm">
          <h3 className="mb-2 font-semibold">Dane do faktury</h3>
          {bill ? <AddressBlock a={bill} /> : ship ? <AddressBlock a={ship} /> : "—"}
          {order.nip && <p className="mt-1">NIP: {order.nip}</p>}
        </div>
        <div className="rounded-md border bg-card p-4 text-sm">
          <h3 className="mb-2 font-semibold">Płatność</h3>
          <p>{PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}</p>
          <p className="text-muted-foreground">Przelew tradycyjny, tytuł: {order.number}</p>
          {order.payment_due_date && <p>Termin: {formatDate(order.payment_due_date)}</p>}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produkt</TableHead>
              <TableHead className="text-right">Ilość</TableHead>
              <TableHead className="text-right">Cena netto</TableHead>
              <TableHead className="text-right">Wartość brutto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <span className="font-medium">{i.name}</span>
                  <span className="block text-xs text-muted-foreground">{i.sku}</span>
                </TableCell>
                <TableCell className="text-right">{i.qty}</TableCell>
                <TableCell className="text-right">{formatPrice(i.price_net_cents)}</TableCell>
                <TableCell className="text-right font-medium">{formatPrice(grossCents(i.price_net_cents * i.qty, toNumber(i.vat_rate, 23)))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <dl className="space-y-1 border-t p-4 text-sm">
          <Row label="Produkty netto" value={formatPrice(order.subtotal_net_cents)} />
          <Row label="Dostawa netto" value={formatPrice(order.shipping_net_cents)} />
          <Row label="VAT" value={formatPrice(order.vat_cents)} />
          <Row label="Razem brutto" value={formatPrice(order.total_gross_cents)} bold />
        </dl>
      </div>

      {events.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 font-semibold">Historia</h3>
          <ol className="space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{formatDate(e.created_at, true)}</span>
                <span>{describeEvent(e.type, e.payload)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function AddressBlock({ a }: { a: NonNullable<ReturnType<typeof asAddress>> }) {
  return (
    <address className="not-italic">
      {a.company_name && <div>{a.company_name}</div>}
      <div>{a.full_name}</div>
      <div>
        {a.street} {a.building_no}
        {a.apartment_no ? `/${a.apartment_no}` : ""}
      </div>
      <div>
        {a.postal_code} {a.city}
      </div>
      {a.phone && <div>tel. {a.phone}</div>}
    </address>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold" : ""}`}>
      <dt className={bold ? "" : "text-muted-foreground"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function describeEvent(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, string>;
  switch (type) {
    case "created":
      return "Zamówienie złożone";
    case "status_changed":
      return `Status: ${ORDER_STATUS_LABELS[p.to] ?? p.to}`;
    case "payment":
      return `Płatność: ${PAYMENT_STATUS_LABELS[p.to] ?? p.to}`;
    case "tracking":
      return `Nadano przesyłkę ${p.carrier ?? ""} ${p.tracking_number ?? ""}`.trim();
    case "email_sent":
      return "Wysłano e-mail z potwierdzeniem";
    case "note":
      return p.text ? `Notatka: ${p.text}` : "Notatka";
    default:
      return type;
  }
}
