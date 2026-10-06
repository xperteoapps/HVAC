import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Link2, Loader2, PlusCircle, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { SearchInput } from "@/components/admin/SearchInput";
import { NONE_VALUE, categoryDepths, errorMessage, indentLabel, sanitizeSearch, slugify } from "@/components/admin/helpers";
import { useBrands, useCategories } from "@/hooks/useCategories";
import { formatPrice, plural } from "@/lib/formatters";
import type { SupplierOffer } from "@/types";

const LOAD_LIMIT = 100;

interface OfferRow extends SupplierOffer {
  supplier: { id: string; name: string; code: string } | null;
}

interface SupplierLite {
  id: string;
  code: string;
  name: string;
}

interface Candidate {
  id: string;
  sku: string;
  name: string;
  price_net_cents: number | null;
}

async function linkOfferToProduct(offer: OfferRow, productId: string, matchedBy: string): Promise<void> {
  const { error } = await supabase.from("supplier_offers").update({ product_id: productId }).eq("id", offer.id);
  if (error) throw error;
  const { error: mErr } = await supabase
    .from("product_mappings")
    .upsert({ supplier_id: offer.supplier_id, supplier_sku: offer.supplier_sku, product_id: productId, matched_by: matchedBy }, { onConflict: "supplier_id,supplier_sku" });
  if (mErr) throw mErr;
}

