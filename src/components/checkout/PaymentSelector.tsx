import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { manualProvider, deferredProvider } from "@/lib/payments/manual";
import { cn } from "@/lib/utils";

export type PaymentChoice = "manual" | "deferred";

export function PaymentSelector({
  value,
  onChange,
  deferredAllowed,
}: {
  value: PaymentChoice;
  onChange: (v: PaymentChoice) => void;
  deferredAllowed: boolean;
}) {
  const options: Array<{ code: PaymentChoice; label: string; description: string }> = [
    { code: "manual", label: manualProvider.label, description: manualProvider.description },
    ...(deferredAllowed ? [{ code: "deferred" as const, label: deferredProvider.label, description: deferredProvider.description }] : []),
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
          <span>
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="block text-xs text-muted-foreground">{o.description}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground">Płatności online (BLIK, karta, szybki przelew) — wkrótce.</p>
    </RadioGroup>
  );
}
