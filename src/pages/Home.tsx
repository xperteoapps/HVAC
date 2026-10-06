import { Link } from "react-router-dom";
import { ArrowRight, Truck, Briefcase, Headset, Wrench, Snowflake, Flame, Wind, Thermometer, Package, Settings } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { useCategories, useBrands } from "@/hooks/useCategories";
import { useFeaturedProducts } from "@/hooks/useProducts";
import { SITE_NAME } from "@/lib/seo";

const CATEGORY_ICONS: Record<string, typeof Snowflake> = {
  klimatyzacja: Snowflake,
  "pompy-ciepla": Flame,
  "wentylacja-i-rekuperacja": Wind,
  "czynniki-i-narzedzia": Thermometer,
  "akcesoria-montazowe": Package,
  "serwis-i-czesci": Settings,
};

const USP = [
  { icon: Truck, title: "Dostawa paletowa", text: "Pompy ciepła i jednostki gabarytowe dowozimy na palecie w całej Polsce." },
  { icon: Briefcase, title: "Ceny B2B dla instalatorów", text: "Rabaty grupowe, faktury VAT, płatność odroczona 14 dni po weryfikacji." },
  { icon: Headset, title: "Doradztwo techniczne", text: "Pomagamy dobrać moc urządzenia i kompletny zestaw montażowy." },
  { icon: Wrench, title: "Pełne zaplecze montażowe", text: "Rury, wsporniki, pompki skroplin, czynniki, narzędzia — w jednym koszyku." },
];

export default function Home() {
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: featured, isLoading: featLoading } = useFeaturedProducts(8);
  const { data: brands } = useBrands();

  return (
    <div className="space-y-12">
      <Seo
        description="Sklep HVAC: klimatyzatory split i multi-split, pompy ciepła, rekuperacja, czynniki chłodnicze i akcesoria montażowe. Ceny B2C i B2B, dostawa paletowa."
        jsonLd={{ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: typeof window !== "undefined" ? window.location.origin : "" }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-primary-foreground sm:px-10 sm:py-16">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-accent">Klimatyzacja · Pompy ciepła · Wentylacja</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Sprzęt HVAC dla instalatorów i domu — w jednym miejscu</h1>
          <p className="mt-4 text-base text-primary-foreground/80 sm:text-lg">
            Urządzenia renomowanych marek, kompletne zestawy montażowe i części serwisowe. Stany magazynowe aktualizowane na bieżąco z hurtowni.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" variant="accent" asChild>
              <Link to="/kategoria/klimatyzacja">
                Klimatyzatory <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground" asChild>
              <Link to="/b2b">Konto B2B dla firm</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Kategorie */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Kategorie</h2>
        {catsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(categories?.tree ?? []).map((c) => {
              const Icon = CATEGORY_ICONS[c.slug] ?? Package;
              return (
                <Link
                  key={c.id}
                  to={`/kategoria/${c.slug}`}
                  className="group flex flex-col items-start gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-accent group-hover:bg-accent group-hover:text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold leading-tight">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">{c.product_count} produktów</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* USP */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {USP.map((u) => (
          <div key={u.title} className="flex gap-3 rounded-lg border bg-card p-4">
            <u.icon className="h-6 w-6 shrink-0 text-accent" />
            <div>
              <h3 className="text-sm font-semibold">{u.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{u.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Bestsellery */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Polecane produkty</h2>
          <Link to="/kategoria/klimatyzacja" className="text-sm font-medium text-accent hover:underline">
            Zobacz wszystkie →
          </Link>
        </div>
        <ProductGrid products={featured} loading={featLoading} emptyTitle="Wkrótce dodamy polecane produkty" emptyDescription="Uruchom synchronizację hurtowni w panelu admina." />
      </section>

      {/* Marki */}
      {brands && brands.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Marki w ofercie</h2>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <Link key={b.id} to={`/szukaj?q=${encodeURIComponent(b.name)}`} className="rounded-full border bg-card px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent">
                {b.logo_url ? <img src={b.logo_url} alt={b.name} className="h-5" /> : b.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
