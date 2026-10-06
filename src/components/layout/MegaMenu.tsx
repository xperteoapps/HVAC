import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import type { CategoryNode } from "@/types";
import { cn } from "@/lib/utils";

export function MegaMenu() {
  const { data } = useCategories();
  const [openId, setOpenId] = useState<string | null>(null);
  const roots = data?.tree ?? [];

  return (
    <nav aria-label="Kategorie" className="hidden border-t bg-primary text-primary-foreground lg:block">
      <div className="container">
        <ul className="flex items-stretch">
          {roots.map((cat) => (
            <li
              key={cat.id}
              className="relative"
              onMouseEnter={() => setOpenId(cat.id)}
              onMouseLeave={() => setOpenId(null)}
            >
              <Link
                to={`/kategoria/${cat.slug}`}
                className={cn("flex h-11 items-center gap-1 px-4 text-sm font-medium transition-colors hover:bg-white/10", openId === cat.id && "bg-white/10")}
                onFocus={() => setOpenId(cat.id)}
              >
                {cat.name}
                {cat.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
              </Link>
              {cat.children.length > 0 && openId === cat.id && <MegaPanel category={cat} onNavigate={() => setOpenId(null)} />}
            </li>
          ))}
          <li className="ml-auto flex items-center">
            <Link to="/b2b" className="h-11 px-4 text-sm font-medium leading-[44px] text-accent hover:underline">
              Strefa B2B
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

function MegaPanel({ category, onNavigate }: { category: CategoryNode; onNavigate: () => void }) {
  return (
    <div className="absolute left-0 top-full z-40 w-[640px] rounded-b-lg border bg-popover p-5 text-popover-foreground shadow-xl animate-in fade-in-0">
      <div className="grid grid-cols-3 gap-6">
        {category.children.map((child) => (
          <div key={child.id}>
            <Link to={`/kategoria/${child.slug}`} onClick={onNavigate} className="block text-sm font-semibold hover:text-accent">
              {child.name}
              <span className="ml-1 text-xs font-normal text-muted-foreground">({child.product_count})</span>
            </Link>
            {child.children.length > 0 && (
              <ul className="mt-2 space-y-1">
                {child.children.map((g) => (
                  <li key={g.id}>
                    <Link to={`/kategoria/${g.slug}`} onClick={onNavigate} className="text-sm text-muted-foreground hover:text-accent">
                      {g.name} <span className="text-xs">({g.product_count})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 border-t pt-3">
        <Link to={`/kategoria/${category.slug}`} onClick={onNavigate} className="text-sm font-medium text-accent hover:underline">
          Zobacz wszystko w: {category.name} →
        </Link>
      </div>
    </div>
  );
}