function MatchDialog({ offer, onClose, onPick, busy }: { offer: OfferRow | null; onClose: () => void; onPick: (productId: string) => void; busy: boolean }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<Candidate | null>(null);

  const results = useQuery({
    queryKey: ["admin-search-products", q],
    enabled: Boolean(offer) && q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_products", { p_query: q.trim(), lim: 10, off: 0 });
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, sku: r.sku, name: r.name, price_net_cents: r.price_net_cents })) as Candidate[];
    },
  });

  return (
    <Dialog
      open={Boolean(offer)}
      onOpenChange={(o) => {
        if (!o) {
          setQ("");
          setChosen(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dopasuj ofertę do produktu</DialogTitle>
          <DialogDescription>
            {offer?.name_raw} · {offer?.supplier?.name} · {offer?.supplier_sku}
          </DialogDescription>
        </DialogHeader>
        <SearchInput value={q} onChange={setQ} placeholder="Nazwa, SKU lub EAN produktu…" autoFocus />
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {q.trim().length < 2 ? (
            <p className="p-4 text-sm text-muted-foreground">Wpisz co najmniej 2 znaki, aby wyszukać produkt.</p>
          ) : results.isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : results.isError ? (
            <p className="p-4 text-sm text-destructive">{errorMessage(results.error)}</p>
          ) : (results.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Brak wyników.</p>
          ) : (
            <ul className="divide-y">
              {(results.data ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setChosen(c)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60 ${chosen?.id === c.id ? "bg-accent/15" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{c.sku}</p>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{formatPrice(c.price_net_cents)} netto</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Anuluj
          </Button>
          <Button disabled={!chosen || busy} onClick={() => chosen && onPick(chosen.id)}>
            {busy && <Loader2 className="animate-spin" />} Dopasuj{chosen ? `: ${chosen.sku}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateForm {
  name: string;
  sku: string;
  slug: string;
  category_id: string;
  brand_id: string;
  vat_rate: string;
}

function CreateProductDialog({
  offer,
  categories,
  brands,
  onClose,
  onCreate,
  busy,
}: {
  offer: OfferRow;
  categories: Array<{ id: string; name: string; depth: number }>;
  brands: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreate: (form: CreateForm) => void;
  busy: boolean;
}) {
  const guessBrand = brands.find((b) => offer.brand_raw && b.name.toLowerCase() === offer.brand_raw.toLowerCase());
  const [form, setForm] = useState<CreateForm>({
    name: offer.name_raw,
    sku: `${(offer.supplier?.code ?? "HURT").toUpperCase()}-${offer.supplier_sku}`,
    slug: slugify(offer.name_raw),
    category_id: NONE_VALUE,
    brand_id: guessBrand?.id ?? NONE_VALUE,
    vat_rate: "23",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const set = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Utwórz produkt z oferty</DialogTitle>
          <DialogDescription>Produkt zostanie utworzony jako ukryty — opublikuj go po uzupełnieniu danych.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim() || !form.sku.trim() || !form.slug.trim()) {
              toast.error("Nazwa, SKU i slug są wymagane");
              return;
            }
            onCreate(form);
          }}
        >
          <FormField label="Nazwa" htmlFor="c-name" required className="sm:col-span-2">
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
            />
          </FormField>
          <FormField label="SKU" htmlFor="c-sku" required>
            <Input id="c-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          </FormField>
          <FormField label="Slug" htmlFor="c-slug" required>
            <Input
              id="c-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value) || e.target.value);
              }}
            />
          </FormField>
          <FormField label="Kategoria" htmlFor="c-category">
            <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger id="c-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>— brak —</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {indentLabel(c.name, c.depth)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Marka" htmlFor="c-brand">
            <Select value={form.brand_id} onValueChange={(v) => set("brand_id", v)}>
              <SelectTrigger id="c-brand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>— brak —</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Stawka VAT (%)" htmlFor="c-vat">
            <Input id="c-vat" inputMode="numeric" value={form.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} />
          </FormField>
          <div className="self-end pb-2 text-xs text-muted-foreground">
            EAN: {offer.ean ?? "—"} · cena zakupu {formatPrice(offer.purchase_net_cents)} netto
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Anuluj
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Utwórz i dopasuj
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OfferMapping() {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("all");
  const [search, setSearch] = useState("");
  const [matching, setMatching] = useState<OfferRow | null>(null);
  const [creating, setCreating] = useState<OfferRow | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);

  const categoriesQ = useCategories();
  const brandsQ = useBrands();
  const categoryOptions = useMemo(() => {
    const flat = categoriesQ.data?.flat ?? [];
    const depths = categoryDepths(flat);
    return flat.map((c) => ({ id: c.id, name: c.name, depth: depths.get(c.id) ?? 0 }));
  }, [categoriesQ.data]);
  const brandOptions = useMemo(() => (brandsQ.data ?? []).map((b) => ({ id: b.id, name: b.name })), [brandsQ.data]);

  const suppliers = useQuery({
    queryKey: ["admin-suppliers-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name").order("priority");
      if (error) throw error;
      return (data ?? []) as SupplierLite[];
    },
  });

  const offers = useQuery({
    queryKey: ["admin-unmapped-offers", { supplierId, search }],
    queryFn: async () => {
      let q = supabase
        .from("supplier_offers")
        .select("*, supplier:suppliers(id, name, code)", { count: "exact" })
        .is("product_id", null)
        .eq("ignored", false)
        .eq("active", true);
      if (supplierId !== "all") q = q.eq("supplier_id", supplierId);
      const s = sanitizeSearch(search);
      if (s) q = q.or(`name_raw.ilike.%${s}%,supplier_sku.ilike.%${s}%,ean.ilike.%${s}%,brand_raw.ilike.%${s}%`);
      const { data, error, count } = await q.order("fetched_at", { ascending: false }).limit(LOAD_LIMIT);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as OfferRow[], total: count ?? 0 };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-unmapped-offers"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const match = useMutation({
    mutationFn: async ({ offer, productId }: { offer: OfferRow; productId: string }) => linkOfferToProduct(offer, productId, "manual"),
    onSuccess: () => {
      toast.success("Oferta dopasowana do produktu");
      setMatching(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się dopasować oferty")),
  });

  const ignore = useMutation({
    mutationFn: async (offer: OfferRow) => {
      const { error } = await supabase.from("supplier_offers").update({ ignored: true }).eq("id", offer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oferta zignorowana");
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zignorować oferty")),
  });

  const create = useMutation({
    mutationFn: async ({ offer, form }: { offer: OfferRow; form: CreateForm }) => {
      const vat = Number(form.vat_rate);
      if (!Number.isFinite(vat)) throw new Error("Nieprawidłowa stawka VAT");
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: form.name.trim(),
          sku: form.sku.trim(),
          slug: form.slug.trim(),
          category_id: form.category_id === NONE_VALUE ? null : form.category_id,
          brand_id: form.brand_id === NONE_VALUE ? null : form.brand_id,
          vat_rate: vat,
          ean: offer.ean,
          status: "hidden",
          lead_time_days: offer.lead_time_days,
        })
        .select("id")
        .single();
      if (error) throw error;
      await linkOfferToProduct(offer, data.id, "manual");
    },
    onSuccess: () => {
      toast.success("Utworzono ukryty produkt i dopasowano ofertę");
      setCreating(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się utworzyć produktu")),
  });

  const autoMatch = async () => {
    const rows = offers.data?.rows ?? [];
    if (rows.length === 0) return;
    setAutoRunning(true);
    try {
      const uniq = (arr: Array<string | null>) => Array.from(new Set(arr.filter((v): v is string => Boolean(v && v.trim()))));
      const eans = uniq(rows.map((o) => o.ean));
      const skus = uniq(rows.map((o) => o.supplier_sku));
      const byEan = new Map<string, string>();
      const bySku = new Map<string, string>();
      const BATCH = 100;
      for (let i = 0; i < eans.length; i += BATCH) {
        const { data, error } = await supabase.from("products").select("id, ean").in("ean", eans.slice(i, i + BATCH));
        if (error) throw error;
        for (const p of data ?? []) if (p.ean && !byEan.has(p.ean)) byEan.set(p.ean, p.id);
      }
      for (let i = 0; i < skus.length; i += BATCH) {
        const { data, error } = await supabase.from("products").select("id, sku").in("sku", skus.slice(i, i + BATCH));
        if (error) throw error;
        for (const p of data ?? []) if (!bySku.has(p.sku)) bySku.set(p.sku, p.id);
      }
      let matched = 0;
      let failed = 0;
      for (const offer of rows) {
        const eanHit = offer.ean ? byEan.get(offer.ean) : undefined;
        const skuHit = bySku.get(offer.supplier_sku);
        const productId = eanHit ?? skuHit;
        if (!productId) continue;
        try {
          await linkOfferToProduct(offer, productId, eanHit ? "ean" : "sku");
          matched++;
        } catch {
          failed++;
        }
      }
      if (matched === 0 && failed === 0) toast.info("Nie znaleziono dopasowań po EAN ani SKU wśród załadowanych ofert");
      else if (failed === 0) toast.success(`Automatycznie dopasowano ${plural(matched, "ofertę", "oferty", "ofert")}`);
      else toast.warning(`Dopasowano ${matched}, nie udało się ${failed}`);
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e, "Auto-dopasowanie nie powiodło się"));
    } finally {
      setAutoRunning(false);
    }
  };

  const rows = offers.data?.rows ?? [];
  const total = offers.data?.total ?? 0;
  const busy = match.isPending || ignore.isPending || create.isPending || autoRunning;

  return (
    <div>
      <Seo noindex title="Mapowanie ofert · Panel admina" />
      <PageHeader
        title="Mapowanie ofert"
        description="Oferty hurtowni bez przypisanego produktu. Dopasuj do istniejącego produktu, utwórz nowy albo zignoruj."
        actions={
          <Button variant="outline" size="sm" onClick={autoMatch} disabled={busy || rows.length === 0}>
            {autoRunning ? <Loader2 className="animate-spin" /> : <Wand2 />} Auto-dopasuj po EAN/SKU
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Nazwa, SKU, EAN lub marka…" className="sm:max-w-sm" />
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="sm:w-56" aria-label="Hurtownia">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie hurtownie</SelectItem>
            {(suppliers.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant={total > 0 ? "warning" : "success"} className="sm:ml-auto">
          Pozostało: {total}
        </Badge>
      </div>

      {offers.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(offers.error)}</p>}

      {offers.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Kolejka jest pusta" description="Wszystkie aktywne oferty hurtowni mają przypisany produkt." icon={<Link2 className="h-10 w-10" />} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hurtownia</TableHead>
                <TableHead>SKU / EAN</TableHead>
                <TableHead>Nazwa z feedu</TableHead>
                <TableHead>Marka</TableHead>
                <TableHead>Kategoria z feedu</TableHead>
                <TableHead className="text-right">Zakup netto</TableHead>
                <TableHead className="text-right">Stan</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="whitespace-nowrap font-medium">{o.supplier?.name ?? "—"}</TableCell>
                  <TableCell>
                    <p className="font-mono text-xs">{o.supplier_sku}</p>
                    <p className="font-mono text-xs text-muted-foreground">{o.ean ?? "brak EAN"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="min-w-[12rem] max-w-[22rem] leading-tight">{o.name_raw}</p>
                  </TableCell>
                  <TableCell className="text-sm">{o.brand_raw ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="max-w-[14rem] truncate text-xs text-muted-foreground" title={o.category_path?.join(" › ")}>
                    {o.category_path?.length ? o.category_path.join(" › ") : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{formatPrice(o.purchase_net_cents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.stock}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setMatching(o)}>
                        <Link2 /> <span className="hidden xl:inline">Dopasuj</span>
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setCreating(o)}>
                        <PlusCircle /> <span className="hidden xl:inline">Utwórz produkt</span>
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => ignore.mutate(o)} aria-label="Ignoruj" title="Ignoruj">
                        <Ban /> <span className="hidden xl:inline">Ignoruj</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {total > rows.length && <p className="border-t p-3 text-xs text-muted-foreground">Wyświetlono {rows.length} z {total} ofert — zawęź filtry, aby zobaczyć pozostałe.</p>}
        </Card>
      )}

      <MatchDialog offer={matching} onClose={() => setMatching(null)} busy={match.isPending} onPick={(productId) => matching && match.mutate({ offer: matching, productId })} />
      {creating && (
        <CreateProductDialog
          key={creating.id}
          offer={creating}
          categories={categoryOptions}
          brands={brandOptions}
          busy={create.isPending}
          onClose={() => setCreating(null)}
          onCreate={(form) => create.mutate({ offer: creating, form })}
        />
      )}
    </div>
  );
}
