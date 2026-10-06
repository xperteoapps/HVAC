import { FileText, Download } from "lucide-react";
import type { ProductDocument } from "@/types";

const TYPE_LABELS: Record<string, string> = { karta: "Karta katalogowa", instrukcja: "Instrukcja", deklaracja: "Deklaracja zgodności" };

export function Documents({ documents }: { documents: ProductDocument[] }) {
  if (!documents.length) return <p className="text-sm text-muted-foreground">Brak dokumentów do pobrania.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {documents.map((d, i) => (
        <li key={d.url + i}>
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary">
            <FileText className="h-5 w-5 text-accent" />
            <span className="flex-1">
              <span className="block font-medium">{d.name}</span>
              {d.type && <span className="block text-xs text-muted-foreground">{TYPE_LABELS[d.type] ?? d.type}</span>}
            </span>
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        </li>
      ))}
    </ul>
  );
}
