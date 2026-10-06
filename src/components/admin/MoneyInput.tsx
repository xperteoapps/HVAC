import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { centsToZl, zlToCents } from "./helpers";

interface MoneyInputProps {
  /** Wartość w groszach (null = puste pole) */
  valueCents: number | null | undefined;
  /** Wywoływane przy każdej zmianie (po sparsowaniu) */
  onChangeCents?: (cents: number | null) => void;
  /** Wywoływane po blur / Enter, tylko gdy wartość różni się od początkowej */
  onCommit?: (cents: number | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Pole kwoty w zł; przechowuje i zwraca grosze (integer). */
export function MoneyInput({ valueCents, onChangeCents, onCommit, id, placeholder, disabled, className, "aria-label": ariaLabel }: MoneyInputProps) {
  const normalized = valueCents ?? null;
  const [text, setText] = useState(centsToZl(normalized));
  const current = useRef<number | null>(normalized);
  const committed = useRef<number | null>(normalized);

  useEffect(() => {
    if (normalized !== current.current) {
      current.current = normalized;
      committed.current = normalized;
      setText(centsToZl(normalized));
    }
  }, [normalized]);

  const handleChange = (value: string) => {
    setText(value);
    const cents = zlToCents(value);
    current.current = cents;
    onChangeCents?.(cents);
  };

  const commit = () => {
    const cents = current.current;
    setText(centsToZl(cents));
    if (cents !== committed.current) {
      committed.current = cents;
      onCommit?.(cents);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? "0,00"}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
        className="pr-8 text-right tabular-nums"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">zł</span>
    </div>
  );
}
