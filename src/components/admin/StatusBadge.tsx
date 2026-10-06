import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, STOCK_STATUS_LABELS, SYNC_STATUS_LABELS } from "@/lib/formatters";
import { PRODUCT_STATUS_LABELS } from "./helpers";

type Variant = NonNullable<BadgeProps["variant"]>;

const ORDER_VARIANTS: Record<string, Variant> = {
  new: "default",
  awaiting_payment: "warning",
  paid: "success",
  processing: "accent",
  shipped: "secondary",
  delivered: "success",
  cancelled: "destructive",
  refunded: "outline",
};

const PAYMENT_VARIANTS: Record<string, Variant> = {
  pending: "warning",
  paid: "success",
  failed: "destructive",
  deferred: "accent",
  refunded: "outline",
};

const SYNC_VARIANTS: Record<string, Variant> = {
  ok: "success",
  failed: "destructive",
  running: "warning",
  not_configured: "secondary",
};

const STOCK_VARIANTS: Record<string, Variant> = {
  in_stock: "success",
  low: "warning",
  on_order: "secondary",
  unavailable: "destructive",
};

const PRODUCT_VARIANTS: Record<string, Variant> = {
  active: "success",
  hidden: "secondary",
  discontinued: "outline",
};

interface Props {
  status: string | null | undefined;
  className?: string;
}

export function OrderStatusBadge({ status, className }: Props) {
  const s = status ?? "";
  return (
    <Badge variant={ORDER_VARIANTS[s] ?? "outline"} className={className}>
      {ORDER_STATUS_LABELS[s] ?? s}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, className }: Props) {
  const s = status ?? "";
  return (
    <Badge variant={PAYMENT_VARIANTS[s] ?? "outline"} className={className}>
      {PAYMENT_STATUS_LABELS[s] ?? s}
    </Badge>
  );
}

export function SyncStatusBadge({ status, className }: Props) {
  if (!status) {
    return (
      <Badge variant="outline" className={className}>
        Nie uruchamiano
      </Badge>
    );
  }
  return (
    <Badge variant={SYNC_VARIANTS[status] ?? "outline"} className={className}>
      {SYNC_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function StockStatusBadge({ status, className }: Props) {
  const s = status ?? "";
  return (
    <Badge variant={STOCK_VARIANTS[s] ?? "outline"} className={className}>
      {STOCK_STATUS_LABELS[s] ?? s}
    </Badge>
  );
}

export function ProductStatusBadge({ status, className }: Props) {
  const s = status ?? "";
  return (
    <Badge variant={PRODUCT_VARIANTS[s] ?? "outline"} className={className}>
      {PRODUCT_STATUS_LABELS[s] ?? s}
    </Badge>
  );
}
