import { useAttributeDefs } from "@/hooks/useCategories";
import { formatAttributeValue, formatWeight } from "@/lib/formatters";
import type { ProductAttributes } from "@/types";

export function SpecTable({ attributes, sku, ean, brand, weightKg, vatRate }: { attributes: ProductAttributes; sku: string; ean?: string | null; brand?: string | null; weightKg?: number | string | null; vatRate?: number | string | null }) {
  const { data: defs } = useAttributeDefs();
  const defByKey = new Map((defs ?? []).map((d) => [d.key, d]));
  const rows = Object.entries(attributes)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => ({ key: k, def: defByKey.get(k), value: v }))
    .sort((a, b) => (a.def?.position ?? 999) - (b.def?.position ?? 999) || a.key.localeCompare(b.key));

  const base: Array<[string, string]> = [
    ["SKU", sku],
    ...(ean ? ([["EAN", ean]] as Array<[string, string]>) : []),
    ...(brand ? ([["Marka", brand]] as Array<[string, string]>) : []),
    ...(weightKg ? ([["Waga", formatWeight(weightKg)]] as Array<[string, string]>) : []),
    ["Stawka VAT", `${vatRate ?? 23}%`],
  ];

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b last:border-0 odd:bg-secondary/40">
            <th scope="row" className="w-1/2 py-2 pl-3 pr-2 text-left font-medium text-muted-foreground">
              {r.def?.label ?? humanize(r.key)}
            </th>
            <td className="py-2 pr-3">{formatAttributeValue(r.value, r.def?.unit)}</td>
          </tr>
        ))}
        {base.map(([label, value]) => (
          <tr key={label} className="border-b last:border-0 odd:bg-secondary/40">
            <th scope="row" className="py-2 pl-3 pr-2 text-left font-medium text-muted-foreground">
              {label}
            </th>
            <td className="py-2 pr-3">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
