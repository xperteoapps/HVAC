import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Landmark } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate, ORDER_STATUS_LABELS } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";
import type { CreatedOrder } from "@/types";
import { ORDER_CONFIRM_KEY } from "./Checkout";

export default function OrderConfirm() {
  const { number } = useParams<{ number: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const [data, setData] = useState<CreatedOrder | null>((location.state as CreatedOrder | null) ?? null);

  useEffect(() => {
    if (data) return;
    try {
      const raw = sessionStorage.getItem(ORDER_CONFIRM_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CreatedOrder;
        if (parsed.order?.number === number) setData(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [data, number]);

  if (!data) {
    return (
      <EmptyState
        title={`Zamówienie ${number ?? ""}`}
        description={user ? "Szczegóły znajdziesz w historii zamówień." : "Potwierdzenie zostało wysłane na Twój adres e-mail."}
        action={<Button asChild><Link to={user ? "/konto/zamowienia" : "/"}>{user ? "Moje zamówienia" : "Strona główna"}</Link></Button>}
      />
    );
  }

  const { order, items, payment } = data;
  const deferred = order.payment_status === "deferred";

  return (
    <div className="mx-auto max-w-2xl">
      <Seo title={`Zamówienie ${order.number}`} noindex />
      <div className="rounded-lg border bg-card p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <h1 className="mt-4 text-2xl font-bold">Dziękujemy za zamówienie!</h1>
        <p className="mt-2 text-muted-foreground">
          Numer zamówienia: <strong className="text-foreground">{order.number}</strong>
          <br />
          Potwierdzenie wysłaliśmy na adres <strong className="text-foreground">{order.email}</strong>.
        </p>
        <p className="mt-2 text-sm">
          Status: <span className="font-medium">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span> · {formatDate(order.created_at, true)}
        </p>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Landmark className="h-5 w-5 text-accent" /> {deferred ? "Płatność odroczona" : "Dane do przelewu"}
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm">{payment.instructions ?? "Instrukcje płatności znajdziesz w wiadomości e-mail."}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Kwota</dt>
            <dd className="text-lg font-semibold">{formatPrice(order.total_gross_cents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tytuł przelewu</dt>
            <dd className="font-mono font-semibold">{order.number}</dd>
          </div>
          {order.payment_due_date && (
            <div>
              <dt className="text-muted-foreground">Termin płatności</dt>
              <dd className="font-semibold">{formatDate(order.payment_due_date)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Zamówione produkty</h2>
        <ul className="mt-3 divide-y text-sm">
          {items.map((i) => (
            <li key={i.sku} className="flex justify-between gap-3 py-2">
              <span>
                {i.qty} × {i.name} <span className="text-xs text-muted-foreground">({i.sku})</span>
              </span>
              <span className="shrink-0 font-medium">{formatPrice(i.price_net_cents * i.qty)} netto</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Produkty netto</dt>
            <dd>{formatPrice(order.subtotal_net_cents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Dostawa netto{order.shipping_method ? ` (${order.shipping_method})` : ""}</dt>
            <dd>{formatPrice(order.shipping_net_cents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">VAT</dt>
            <dd>{formatPrice(order.vat_cents)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Razem brutto</dt>
            <dd>{formatPrice(order.total_gross_cents)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/">Wróć do sklepu</Link>
        </Button>
        {user ? (
          <Button variant="outline" asChild>
            <Link to="/konto/zamowienia">Moje zamówienia</Link>
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link to="/rejestracja">Załóż konto, aby śledzić zamówienia</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
