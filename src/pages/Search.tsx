import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Seo } from "@/components/common/Seo";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { FilterSidebar } from "@/components/catalog/FilterSidebar";
import { SortBar } from "@/components/catalog/SortBar";
import { Pagination } from "@/components/catalog/Pagination";
import { ActiveFilters } from "@/components/catalog/ActiveFilters";
import { countActiveFilters, parseFilters, serializeFilters, toProductFilters, type UrlFilterState } from "@/components/catalog/filters";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useFacets, useProducts } from "@/hooks/useProducts";

const PAGE_SIZE = 24;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const { data: facets } = useFacets(null, q);
  const numberKeys = useMemo(() => new Set((facets?.attributes ?? []).filter((a) => a.type === "number").map((a) => a.key)), [facets]);
  const state = useMemo(() => parseFilters(params, numberKeys), [params, numberKeys]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<UrlFilterState>, resetPage = true) => {
      setParams(serializeFilters({ ...state, ...patch, ...(resetPage ? { page: 1 } : {}) }));
    },
    [state, setParams],
  );

  const brandIdsBySlug = useMemo(() => Object.fromEntries((facets?.brands ?? []).map((b) => [b.slug, b.id])), [facets]);
  const { data, isLoading, isFetching } = useProducts({ ...toProductFilters(state, undefined, PAGE_SIZE), search: q || null }, brandIdsBySlug);
  const activeCount = countActiveFilters(state);
  const sidebar = <FilterSidebar facets={facets} state={state} onChange={update} onReset={() => setParams({ q })} activeCount={activeCount} />;

  return (
    <div>
      <Seo title={q ? `Wyniki wyszukiwania: ${q}` : "Wyszukiwarka"} noindex />
      <Breadcrumbs items={[{ name: "Wyszukiwanie", path: "/szukaj" }]} withJsonLd={false} />
      <h1 className="text-2xl font-bold sm:text-3xl">{q ? <>Wyniki dla „{q}”</> : "Wyszukiwarka"}</h1>
      {!q && <p className="mt-2 text-sm text-muted-foreground">Wpisz nazwę produktu, model, SKU lub kod EAN w polu wyszukiwania.</p>}
      {q && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="hidden lg:block">{sidebar}</div>
          <div>
            <SortBar total={data?.total ?? 0} sort={state.sort} view={state.view} onSort={(s) => update({ sort: s })} onView={(v) => update({ view: v }, false)} onOpenFilters={() => setFiltersOpen(true)} activeCount={activeCount} />
            <ActiveFilters state={state} facets={facets} onChange={update} />
            <ProductGrid products={data?.items} loading={isLoading || isFetching} view={state.view} emptyTitle={`Brak wyników dla „${q}”`} emptyDescription="Sprawdź pisownię lub użyj ogólniejszej frazy, np. „klimatyzator 3.5 kW”." />
            <Pagination page={state.page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={(p) => update({ page: p }, false)} />
          </div>
        </div>
      )}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtry</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{sidebar}</div>
          <Button className="mt-4 w-full" onClick={() => setFiltersOpen(false)}>
            Pokaż wyniki
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
