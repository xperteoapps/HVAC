import { CreditCard, Landmark, CalendarClock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { manualProvider, deferredProvider } from "@/lib/payments/manual";
import { imojeProvider } from "@/lib/payments/imoje";
import { cn } from "@/lib/utils";

export type PaymentChoice = "manual" | "imoje" | "deferred";

interface PaymentSelectorProps {
  value: PaymentChoice;
  onChange: (v: PaymentChoice) => void;
  deferredAllowed: boolean;
  /** Dostawcy włączeni po stronie serwera (z calc-shipping); domyślnie tylko przelew */
  enabledProviders?: string[];
}

export function PaymentSelector({ value, onChange, deferredAllowed, enabledProviders = ["manual"] }: PaymentSelectorProps) {
  const imojeEnabled = enabledProviders.includes("imoje");
  const options: Array<{ code: PaymentChoice; label: string; description: string; icon: typeof CreditCard }> = [
    ...(imojeEnabled ? [{ code: "imoje" as const, label: imojeProvider.label, description: imojeProvider.description, icon: CreditCard }] : []),
    { code: "manual", label: manualProvider.label, description: manualProvider.description, icon: Landmark },
    ...(deferredAllowed ? [{ code: "deferred" as const, label: deferredProvider.label, description: deferredProvider.description, icon: CalendarClock }] : []),
  ];
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentChoice)}>
      {options.map((o) => (
        <label
          key={o.code}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-secondary/50",
            value === o.code && "border-accent bg-accent/5",
          )}
        >
          <RadioGroupItem value={o.code} id={`pay-${o.code}`} className="mt-0.5" />
          <o.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="block text-xs text-muted-foreground">{o.description}</span>
          </span>
        </label>
      ))}
      {!imojeEnabled && <p className="text-xs text-muted-foreground">Płatności online (BLIK, karta, szybki przelew) — wkrótce.</p>}
    </RadioGroup>
  );
}
