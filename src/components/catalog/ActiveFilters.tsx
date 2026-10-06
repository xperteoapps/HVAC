import { X } from "lucide-react";
import type { UrlFilterState } from "./filters";
import type { Facets } from "@/hooks/useProducts";
import { formatPrice } from "@/lib/formatters";

export function ActiveFilters({ state, facets, onChange }: { state: UrlFilterState; facets: Facets | undefined; onChange: (patch: Partial<UrlFilterState>) => void }) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  for (const slug of state.brands) {
    const b = facets?.brands.find((x) => x.slug === slug);
    chips.push({ key: `b-${slug}`, label: b?.name ?? slug, remove: () => onChange({ brands: state.brands.filter((s) => s !== slug) }) });
  }
  for (const [k, values] of Object.entries(state.attrValues)) {
    const def = facets?.attributes.find((a) => a.key === k);
    for (const v of values) {
      chips.push({
        key: `a-${k}-${v}`,
        label: `${def?.label ?? k}: ${v === "true" ? "tak" : v}`,
        remove: () => {
          const next = { ...state.attrValues, [k]: values.filter((x) => x !== v) };
          if (!next[k].length) delete next[k];
          onChange({ attrValues: next });
        },
      });
    }
  }
  for (const [k, [lo, hi]] of Object.entries(state.attrRanges)) {
    const def = facets?.attributes.find((a) => a.key === k);
    chips.push({
      key: `r-${k}`,
      label: `${def?.label ?? k}: ${lo ?? "…"}–${hi ?? "…"}${def?.unit ? ` ${def.unit}` : ""}`,
      remove: () => {
        const next = { ...state.attrRanges };
        delete next[k];
        onChange({ attrRanges: next });
      },
    });
  }
  if (state.priceMin !== null || state.priceMax !== null) {
    chips.push({ key: "price", label: `Cena: ${state.priceMin !== null ? formatPrice(state.priceMin) : "…"} – ${state.priceMax !== null ? formatPrice(state.priceMax) : "…"}`, remove: () => onChange({ priceMin: null, priceMax: null }) });
  }
  if (state.availability) chips.push({ key: "av", label: state.availability === "in_stock" ? "Dostępne od ręki" : "Na zamówienie", remove: () => onChange({ availability: null }) });
  if (state.wifi) chips.push({ key: "wifi", label: "Wi‑Fi", remove: () => onChange({ wifi: false }) });
  if (!chips.length) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={c.remove} className="inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-xs hover:bg-secondary/70">
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
