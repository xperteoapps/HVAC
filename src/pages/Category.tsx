import { useCallback, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Seo } from "@/components/common/Seo";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { EmptyState } from "@/components/common/EmptyState";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { FilterSidebar } from "@/components/catalog/FilterSidebar";
import { SortBar } from "@/components/catalog/SortBar";
import { Pagination } from "@/components/catalog/Pagination";
import { ActiveFilters } from "@/components/catalog/ActiveFilters";
import { countActiveFilters, parseFilters, serializeFilters, toProductFilters, type UrlFilterState } from "@/components/catalog/filters";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, findCategoryPath, flattenTree } from "@/hooks/useCategories";
import { useFacets, useProducts } from "@/hooks/useProducts";

const PAGE_SIZE = 24;

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const { data: cats, isLoading: catsLoading } = useCategories();
  const path = useMemo(() => (cats && slug ? findCategoryPath(cats.tree, slug) : []), [cats, slug]);
  const category = path[path.length - 1];
  const categoryIds = useMemo(() => (category ? flattenTree([category]).map((c) => c.id) : undefined), [category]);

  const { data: facets } = useFacets(category?.id);
  const numberKeys = useMemo(() => new Set((facets?.attributes ?? []).filter((a) => a.type === "number").map((a) => a.key)), [facets]);
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseFilters(params, numberKeys), [params, numberKeys]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<UrlFilterState>, resetPage = true) => {
      const next = { ...state, ...patch, ...(resetPage ? { page: 1 } : {}) };
      setParams(serializeFilters(next), { replace: false });
    },
    [state, setParams],
  );

  const brandIdsBySlug = useMemo(() => Object.fromEntries((facets?.brands ?? []).map((b) => [b.slug, b.id])), [facets]);
  const filters = toProductFilters(state, categoryIds, PAGE_SIZE);
  const { data, isLoading, isFetching } = useProducts({ ...filters, categoryIds: categoryIds ?? ["00000000-0000-0000-0000-000000000000"] }, brandIdsBySlug);
  const activeCount = countActiveFilters(state);

  if (catsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (!category) {
    return <EmptyState title="Nie znaleziono kategorii" action={<Button asChild><Link to="/">Wróć na stronę główną</Link></Button>} />;
  }

  const crumbs = path.map((c) => ({ name: c.name, path: `/kategoria/${c.slug}` }));
  const sidebar = <FilterSidebar facets={facets} state={state} onChange={update} onReset={() => setParams({})} activeCount={activeCount} />;

  return (
    <div>
      <Seo title={category.seo_title ?? category.name} description={category.seo_description ?? `${category.name} — ${facets?.total ?? ""} produktów w ofercie. Ceny B2C i B2B.`} path={`/kategoria/${category.slug}`} />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-2xl font-bold sm:text-3xl">{category.name}</h1>
      {category.description && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{category.description}</p>}

      {category.children.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <Link key={c.id} to={`/kategoria/${c.slug}`} className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
              {c.name} <span className="text-xs text-muted-foreground">({c.product_count})</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">{sidebar}</div>
        <div>
          <SortBar
            total={data?.total ?? 0}
            sort={state.sort}
            view={state.view}
            onSort={(s) => update({ sort: s })}
            onView={(v) => update({ view: v }, false)}
            onOpenFilters={() => setFiltersOpen(true)}
            activeCount={activeCount}
          />
          <ActiveFilters state={state} facets={facets} onChange={update} />
          <ProductGrid products={data?.items} loading={isLoading || isFetching} view={state.view} />
          <Pagination page={state.page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={(p) => update({ page: p }, false)} />
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtry</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{sidebar}</div>
          <Button className="mt-4 w-full" onClick={() => setFiltersOpen(false)}>
            Pokaż {data?.total ?? 0} produktów
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
