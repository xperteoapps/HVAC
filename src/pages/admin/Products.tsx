import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, ImageOff, Loader2, Pencil, Star, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { SearchInput } from "@/components/admin/SearchInput";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { DataTablePagination } from "@/components/admin/DataTablePagination";
import { StockStatusBadge } from "@/components/admin/StatusBadge";
import {
  NONE_VALUE,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  categoryDepths,
  errorMessage,
  indentLabel,
  sanitizeSearch,
} from "@/components/admin/helpers";
import { useBrands, useCategories } from "@/hooks/useCategories";
import { formatDate, formatPrice, plural } from "@/lib/formatters";
import type { Product, SupplierOffer, Update } from "@/types";

const PAGE_SIZE = 25;

interface ProductRow extends Product {
  category: { name: string } | null;
  brand: { name: string } | null;
}

interface OfferRow extends SupplierOffer {
  supplier: { name: string; code: string } | null;
}

interface EditForm {
  name: string;
  category_id: string;
  brand_id: string;
  vat_rate: string;
  weight_kg: string;
  pallet_required: boolean;
  description_html: string;
  status: string;
}

function OffersDialog({ product, onClose }: { product: ProductRow | null; onClose: () => void }) {
  const offers = useQuery({
    queryKey: ["admin-product-offers", product?.id],
    enabled: Boolean(product),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_offers")
        .select("*, supplier:suppliers(name, code)")
        .eq("product_id", product!.id)
        .order("purchase_net_cents");
      if (error) throw error;
      return (data ?? []) as unknown as OfferRow[];
    },
  });

  return (
    <Dialog open={Boolean(product)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Oferty hurtowni</DialogTitle>
          <DialogDescription>
            {product?.name} · {product?.sku}
          </DialogDescription>
        </DialogHeader>
        {offers.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : offers.isError ? (
          <p className="text-sm text-destructive">{errorMessage(offers.error)}</p>
        ) : (offers.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Ten produkt nie ma przypisanych ofert hurtowni.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hurtownia</TableHead>
                <TableHead>SKU hurtowni</TableHead>
                <TableHead className="text-right">Cena zakupu netto</TableHead>
                <TableHead className="text-right">Stan</TableHead>
                <TableHead className="text-right">Czas dostawy</TableHead>
                <TableHead>Aktywna</TableHead>
                <TableHead>Pobrano</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(offers.data ?? []).map((o) => {
                const best = product?.best_supplier_id === o.supplier_id;
                return (
                  <TableRow key={o.id} className={best ? "bg-accent/10" : undefined}>
                    <TableCell className="font-medium">
                      {o.supplier?.name ?? o.supplier_id}
                      {best && (
                        <Badge variant="accent" className="ml-2">
                          wybrana
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{o.supplier_sku}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{formatPrice(o.purchase_net_cents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.stock}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.lead_time_days !== null ? `${o.lead_time_days} dni` : "—"}</TableCell>
                    <TableCell>{o.active ? <Badge variant="success">tak</Badge> : <Badge variant="outline">nie</Badge>}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(o.fetched_at, true)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  product,
  categories,
  brands,
  onClose,
  onSave,
  saving,
}: {
  product: ProductRow;
  categories: Array<{ id: string; name: string; depth: number }>;
  brands: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (patch: Update<"products">) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<EditForm>({
    name: product.name,
    category_id: product.category_id ?? NONE_VALUE,
    brand_id: product.brand_id ?? NONE_VALUE,
    vat_rate: String(product.vat_rate),
    weight_kg: product.weight_kg !== null ? String(product.weight_kg) : "",
    pallet_required: product.pallet_required,
    description_html: product.description_html ?? "",
    status: product.status,
  });
  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Nazwa jest wymagana");
      return;
    }
    const vat = Number(form.vat_rate);
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      toast.error("Stawka VAT musi być liczbą 0–100");
      return;
    }
    const weight = form.weight_kg.trim() ? Number(form.weight_kg.replace(",", ".")) : null;
    if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
      toast.error("Waga musi być liczbą");
      return;
    }
    onSave({
      name: form.name.trim(),
      category_id: form.category_id === NONE_VALUE ? null : form.category_id,
      brand_id: form.brand_id === NONE_VALUE ? null : form.brand_id,
      vat_rate: vat,
      weight_kg: weight,
      pallet_required: form.pallet_required,
      description_html: form.description_html.trim() || null,
      status: form.status,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edycja produktu</DialogTitle>
          <DialogDescription>SKU {product.sku}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField label="Nazwa" htmlFor="p-name" required className="sm:col-span-2">
            <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </FormField>
          <FormField label="Kategoria" htmlFor="p-category">
            <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger id="p-category">
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
          <FormField label="Marka" htmlFor="p-brand">
            <Select value={form.brand_id} onValueChange={(v) => set("brand_id", v)}>
              <SelectTrigger id="p-brand">
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
          <FormField label="Stawka VAT (%)" htmlFor="p-vat">
            <Input id="p-vat" inputMode="numeric" value={form.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} />
          </FormField>
          <FormField label="Waga (kg)" htmlFor="p-weight">
            <Input id="p-weight" inputMode="decimal" value={form.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} placeholder="np. 12,5" />
          </FormField>
          <FormField label="Status" htmlFor="p-status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger id="p-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PRODUCT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-center gap-2 self-end pb-2">
            <Checkbox id="p-pallet" checked={form.pallet_required} onCheckedChange={(c) => set("pallet_required", c === true)} />
            <label htmlFor="p-pallet" className="text-sm">
              Wymaga dostawy paletowej
            </label>
          </div>
          <FormField label="Opis (HTML)" htmlFor="p-desc" className="sm:col-span-2">
            <Textarea id="p-desc" rows={8} value={form.description_html} onChange={(e) => set("description_html", e.target.value)} className="font-mono text-xs" />
          </FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [page, setPage] = useState(1);
  const [offersFor, setOffersFor] = useState<ProductRow | null>(null);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [recalcing, setRecalcing] = useState(false);

  const categoriesQ = useCategories();
  const brandsQ = useBrands();
  const categoryOptions = useMemo(() => {
    const flat = categoriesQ.data?.flat ?? [];
    const depths = categoryDepths(flat);
    return flat.map((c) => ({ id: c.id, name: c.name, depth: depths.get(c.id) ?? 0 }));
  }, [categoriesQ.data]);
  const brandOptions = useMemo(() => (brandsQ.data ?? []).map((b) => ({ id: b.id, name: b.name })), [brandsQ.data]);

  const products = useQuery({
    queryKey: ["admin-products", { search, status, categoryId, brandId, page }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      let q = supabase.from("products").select("*, category:categories(name), brand:brands(name)", { count: "exact" });
      const s = sanitizeSearch(search);
      if (s) q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
      if (status !== "all") q = q.eq("status", status);
      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      if (brandId !== "all") q = q.eq("brand_id", brandId);
      const { data, error, count } = await q.order("updated_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as ProductRow[], total: count ?? 0 };
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Update<"products"> }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zapisano");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać zmian")),
  });

  const recalcVisible = async () => {
    const ids = (products.data?.rows ?? []).map((p) => p.id);
    if (ids.length === 0) return;
    setRecalcing(true);
    try {
      const { data, error } = await supabase.rpc("recalc_products", { p_ids: ids });
      if (error) throw error;
      toast.success(`Przeliczono ceny: ${plural(Number(data ?? ids.length), "produkt", "produkty", "produktów")}`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) {
      toast.error(errorMessage(e, "Przeliczanie nie powiodło się"));
    } finally {
      setRecalcing(false);
    }
  };

  const rows = products.data?.rows ?? [];
  const total = products.data?.total ?? 0;

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div>
      <Seo noindex title="Produkty · Panel admina" />
      <PageHeader
        title="Produkty"
        description="Edycja inline statusu, nadpisania ceny i wyróżnienia. Podgląd ofert hurtowni per produkt."
        actions={
          <Button variant="outline" size="sm" onClick={recalcVisible} disabled={recalcing || rows.length === 0}>
            {recalcing ? <Loader2 className="animate-spin" /> : <Calculator />} Przelicz ceny
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Nazwa lub SKU…" />
        <Select value={status} onValueChange={resetPage(setStatus)}>
          <SelectTrigger aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            {PRODUCT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PRODUCT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={resetPage(setCategoryId)}>
          <SelectTrigger aria-label="Kategoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kategorie</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {indentLabel(c.name, c.depth)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brandId} onValueChange={resetPage(setBrandId)}>
          <SelectTrigger aria-label="Marka">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie marki</SelectItem>
            {brandOptions.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {products.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(products.error)}</p>}

      {products.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Brak produktów" description="Nie znaleziono produktów spełniających kryteria." />
      ) : (
        <Card>
          <Table className={products.isFetching ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Produkt</TableHead>
                <TableHead>Kategoria</TableHead>
                <TableHead>Marka</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cena netto / brutto</TableHead>
                <TableHead>Nadpisanie netto</TableHead>
                <TableHead>Stan</TableHead>
                <TableHead>
                  <Star className="h-3.5 w-3.5" aria-label="Wyróżniony" />
                </TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.images[0] ? (
                      <img src={p.images[0]} alt="" className="h-10 w-10 rounded border object-contain" loading="lazy" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded border bg-secondary text-muted-foreground">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="min-w-[12rem] max-w-[20rem] font-medium leading-tight">{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                  </TableCell>
                  <TableCell className="text-sm">{p.category?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{p.brand?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <Select value={p.status} onValueChange={(v) => update.mutate({ id: p.id, patch: { status: v } })}>
                      <SelectTrigger className="h-8 w-32 text-xs" aria-label="Status produktu">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {PRODUCT_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    <p>{formatPrice(p.price_net_cents)}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(p.price_gross_cents)}</p>
                  </TableCell>
                  <TableCell>
                    <MoneyInput
                      valueCents={p.price_override_net_cents}
                      aria-label="Nadpisanie ceny netto"
                      className="w-32 [&_input]:h-8 [&_input]:text-xs"
                      onCommit={(cents) => update.mutate({ id: p.id, patch: { price_override_net_cents: cents } })}
                    />
                  </TableCell>
                  <TableCell>
                    <StockStatusBadge status={p.stock_status} />
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.stock_total} szt.</p>
                  </TableCell>
                  <TableCell>
                    <Switch checked={p.featured} aria-label="Wyróżniony" onCheckedChange={(c) => update.mutate({ id: p.id, patch: { featured: c } })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Oferty hurtowni" title="Oferty hurtowni" onClick={() => setOffersFor(p)}>
                        <Store />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Edytuj" title="Edytuj" onClick={() => setEditing(p)}>
                        <Pencil />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} className="border-t p-3" />
        </Card>
      )}

      <OffersDialog product={offersFor} onClose={() => setOffersFor(null)} />
      {editing && (
        <EditDialog
          key={editing.id}
          product={editing}
          categories={categoryOptions}
          brands={brandOptions}
          saving={update.isPending}
          onClose={() => setEditing(null)}
          onSave={(patch) => update.mutate({ id: editing.id, patch }, { onSuccess: () => setEditing(null) })}
        />
      )}
    </div>
  );
}
