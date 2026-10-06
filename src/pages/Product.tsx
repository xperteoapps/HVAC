import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Seo } from "@/components/common/Seo";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { EmptyState } from "@/components/common/EmptyState";
import { Gallery } from "@/components/product/Gallery";
import { SpecTable } from "@/components/product/SpecTable";
import { PriceBox } from "@/components/product/PriceBox";
import { Documents } from "@/components/product/Documents";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { AddToCart } from "@/components/product/AddToCart";
import { Price } from "@/components/common/Price";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/useProducts";
import { useCategories, findCategoryPath } from "@/hooks/useCategories";
import { asAttributes, asDocuments, type ProductListItem } from "@/types";
import { productJsonLd, stripHtml } from "@/lib/seo";

export default function Product() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug);
  const { data: cats } = useCategories();
  const path = useMemo(() => (cats && product?.category ? findCategoryPath(cats.tree, product.category.slug) : []), [cats, product]);

  if (isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr_340px]">
        <Skeleton className="aspect-square" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!product) {
    return <EmptyState title="Nie znaleziono produktu" description="Produkt mógł zostać wycofany z oferty." action={<Button asChild><Link to="/">Wróć na stronę główną</Link></Button>} />;
  }

  const attrs = asAttributes(product.attributes);
  const docs = asDocuments(product.documents);
  const crumbs = [...path.map((c) => ({ name: c.name, path: `/kategoria/${c.slug}` })), { name: product.name, path: `/produkt/${product.slug}` }];
  const listItem: ProductListItem = { ...product, brand: product.brand ?? null };
  const description = stripHtml(product.description_html, 160) || `${product.name} — ${product.brand?.name ?? ""} ${product.sku}`;

  return (
    <div>
      <Seo
        title={product.name}
        description={description}
        image={product.images?.[0]}
        path={`/produkt/${product.slug}`}
        jsonLd={productJsonLd({
          name: product.name,
          sku: product.sku,
          ean: product.ean,
          description: product.description_html,
          images: product.images ?? [],
          brand: product.brand?.name,
          priceGrossCents: product.price_gross_cents,
          stockStatus: product.stock_status,
          path: `/produkt/${product.slug}`,
        })}
      />
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_340px]">
        <Gallery images={product.images ?? []} name={product.name} />
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {product.brand && (
              <Link to={`/szukaj?q=${encodeURIComponent(product.brand.name)}`} className="font-medium text-foreground hover:text-accent">
                {product.brand.name}
              </Link>
            )}
            <span>SKU: {product.sku}</span>
            {product.ean && <span>EAN: {product.ean}</span>}
          </div>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{product.name}</h1>
          {product.description_html && (
            <div className="prose-shop mt-4 line-clamp-6" dangerouslySetInnerHTML={{ __html: product.description_html }} />
          )}
          <h2 className="mt-6 mb-2 text-base font-semibold">Najważniejsze parametry</h2>
          <SpecTable attributes={pick(attrs, 6)} sku={product.sku} brand={product.brand?.name} />
        </div>
        <div className="lg:sticky lg:top-40 lg:self-start">
          <PriceBox product={listItem} />
        </div>
      </div>

      <Tabs defaultValue="spec" className="mt-10">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="spec">Specyfikacja</TabsTrigger>
          <TabsTrigger value="desc">Opis</TabsTrigger>
          <TabsTrigger value="docs">Dokumenty ({docs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="spec" className="rounded-lg border bg-card p-2 sm:p-4">
          <SpecTable attributes={attrs} sku={product.sku} ean={product.ean} brand={product.brand?.name} weightKg={product.weight_kg} vatRate={product.vat_rate} />
        </TabsContent>
        <TabsContent value="desc" className="rounded-lg border bg-card p-4 sm:p-6">
          {product.description_html ? <div className="prose-shop" dangerouslySetInnerHTML={{ __html: product.description_html }} /> : <p className="text-sm text-muted-foreground">Brak opisu.</p>}
        </TabsContent>
        <TabsContent value="docs" className="rounded-lg border bg-card p-4 sm:p-6">
          <Documents documents={docs} />
        </TabsContent>
      </Tabs>

      <div className="mt-12">
        <RelatedProducts productId={product.id} />
      </div>

      {/* Sticky pasek "Dodaj do koszyka" na mobile */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
        <Price product={listItem} size="sm" showSecondary={false} />
        <AddToCart product={listItem} compact className="ml-auto" />
      </div>
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  );
}

const PRIORITY = ["typ", "moc_chlodnicza_kw", "moc_grzewcza_kw", "klasa_energetyczna_chlodzenie", "czynnik", "zasilanie", "wydajnosc_m3h", "pojemnosc_l", "srednica_mm", "dlugosc_m"];

function pick(attrs: Record<string, unknown>, n: number): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const k of PRIORITY) if (attrs[k] !== undefined && Object.keys(out).length < n) out[k] = attrs[k] as string | number | boolean | null;
  for (const [k, v] of Object.entries(attrs)) if (Object.keys(out).length < n && !(k in out)) out[k] = v as string | number | boolean | null;
  return out;
}
