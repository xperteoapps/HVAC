import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Facets } from "@/hooks/useProducts";
import type { UrlFilterState } from "./filters";
import { formatPrice } from "@/lib/formatters";

interface FilterSidebarProps {
  facets: Facets | undefined;
  state: UrlFilterState;
  onChange: (patch: Partial<UrlFilterState>) => void;
  onReset: () => void;
  activeCount: number;
}

export function FilterSidebar({ facets, state, onChange, onReset, activeCount }: FilterSidebarProps) {
  const numberAttrs = (facets?.attributes ?? []).filter((a) => a.type === "number" && a.values.length > 1);
  const selectAttrs = (facets?.attributes ?? []).filter((a) => (a.type === "select" || a.type === "text") && a.values.length > 1);
  const boolAttrs = (facets?.attributes ?? []).filter((a) => a.type === "boolean" && a.values.some((v) => v.value === "true"));
  const defaultOpen = ["availability", "price", "brand", ...selectAttrs.slice(0, 3).map((a) => a.key), ...numberAttrs.slice(0, 2).map((a) => a.key)];

  return (
    <aside className="space-y-2" aria-label="Filtry">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filtry</h2>
        {activeCount > 0 && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onReset}>
            Wyczyść ({activeCount})
          </Button>
        )}
      </div>
      <Accordion type="multiple" defaultValue={defaultOpen}>
        <AccordionItem value="availability">
          <AccordionTrigger>Dostępność</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <CheckRow
              label={`Dostępne od ręki (${facets?.availability.in_stock ?? 0})`}
              checked={state.availability === "in_stock"}
              onChange={(v) => onChange({ availability: v ? "in_stock" : null })}
            />
            <CheckRow
              label={`Na zamówienie (${facets?.availability.on_order ?? 0})`}
              checked={state.availability === "on_order"}
              onChange={(v) => onChange({ availability: v ? "on_order" : null })}
            />
          </AccordionContent>
        </AccordionItem>

        {facets?.price_min !== null && facets?.price_max !== null && facets && facets.price_max > facets.price_min && (
          <AccordionItem value="price">
            <AccordionTrigger>Cena brutto</AccordionTrigger>
            <AccordionContent>
              <PriceRange min={facets.price_min!} max={facets.price_max!} value={[state.priceMin, state.priceMax]} onCommit={(min, max) => onChange({ priceMin: min, priceMax: max })} />
            </AccordionContent>
          </AccordionItem>
        )}

        {facets && facets.brands.length > 1 && (
          <AccordionItem value="brand">
            <AccordionTrigger>Marka</AccordionTrigger>
            <AccordionContent className="space-y-2">
              {facets.brands.map((b) => (
                <CheckRow
                  key={b.id}
                  label={`${b.name} (${b.count})`}
                  checked={state.brands.includes(b.slug)}
                  onChange={(v) => onChange({ brands: v ? [...state.brands, b.slug] : state.brands.filter((s) => s !== b.slug) })}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {numberAttrs.map((a) => {
          const nums = a.values.map((v) => Number(v.value)).filter((n) => Number.isFinite(n));
          const min = Math.min(...nums);
          const max = Math.max(...nums);
          const current = state.attrRanges[a.key] ?? [null, null];
          return (
            <AccordionItem key={a.key} value={a.key}>
              <AccordionTrigger>
                {a.label}
                {a.unit ? ` [${a.unit}]` : ""}
              </AccordionTrigger>
              <AccordionContent>
                <NumberRange
                  min={min}
                  max={max}
                  value={current}
                  unit={a.unit}
                  onCommit={(lo, hi) => {
                    const next = { ...state.attrRanges };
                    if (lo === null && hi === null) delete next[a.key];
                    else next[a.key] = [lo, hi];
                    onChange({ attrRanges: next });
                  }}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {selectAttrs.map((a) => {
          const selected = state.attrValues[a.key] ?? [];
          return (
            <AccordionItem key={a.key} value={a.key}>
              <AccordionTrigger>{a.label}</AccordionTrigger>
              <AccordionContent className="space-y-2">
                {a.values.map((v) => (
                  <CheckRow
                    key={v.value}
                    label={`${v.value} (${v.count})`}
                    checked={selected.includes(v.value)}
                    onChange={(on) => {
                      const next = { ...state.attrValues, [a.key]: on ? [...selected, v.value] : selected.filter((x) => x !== v.value) };
                      if (!next[a.key].length) delete next[a.key];
                      onChange({ attrValues: next });
                    }}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {boolAttrs.map((a) => (
          <AccordionItem key={a.key} value={a.key}>
            <AccordionTrigger>{a.label}</AccordionTrigger>
            <AccordionContent>
              <CheckRow label={`Tylko z: ${a.label}`} checked={a.key === "wifi" ? state.wifi : (state.attrValues[a.key] ?? []).includes("true")} onChange={(on) => {
                if (a.key === "wifi") onChange({ wifi: on });
                else {
                  const next = { ...state.attrValues };
                  if (on) next[a.key] = ["true"];
                  else delete next[a.key];
                  onChange({ attrValues: next });
                }
              }} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </aside>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span className="leading-tight">{label}</span>
    </label>
  );
}

function PriceRange({ min, max, value, onCommit }: { min: number; max: number; value: [number | null, number | null]; onCommit: (min: number | null, max: number | null) => void }) {
  const [local, setLocal] = useState<[number, number]>([value[0] ?? min, value[1] ?? max]);
  useEffect(() => setLocal([value[0] ?? min, value[1] ?? max]), [value, min, max]);
  const toZl = (c: number) => Math.round(c / 100);
  return (
    <div className="space-y-3 px-1">
      <Slider min={min} max={max} step={100} value={local} onValueChange={(v) => setLocal([v[0], v[1]])} onValueCommit={(v) => onCommit(v[0] <= min ? null : v[0], v[1] >= max ? null : v[1])} />
      <div className="flex items-center gap-2 text-xs">
        <Input type="number" className="h-8" value={toZl(local[0])} onChange={(e) => setLocal([Number(e.target.value) * 100, local[1]])} onBlur={() => onCommit(local[0] <= min ? null : local[0], local[1] >= max ? null : local[1])} aria-label="Cena od" />
        <span>–</span>
        <Input type="number" className="h-8" value={toZl(local[1])} onChange={(e) => setLocal([local[0], Number(e.target.value) * 100])} onBlur={() => onCommit(local[0] <= min ? null : local[0], local[1] >= max ? null : local[1])} aria-label="Cena do" />
        <span>zł</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatPrice(local[0])} – {formatPrice(local[1])}
      </p>
    </div>
  );
}

function NumberRange({ min, max, value, unit, onCommit }: { min: number; max: number; value: [number | null, number | null]; unit: string | null; onCommit: (lo: number | null, hi: number | null) => void }) {
  const [local, setLocal] = useState<[number, number]>([value[0] ?? min, value[1] ?? max]);
  useEffect(() => setLocal([value[0] ?? min, value[1] ?? max]), [value, min, max]);
  const step = max - min > 50 ? 1 : 0.1;
  const commit = (lo: number, hi: number) => onCommit(lo <= min ? null : lo, hi >= max ? null : hi);
  return (
    <div className="space-y-3 px-1">
      <Slider min={min} max={max} step={step} value={local} onValueChange={(v) => setLocal([v[0], v[1]])} onValueCommit={(v) => commit(v[0], v[1])} />
      <div className="flex items-center gap-2 text-xs">
        <Input type="number" step={step} className="h-8" value={local[0]} onChange={(e) => setLocal([Number(e.target.value), local[1]])} onBlur={() => commit(local[0], local[1])} aria-label="Od" />
        <span>–</span>
        <Input type="number" step={step} className="h-8" value={local[1]} onChange={(e) => setLocal([local[0], Number(e.target.value)])} onBlur={() => commit(local[0], local[1])} aria-label="Do" />
        {unit && <span>{unit}</span>}
      </div>
    </div>
  );
}
