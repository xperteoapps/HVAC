import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useSearchSuggestions } from "@/hooks/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { formatPrice } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function SearchBox({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(value, 250);
  const { data: suggestions } = useSearchSuggestions(debounced);
  const navigate = useNavigate();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setValue("");
    onNavigate?.();
    navigate(path);
  };

  return (
    <form
      ref={ref}
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) go(`/szukaj?q=${encodeURIComponent(value.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Szukaj: model, SKU, EAN, np. KAISAI 3.5 kW"
        className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        aria-label="Szukaj produktów"
        autoComplete="off"
      />
      {value && (
        <button type="button" onClick={() => setValue("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Wyczyść">
          <X className="h-4 w-4" />
        </button>
      )}
      {open && suggestions && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(`/produkt/${s.slug}`)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                {s.images?.[0] && <img src={s.images[0]} alt="" className="h-9 w-9 rounded object-cover" loading="lazy" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">{s.sku}</span>
                </span>
                <span className="shrink-0 text-xs font-medium">{formatPrice(s.price_gross_cents)}</span>
              </button>
            </li>
          ))}
          <li className="border-t">
            <button type="submit" className="w-full px-3 py-2 text-left text-xs text-accent hover:bg-secondary">
              Pokaż wszystkie wyniki dla „{value}”
            </button>
          </li>
        </ul>
      )}
    </form>
  );
}
