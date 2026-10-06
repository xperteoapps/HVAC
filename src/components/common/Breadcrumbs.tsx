import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Seo } from "./Seo";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/lib/seo";

export function Breadcrumbs({ items, withJsonLd = true }: { items: BreadcrumbItem[]; withJsonLd?: boolean }) {
  const all: BreadcrumbItem[] = [{ name: "Strona główna", path: "/" }, ...items];
  return (
    <>
      {withJsonLd && <Seo jsonLd={breadcrumbJsonLd(all)} />}
      <nav aria-label="Okruszki" className="mb-4 overflow-x-auto">
        <ol className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
          {all.map((item, i) => {
            const last = i === all.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                {last ? (
                  <span className="font-medium text-foreground" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link to={item.path} className="hover:text-foreground">
                    {i === 0 ? <Home className="h-3.5 w-3.5" aria-label="Strona główna" /> : item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
